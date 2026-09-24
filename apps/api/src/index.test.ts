import { describe, expect, it } from 'vitest';
import { SERVICE_NAME } from './index.ts';

describe('api package', () => {
  it('exports the service name', () => {
    expect(SERVICE_NAME).toBe('salary-management-api');
  });
});
