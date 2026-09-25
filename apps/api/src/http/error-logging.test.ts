import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../test/test-app.ts';
import { createTestDatabase } from '../test/test-database.ts';

describe('logged errors', () => {
  it('leave out the values of a failed database query, which can hold personal data', async () => {
    // A closed database makes every query fail, as an outage would.
    const database = await createTestDatabase();
    await database.close();
    const { app, logLines } = await createTestApp({ db: database.db });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'priya.patel@example.com', password: 'a-long-enough-password' });

    expect(response.status).toBe(500);
    const logged = JSON.stringify(logLines);
    expect(logged).toContain('Failed query');
    expect(logged).not.toContain('priya.patel@example.com');
  });
});
