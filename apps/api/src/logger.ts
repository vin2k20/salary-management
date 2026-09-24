import { pino, type DestinationStream, type LevelWithSilent, type Logger } from 'pino';

/** JSON logger. Tests pass their own destination to read the lines back. */
export function createLogger(level: LevelWithSilent, destination?: DestinationStream): Logger {
  return pino(
    {
      level,
      base: { service: 'api' },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  );
}
