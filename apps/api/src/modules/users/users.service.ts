import type {
  ChangeLogEntry,
  CreateUserRequest,
  CurrentUser,
  UpdateUserRequest,
} from '@salary/shared';
import { eq, sql } from 'drizzle-orm';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { users } from '../../db/schema.ts';
import { HttpError, RequestValidationError } from '../../http/errors.ts';
import { issueAuthToken } from '../auth/auth-tokens.ts';
import type { Scope } from '../auth/scope.ts';
import { changeLogFor, diffFields, recordChange } from '../change-log/change-log.ts';
import { checkUserUpdate } from './user-rules.ts';
import { findUser, type UserRecord } from './users.repository.ts';

/** Fields of a user that are logged. The password hash and token version never are. */
function loggedFields(
  user: Pick<UserRecord, 'email' | 'name' | 'role' | 'countryCode' | 'isActive'>,
) {
  return {
    email: user.email,
    name: user.name,
    role: user.role,
    countryCode: user.countryCode,
    isActive: user.isActive,
  };
}

async function findOrThrow(db: Database, id: string) {
  const user = await findUser(db, id);
  if (!user) throw new HttpError(404, 'User not found');
  return user;
}

/** Adds an invited user and creates their invite token, in one transaction with the log. */
export async function createUser(
  db: Database,
  input: CreateUserRequest,
  actor: CurrentUser,
  clock: Clock,
): Promise<{ user: UserRecord; inviteToken: string }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email));
    if (existing) throw new HttpError(409, 'A user with this email already exists');

    const [user] = await tx.insert(users).values(input).returning();
    if (!user) throw new Error('User was not inserted');
    await recordChange(
      tx,
      {
        entityType: 'user',
        entityId: user.id,
        action: 'created',
        changes: diffFields(null, loggedFields(user)),
        countryCode: null,
        changedBy: actor.id,
      },
      clock,
    );
    const inviteToken = await issueAuthToken(tx, { userId: user.id, purpose: 'invite' }, clock);
    return { user, inviteToken };
  });
}

/**
 * Changes a user's name, role, country or active status. Deactivation raises the token version,
 * so the user is signed out at once.
 */
export async function updateUser(
  db: Database,
  id: string,
  update: UpdateUserRequest,
  actor: CurrentUser,
  clock: Clock,
): Promise<UserRecord> {
  return db.transaction(async (tx) => {
    const target = await findOrThrow(tx, id);
    const check = checkUserUpdate(actor.id, target, update);
    if (!check.ok) {
      if (check.field) {
        throw new RequestValidationError([{ field: check.field, message: check.message }]);
      }
      throw new HttpError(400, check.message);
    }

    const deactivating = target.isActive && !check.next.isActive;
    const [updated] = await tx
      .update(users)
      .set({
        ...(update.name === undefined ? {} : { name: update.name }),
        role: check.next.role,
        countryCode: check.next.countryCode,
        isActive: check.next.isActive,
        ...(deactivating ? { tokenVersion: sql`${users.tokenVersion} + 1` } : {}),
        updatedAt: clock.now(),
      })
      .where(eq(users.id, id))
      .returning();
    if (!updated) throw new HttpError(404, 'User not found');

    await recordChange(
      tx,
      {
        entityType: 'user',
        entityId: id,
        action: deactivating ? 'inactivated' : 'updated',
        changes: diffFields(loggedFields(target), loggedFields(updated)),
        countryCode: null,
        changedBy: actor.id,
      },
      clock,
    );
    return updated;
  });
}

/** Creates a new invite token for a user who has not set a password yet. */
export async function reissueInvite(
  db: Database,
  id: string,
  clock: Clock,
): Promise<{ user: UserRecord; inviteToken: string }> {
  const user = await findOrThrow(db, id);
  if (!user.isActive) throw new HttpError(409, 'Reactivate the user before sending an invite');
  if (user.passwordHash !== null) throw new HttpError(409, 'This user has already set a password');
  const inviteToken = await issueAuthToken(db, { userId: user.id, purpose: 'invite' }, clock);
  return { user, inviteToken };
}

/** Change log of one user, newest first, with who made each change. */
export async function userChangeLog(
  db: Database,
  scope: Scope,
  id: string,
): Promise<ChangeLogEntry[]> {
  await findOrThrow(db, id);
  return changeLogFor(db, scope, 'user', id);
}
