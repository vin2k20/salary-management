import { IMPORT_LIMITS, SPREADSHEETS, templateQuerySchema } from '@salary/shared';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { HttpError } from '../../http/errors.ts';
import { parseQuery } from '../../http/validation.ts';
import {
  commitImport,
  validateImport,
  writeTemplate,
  type UploadedFile,
} from './imports.service.ts';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MEGABYTES = String(IMPORT_LIMITS.maxBytes / (1024 * 1024));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_LIMITS.maxBytes, files: 1, fields: 0 },
}).single('file');

/**
 * Receives one file in the "file" field of a multipart request, kept in memory. Uploads must
 * carry the X-Requested-With header, which a cross-site form cannot send, so a multipart body
 * is as safe from cross-site requests as the JSON bodies of other changes (HLD 7).
 */
async function receiveFile(req: Request, res: Response): Promise<UploadedFile> {
  if (req.get('X-Requested-With') !== 'fetch') {
    throw new HttpError(403, 'Upload the file from the app');
  }
  await new Promise<void>((resolve, reject) => {
    upload(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        reject(
          error.code === 'LIMIT_FILE_SIZE'
            ? new HttpError(413, `Choose a file of at most ${MEGABYTES} MB`)
            : new HttpError(400, 'Send one file in the "file" field'),
        );
      } else if (error) {
        reject(error instanceof Error ? error : new Error('Upload failed'));
      } else {
        resolve();
      }
    });
  });
  if (!req.file) throw new HttpError(400, 'Choose a file to import');
  return { name: req.file.originalname, buffer: req.file.buffer };
}

function signedIn(req: Request) {
  if (!req.auth) throw new HttpError(401, 'Sign in to continue');
  return req.auth;
}

/**
 * Import (D20): empty templates, then a file is checked and previewed, and saved in one
 * transaction only when every row is valid. The file is sent for each step, so nothing is
 * stored between them.
 */
export function importsRouter({ db, clock }: { db: Database; clock: Clock }): Router {
  const router = Router();

  router.get('/template', async (req, res) => {
    signedIn(req);
    const { format, dataset } = parseQuery(templateQuerySchema, req.query);
    if (format === 'csv') {
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.attachment(`acme-${SPREADSHEETS[dataset].fileName}-template.csv`);
    } else {
      res.set('Content-Type', XLSX_TYPE);
      res.attachment('acme-import-template.xlsx');
    }
    await writeTemplate(res, format, dataset);
  });

  router.post('/validate', async (req, res) => {
    const { scope } = signedIn(req);
    const file = await receiveFile(req, res);
    res.json(await validateImport(db, scope, file, clock));
  });

  router.post('/commit', async (req, res) => {
    const { user, scope } = signedIn(req);
    const file = await receiveFile(req, res);
    res.json(await commitImport(db, scope, file, user, clock));
  });

  return router;
}
