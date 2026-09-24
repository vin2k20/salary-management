export const CHANGE_LOG_ENTITY_TYPES = ['employee', 'pay_change', 'pay_component', 'user'] as const;

export type ChangeLogEntityType = (typeof CHANGE_LOG_ENTITY_TYPES)[number];

export const CHANGE_LOG_ACTIONS = ['created', 'updated', 'inactivated', 'transferred'] as const;

export type ChangeLogAction = (typeof CHANGE_LOG_ACTIONS)[number];

/** Old and new value of each changed field. A created record has null old values. */
export type FieldChanges = Record<string, { old: unknown; new: unknown }>;
