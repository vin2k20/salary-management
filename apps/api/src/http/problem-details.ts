import { STATUS_CODES } from 'node:http';
import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { HttpError, RequestValidationError, type FieldError } from './errors.ts';

/** Error response body in the problem details format (RFC 9457). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  requestId?: string;
  /** Validation errors, one per field. */
  errors?: FieldError[];
}

const clientErrorDetails: Record<string, string> = {
  'entity.parse.failed': 'The request body is not valid JSON.',
  'entity.too.large': 'The request body is too large.',
};

export function problem(status: number, instance: string, detail?: string): ProblemDetails {
  return {
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    ...(detail === undefined ? {} : { detail }),
    instance,
  };
}

/** Sends a problem details response, adding the request ID so it can be found in the logs. */
export function sendProblem(res: Response, body: ProblemDetails): void {
  const requestId = res.getHeader('X-Request-Id');
  res
    .status(body.status)
    .type('application/problem+json')
    .json(typeof requestId === 'string' ? { ...body, requestId } : body);
}

export function notFoundHandler(): RequestHandler {
  return (req, res) => {
    sendProblem(res, problem(404, req.path, `No route matches ${req.method} ${req.path}`));
  };
}

/**
 * Turns errors into problem details. Client errors raised by Express middleware keep their
 * status; anything else becomes a 500 without internal details, and the full error is logged.
 */
export function errorHandler(): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof RequestValidationError) {
      sendProblem(res, { ...problem(400, req.path, error.message), errors: error.errors });
      return;
    }
    if (error instanceof HttpError) {
      sendProblem(res, problem(error.status, req.path, error.message));
      return;
    }

    const clientError = asClientError(error);
    if (clientError) {
      sendProblem(res, problem(clientError.status, req.path, clientErrorDetails[clientError.type]));
      return;
    }

    // Logged by the request logger with the request ID; never sent to the client.
    res.err = error instanceof Error ? error : new Error(String(error));
    sendProblem(res, problem(500, req.path));
  };
}

function asClientError(error: unknown): { status: number; type: string } | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return undefined;
  }
  const { status } = error;
  if (typeof status !== 'number' || status < 400 || status >= 500) {
    return undefined;
  }
  const type = 'type' in error && typeof error.type === 'string' ? error.type : '';
  return { status, type };
}
