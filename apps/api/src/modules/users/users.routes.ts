import {
  createUserRequestSchema,
  updateUserRequestSchema,
  userListQuerySchema,
  type ChangeLogResponse,
  type CreateUserResponse,
  type UserListResponse,
} from '@salary/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import type { EmailSender } from '../../email/email-sender.ts';
import { inviteEmail } from '../../email/templates.ts';
import { HttpError } from '../../http/errors.ts';
import { parseBody, parseQuery } from '../../http/validation.ts';
import { requireRole } from '../auth/require-role.ts';
import { listUsers, toUserSummary, type UserRecord } from './users.repository.ts';
import { createUser, reissueInvite, updateUser, userChangeLog } from './users.service.ts';

export interface UsersRouterOptions {
  db: Database;
  clock: Clock;
  emailSender: EmailSender;
  appUrl: string;
}

const idSchema = z.uuid();

function userId(req: Request): string {
  const result = idSchema.safeParse(req.params.id);
  if (!result.success) throw new HttpError(404, 'User not found');
  return result.data;
}

function actor(req: Request) {
  if (!req.auth) throw new HttpError(401, 'Sign in to continue');
  return req.auth.user;
}

/** User management for global HR users (HLD 3.3). */
export function usersRouter({ db, clock, emailSender, appUrl }: UsersRouterOptions): Router {
  const router = Router();
  router.use(requireRole('global_hr', 'Only global HR users can manage users'));

  /** Sends an invite; a failure is logged and reported, and the user can be invited again. */
  async function sendInvite(req: Request, user: UserRecord, token: string): Promise<boolean> {
    const link = new URL(`/set-password?token=${token}`, appUrl).toString();
    try {
      await emailSender.send(inviteEmail(user, actor(req).name, link));
      return true;
    } catch (error) {
      req.log.error({ err: error }, 'Invite email failed');
      return false;
    }
  }

  router.get('/', async (req, res) => {
    const { page, pageSize } = parseQuery(userListQuerySchema, req.query);
    const { rows, total } = await listUsers(db, { page, pageSize });
    const body: UserListResponse = { items: rows.map(toUserSummary), page, pageSize, total };
    res.json(body);
  });

  router.post('/', async (req, res) => {
    const input = parseBody(createUserRequestSchema, req.body);
    const { user, inviteToken } = await createUser(db, input, actor(req), clock);
    const inviteSent = await sendInvite(req, user, inviteToken);
    const body: CreateUserResponse = { user: toUserSummary(user), inviteSent };
    res.status(201).json(body);
  });

  router.patch('/:id', async (req, res) => {
    const id = userId(req);
    const update = parseBody(updateUserRequestSchema, req.body);
    const user = await updateUser(db, id, update, actor(req), clock);
    res.json({ user: toUserSummary(user) });
  });

  router.post('/:id/invite', async (req, res) => {
    const { user, inviteToken } = await reissueInvite(db, userId(req), clock);
    if (!(await sendInvite(req, user, inviteToken))) {
      throw new HttpError(502, 'The invite email could not be sent. Try again later.');
    }
    res.status(204).end();
  });

  router.get('/:id/change-log', async (req, res) => {
    const body: ChangeLogResponse = { items: await userChangeLog(db, userId(req)) };
    res.json(body);
  });

  return router;
}
