import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';

const requestIdPattern = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Logs one line per request and gives every request an ID, returned in the X-Request-Id header.
 * Only the method, path and status are logged: query strings and headers can hold personal data
 * or credentials.
 */
export function requestLogger(
  logger: Logger,
  generateRequestId: () => string = randomUUID,
): RequestHandler {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && requestIdPattern.test(incoming)
          ? incoming
          : generateRequestId();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    serializers: {
      req: (req: { id: unknown; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        path: req.url.split('?')[0],
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    customLogLevel: (_req, res, error) => {
      if (error !== undefined || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  });
}
