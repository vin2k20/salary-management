/** The colour themes; light is the default (D61). */
export const THEMES = ['light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

/** Where the browser keeps the choice; public/theme.js reads it before the first paint. */
export const THEME_STORAGE_KEY = 'theme';

/** The theme on the page: dark only when the page says so. */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Shows the page in a theme and remembers it for the next visit. */
export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies until the page closes.
  }
}
