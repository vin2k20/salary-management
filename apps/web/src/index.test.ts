import { describe, expect, it } from 'vitest';
import { APP_TITLE } from './index.ts';

describe('web package', () => {
  it('exports the application title', () => {
    expect(APP_TITLE).toBe('ACME Salary Management');
  });
});
