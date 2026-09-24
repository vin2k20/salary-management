import {
  createEmployeeRequestSchema,
  employeeListQuerySchema,
  updateEmployeeRequestSchema,
  type ChangeLogResponse,
  type EmployeeResponse,
} from '@salary/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { HttpError } from '../../http/errors.ts';
import { parseBody, parseQuery } from '../../http/validation.ts';
import { changeLogFor } from '../change-log/change-log.ts';
import {
  createEmployee,
  findEmployeeOrThrow,
  toEmployee,
  updateEmployee,
} from './employee-record.service.ts';
import { employeeDirectory } from './employees.service.ts';
import { referenceData } from './reference.service.ts';

const idSchema = z.uuid();

function employeeId(req: Request): string {
  const result = idSchema.safeParse(req.params.id);
  if (!result.success) throw new HttpError(404, 'Employee not found');
  return result.data;
}

function signedIn(req: Request) {
  if (!req.auth) throw new HttpError(401, 'Sign in to continue');
  return req.auth;
}

export function employeesRouter({ db, clock }: { db: Database; clock: Clock }): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parseQuery(employeeListQuerySchema, req.query);
    res.json(await employeeDirectory(db, signedIn(req).scope, query, clock));
  });

  router.post('/', async (req, res) => {
    const { user, scope } = signedIn(req);
    const input = parseBody(createEmployeeRequestSchema, req.body);
    const body: EmployeeResponse = {
      employee: await createEmployee(db, scope, input, user, clock),
    };
    res.status(201).json(body);
  });

  router.get('/:id', async (req, res) => {
    const row = await findEmployeeOrThrow(db, signedIn(req).scope, employeeId(req));
    const body: EmployeeResponse = { employee: toEmployee(row) };
    res.json(body);
  });

  router.patch('/:id', async (req, res) => {
    const { user, scope } = signedIn(req);
    const id = employeeId(req);
    const update = parseBody(updateEmployeeRequestSchema, req.body);
    const body: EmployeeResponse = {
      employee: await updateEmployee(db, scope, id, update, user, clock),
    };
    res.json(body);
  });

  router.get('/:id/change-log', async (req, res) => {
    const { scope } = signedIn(req);
    const row = await findEmployeeOrThrow(db, scope, employeeId(req));
    const body: ChangeLogResponse = { items: await changeLogFor(db, scope, 'employee', row.id) };
    res.json(body);
  });

  return router;
}

/** Filter choices within the caller's scope; they change rarely, so browsers may reuse them. */
export function referenceRouter({ db }: { db: Database }): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    if (!req.auth) throw new HttpError(401, 'Sign in to continue');
    res.set('Cache-Control', 'private, max-age=300').json(await referenceData(db, req.auth.scope));
  });

  return router;
}
