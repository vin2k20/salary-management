import { pino, type DestinationStream, type LevelWithSilent, type Logger } from 'pino';

function text(value: object, key: string): string | undefined {
  const field: unknown = key in value ? (value as Record<string, unknown>)[key] : undefined;
  return typeof field === 'string' ? field : undefined;
}

/**
 * An error as logged, from an Error or from pino's serialized form of one. Drizzle puts a failed
 * query's values in its message ("params: ..."), and database errors can repeat values in their
 * details, so only the query, the error names and codes, and the stack frames are kept: the
 * values can be names, emails or pay.
 */
export function logSafeError(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) return error;
  const type = text(error, 'type') ?? text(error, 'name') ?? 'Error';
  const query = text(error, 'query');
  const message = query === undefined ? (text(error, 'message') ?? '') : `Failed query: ${query}`;
  const code = text(error, 'code');
  const stack = text(error, 'stack') ?? '';
  const frames = stack.includes('\n    at ') ? stack.slice(stack.indexOf('\n    at ')) : '';
  const cause = 'cause' in error ? error.cause : undefined;
  return {
    type,
    message,
    ...(code === undefined ? {} : { code }),
    stack: `${type}: ${message}${frames}`,
    ...(cause === undefined ? {} : { cause: logSafeError(cause) }),
  };
}

/** JSON logger. Tests pass their own destination to read the lines back. */
export function createLogger(level: LevelWithSilent, destination?: DestinationStream): Logger {
  return pino(
    {
      level,
      base: { service: 'api' },
      timestamp: pino.stdTimeFunctions.isoTime,
      serializers: { err: logSafeError },
    },
    destination,
  );
}
