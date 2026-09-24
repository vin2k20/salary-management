import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { insertUser } from '../../test/fixtures.ts';
import { TEST_APP_URL, createTestApp, sharedTestDatabase, testClock } from '../../test/test-app.ts';
import { consumeAuthToken } from './auth-tokens.ts';

describe('POST /api/auth/forgot-password', () => {
  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    await insertUser(db, {
      email: 'hr.ca@acme.example.com',
      name: 'Canada HR',
      role: 'country_hr',
      countryCode: 'CA',
    });
    await insertUser(db, { email: 'left@acme.example.com', isActive: false });
  });

  function linkToken(text: string) {
    const match = /\/set-password\?token=([\w-]+)/.exec(text);
    return match?.[1] ?? '';
  }

  it('emails a reset link that works for 30 minutes to an active user', async () => {
    const { db } = await sharedTestDatabase();
    const { app, emails, logLines } = await createTestApp();

    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: ' HR.CA@acme.example.com ' });

    expect(response.status).toBe(202);
    expect(response.text).toBe('');
    await vi.waitFor(() => {
      expect(emails).toHaveLength(1);
    });
    const [email] = emails;
    expect(email?.to).toEqual({ email: 'hr.ca@acme.example.com', name: 'Canada HR' });
    expect(email?.subject).toBe('Reset your ACME Salary Management password');
    expect(email?.text).toContain(`${TEST_APP_URL}/set-password?token=`);
    expect(email?.text).toContain('30 minutes');
    expect(email?.html).toContain(`${TEST_APP_URL}/set-password?token=`);

    const token = linkToken(email?.text ?? '');
    expect(JSON.stringify(logLines)).not.toContain(token);
    await expect(consumeAuthToken(db, token, testClock())).resolves.toMatchObject({
      purpose: 'reset',
    });
  });

  it.each([
    ['an unknown email', 'nobody@acme.example.com'],
    ['an inactive user', 'left@acme.example.com'],
  ])('gives the same answer for %s and sends nothing', async (_case, email) => {
    const { app, emails } = await createTestApp();

    const response = await request(app).post('/api/auth/forgot-password').send({ email });

    expect(response.status).toBe(202);
    expect(response.text).toBe('');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(emails).toEqual([]);
  });

  it('returns 400 for an invalid email', async () => {
    const { app } = await createTestApp();

    const response = await request(app).post('/api/auth/forgot-password').send({ email: 'nope' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      errors: [{ field: 'email', message: 'Enter a valid email address' }],
    });
  });

  it('allows three requests per email in 15 minutes', async () => {
    const { app } = await createTestApp();

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@acme.example.com' });
      expect(response.status).toBe(202);
    }
    const blocked = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@acme.example.com' });

    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      detail: 'Too many requests for this email. Try again in 15 minutes.',
    });
  });
});
