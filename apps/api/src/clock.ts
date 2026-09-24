/** Source of the current time. Passed in, so tests can fix it. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Today's date in UTC (YYYY-MM-DD), the date pay and rates are read on. */
export function todayOn(clock: Clock): string {
  return clock.now().toISOString().slice(0, 10);
}
