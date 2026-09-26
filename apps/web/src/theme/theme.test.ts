import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentTheme, setTheme } from './theme.ts';

describe('theme', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('is light unless the page says dark', () => {
    expect(currentTheme()).toBe('light');
    document.documentElement.dataset.theme = 'something else';
    expect(currentTheme()).toBe('light');
    document.documentElement.dataset.theme = 'dark';
    expect(currentTheme()).toBe('dark');
  });

  it('sets the theme on the page and remembers it in the browser', () => {
    setTheme('dark');

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(currentTheme()).toBe('dark');
  });

  it('still changes the theme when the browser cannot store it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage is not available');
    });

    setTheme('dark');

    expect(currentTheme()).toBe('dark');
  });
});
