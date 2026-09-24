import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom lacks a few browser APIs that Radix components use; small stand-ins are enough for tests.
function defineIfMissing(target: object, name: string, value: unknown) {
  if (!(name in target)) {
    Object.defineProperty(target, name, { value, configurable: true, writable: true });
  }
}

defineIfMissing(Element.prototype, 'hasPointerCapture', () => false);
defineIfMissing(Element.prototype, 'releasePointerCapture', () => undefined);
defineIfMissing(Element.prototype, 'scrollIntoView', () => undefined);
defineIfMissing(
  globalThis,
  'ResizeObserver',
  class {
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  },
);
