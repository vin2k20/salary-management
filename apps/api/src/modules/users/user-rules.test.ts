import { describe, expect, it } from 'vitest';
import { checkUserUpdate } from './user-rules.ts';

const actorId = 'a0000000-0000-4000-8000-000000000001';
const countryHr = {
  id: 'b0000000-0000-4000-8000-000000000002',
  role: 'country_hr' as const,
  countryCode: 'IN' as const,
  isActive: true,
};

describe('checkUserUpdate', () => {
  it('merges the change with the current values', () => {
    expect(checkUserUpdate(actorId, countryHr, { countryCode: 'AU' })).toEqual({
      ok: true,
      next: { role: 'country_hr', countryCode: 'AU', isActive: true },
    });
  });

  it('moves a user to global HR only without a country', () => {
    expect(checkUserUpdate(actorId, countryHr, { role: 'global_hr' })).toEqual({
      ok: false,
      field: 'countryCode',
      message: 'Global HR users are not tied to a country',
    });
    expect(checkUserUpdate(actorId, countryHr, { role: 'global_hr', countryCode: null })).toEqual({
      ok: true,
      next: { role: 'global_hr', countryCode: null, isActive: true },
    });
  });

  it('keeps a country for a country HR user', () => {
    expect(checkUserUpdate(actorId, countryHr, { countryCode: null })).toMatchObject({
      ok: false,
      message: 'Choose the country this user manages',
    });
  });

  it('stops users from changing their own role or deactivating themselves', () => {
    const self = { ...countryHr, id: actorId, role: 'global_hr' as const, countryCode: null };

    expect(checkUserUpdate(actorId, self, { isActive: false })).toMatchObject({
      ok: false,
      message: 'You cannot deactivate yourself or change your own role',
    });
    expect(checkUserUpdate(actorId, self, { role: 'country_hr', countryCode: 'US' })).toMatchObject(
      { ok: false },
    );
    expect(checkUserUpdate(actorId, self, { name: 'New Name' })).toMatchObject({ ok: true });
  });
});
