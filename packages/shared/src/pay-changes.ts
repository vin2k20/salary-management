/** Why pay changed. "hire" sets starting pay; "transfer" restarts pay after a move between countries. */
export const PAY_CHANGE_REASONS = [
  'hire',
  'promotion',
  'revision',
  'correction',
  'import',
  'transfer',
] as const;

export type PayChangeReason = (typeof PAY_CHANGE_REASONS)[number];
