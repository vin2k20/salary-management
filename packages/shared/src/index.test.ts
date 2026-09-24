import { describe, expect, it } from 'vitest';
import { APP_NAME } from './index.js';

describe('shared package', () => {
  it('exports the application name', () => {
    expect(APP_NAME).toBe('Salary Management');
  });
});
