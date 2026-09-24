import { randomUUID } from 'node:crypto';
import {
  changeLogResponseSchema,
  createUserResponseSchema,
  userListResponseSchema,
} from '@salary/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { users } from '../../db/schema.ts';
import type { EmailSender } from '../../email/email-sender.ts';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase, testClock } from '../../test/test-app.ts';
import { consumeAuthToken } from '../auth/auth-tokens.ts';
import { hashPassword } from '../auth/passwords.ts';

type App = Awaited<ReturnType<typeof createTestApp>>['app'];

describe('user management', () => {
  let adminCookie: string;
  let adminId: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    const admin = await insertUser(db, { name: 'Aaron Admin', role: 'global_hr' });
    adminId = admin.id;
    adminCookie = await sessionCookieFor(admin);
  });

  function newUser(overrides: Record<string, unknown> = {}) {
    return {
      name: 'Priya Nair',
      email: `priya-${randomUUID()}@acme.example.com`,
      role: 'country_hr',
      countryCode: 'IN',
      ...overrides,
    };
  }

  async function create(app: App, body: Record<string, unknown>) {
    return request(app).post('/api/users').set('Cookie', adminCookie).send(body);
  }

  function inviteToken(text: string) {
    return /\/set-password\?token=([\w-]+)/.exec(text)?.[1] ?? '';
  }

  describe('GET /api/users', () => {
    it('lists users by name with their status, and never their password', async () => {
      const { db } = await sharedTestDatabase();
      const { app } = await createTestApp();
      await insertUser(db, { name: 'Zed Invited' });
      await insertUser(db, {
        name: 'Zed Active',
        passwordHash: await hashPassword('password password'),
      });
      await insertUser(db, { name: 'Zed Inactive', isActive: false });

      const response = await request(app).get('/api/users').set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      const body = userListResponseSchema.parse(response.body);
      expect(body).toMatchObject({ page: 1, pageSize: 50 });
      const names = body.items.map((user) => user.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      expect(
        Object.fromEntries(
          body.items
            .filter((user) => user.name.startsWith('Zed'))
            .map((user) => [user.name, user.status]),
        ),
      ).toEqual({ 'Zed Invited': 'invited', 'Zed Active': 'active', 'Zed Inactive': 'inactive' });
      expect(JSON.stringify(response.body)).not.toMatch(/argon2|passwordHash|tokenVersion/);
    });
  });

  describe('POST /api/users', () => {
    it('adds an invited user and emails an invite link that works for 72 hours', async () => {
      const { db } = await sharedTestDatabase();
      const { app, emails } = await createTestApp();
      const body = newUser({ email: ` Priya.Invite.${String(Date.now())}@Acme.Example.com ` });

      const response = await create(app, body);

      expect(response.status).toBe(201);
      const { user, inviteSent } = createUserResponseSchema.parse(response.body);
      expect(inviteSent).toBe(true);
      expect(user).toMatchObject({
        name: 'Priya Nair',
        email: body.email.trim().toLowerCase(),
        role: 'country_hr',
        countryCode: 'IN',
        status: 'invited',
        lastLoginAt: null,
      });
      expect(emails).toHaveLength(1);
      expect(emails[0]?.to.email).toBe(user.email);
      expect(emails[0]?.subject).toBe('You are invited to ACME Salary Management');
      expect(emails[0]?.text).toContain('72 hours');
      await expect(
        consumeAuthToken(db, inviteToken(emails[0]?.text ?? ''), testClock()),
      ).resolves.toEqual({ userId: user.id, purpose: 'invite' });
    });

    it('records who added the user in the change log', async () => {
      const { app } = await createTestApp();
      const { user } = createUserResponseSchema.parse((await create(app, newUser())).body);

      const log = await request(app)
        .get(`/api/users/${user.id}/change-log`)
        .set('Cookie', adminCookie);

      expect(log.status).toBe(200);
      expect(changeLogResponseSchema.parse(log.body).items).toEqual([
        expect.objectContaining({
          action: 'created',
          changedBy: { id: adminId, name: 'Aaron Admin' },
          changes: expect.objectContaining({
            role: { old: null, new: 'country_hr' },
            countryCode: { old: null, new: 'IN' },
          }) as unknown,
        }),
      ]);
    });

    it('refuses an email that is already used', async () => {
      const { app } = await createTestApp();
      const body = newUser();
      await create(app, body);

      const response = await create(app, { ...body, name: 'Someone Else' });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ detail: 'A user with this email already exists' });
    });

    it('returns 400 when a country HR user has no country', async () => {
      const { app } = await createTestApp();

      const response = await create(app, newUser({ countryCode: null }));

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        errors: [{ field: 'countryCode', message: 'Choose the country this user manages' }],
      });
    });

    it('keeps the user and reports it when the invite email fails', async () => {
      const failing: EmailSender = { send: () => Promise.reject(new Error('Brevo is down')) };
      const { app, logLines } = await createTestApp({ emailSender: failing });

      const response = await create(app, newUser());

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ inviteSent: false, user: { status: 'invited' } });
      expect(logLines).toContainEqual(expect.objectContaining({ msg: 'Invite email failed' }));
    });
  });

  describe('PATCH /api/users/:id', () => {
    async function createActive(app: App, overrides: Record<string, unknown> = {}) {
      const { db } = await sharedTestDatabase();
      const { user } = createUserResponseSchema.parse((await create(app, newUser(overrides))).body);
      await db
        .update(users)
        .set({ passwordHash: await hashPassword('a strong password') })
        .where(eq(users.id, user.id));
      return user;
    }

    function patch(app: App, id: string, body: Record<string, unknown>) {
      return request(app).patch(`/api/users/${id}`).set('Cookie', adminCookie).send(body);
    }

    it('changes the country of a country HR user and logs the change', async () => {
      const { app } = await createTestApp();
      const user = await createActive(app);

      const response = await patch(app, user.id, { countryCode: 'AU' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ user: { countryCode: 'AU', status: 'active' } });
      const log = changeLogResponseSchema.parse(
        (await request(app).get(`/api/users/${user.id}/change-log`).set('Cookie', adminCookie))
          .body,
      );
      expect(log.items[0]).toMatchObject({
        action: 'updated',
        changes: { countryCode: { old: 'IN', new: 'AU' } },
      });
    });

    it('checks role and country against the current values', async () => {
      const { app } = await createTestApp();
      const user = await createActive(app);

      const alone = await patch(app, user.id, { role: 'global_hr' });
      const withCountry = await patch(app, user.id, { role: 'global_hr', countryCode: null });

      expect(alone.status).toBe(400);
      expect(alone.body).toMatchObject({
        errors: [{ field: 'countryCode', message: 'Global HR users are not tied to a country' }],
      });
      expect(withCountry.status).toBe(200);
      expect(withCountry.body).toMatchObject({ user: { role: 'global_hr', countryCode: null } });
    });

    it('signs a deactivated user out and stops them signing in, until reactivated', async () => {
      const { db } = await sharedTestDatabase();
      const { app } = await createTestApp();
      const user = await createActive(app);
      const [record] = await db.select().from(users).where(eq(users.id, user.id));
      const session = await sessionCookieFor({
        id: user.id,
        tokenVersion: record?.tokenVersion ?? 0,
      });
      const signIn = () =>
        request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: 'a strong password' });

      const deactivated = await patch(app, user.id, { isActive: false });

      expect(deactivated.body).toMatchObject({ user: { status: 'inactive' } });
      expect((await request(app).get('/api/auth/me').set('Cookie', session)).status).toBe(401);
      expect((await signIn()).status).toBe(401);
      const log = changeLogResponseSchema.parse(
        (await request(app).get(`/api/users/${user.id}/change-log`).set('Cookie', adminCookie))
          .body,
      );
      expect(log.items[0]).toMatchObject({
        action: 'inactivated',
        changes: { isActive: { old: true, new: false } },
      });

      await patch(app, user.id, { isActive: true });
      expect((await signIn()).status).toBe(200);
    });

    it('stops global HR users from deactivating themselves', async () => {
      const { app } = await createTestApp();

      const response = await patch(app, adminId, { isActive: false });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        detail: 'You cannot deactivate yourself or change your own role',
      });
    });

    it('returns 404 for an unknown user', async () => {
      const { app } = await createTestApp();

      expect((await patch(app, randomUUID(), { isActive: false })).status).toBe(404);
      expect((await patch(app, 'not-a-uuid', { isActive: false })).status).toBe(404);
    });
  });

  describe('POST /api/users/:id/invite', () => {
    it('sends a new invite to a user who has not set a password', async () => {
      const { app, emails } = await createTestApp();
      const { user } = createUserResponseSchema.parse((await create(app, newUser())).body);

      const response = await request(app)
        .post(`/api/users/${user.id}/invite`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(204);
      expect(emails).toHaveLength(2);
      expect(inviteToken(emails[1]?.text ?? '')).not.toBe(inviteToken(emails[0]?.text ?? ''));
    });

    it('refuses users who have set a password or are inactive', async () => {
      const { db } = await sharedTestDatabase();
      const { app } = await createTestApp();
      const active = await insertUser(db, {
        passwordHash: await hashPassword('password password'),
      });
      const inactive = await insertUser(db, { isActive: false });

      const forActive = await request(app)
        .post(`/api/users/${active.id}/invite`)
        .set('Cookie', adminCookie);
      const forInactive = await request(app)
        .post(`/api/users/${inactive.id}/invite`)
        .set('Cookie', adminCookie);

      expect(forActive.status).toBe(409);
      expect(forActive.body).toMatchObject({ detail: 'This user has already set a password' });
      expect(forInactive.status).toBe(409);
      expect(forInactive.body).toMatchObject({
        detail: 'Reactivate the user before sending an invite',
      });
    });
  });
});
