import { describe, expect, it } from 'vitest';
import vercel from '../../../vercel.json';

/** The headers Vercel sends with the web app's pages, from vercel.json. */
function pageHeaders(path: string): Record<string, string> {
  const rule = vercel.headers.find((entry) => new RegExp(`^${entry.source}$`).test(path));
  return Object.fromEntries((rule?.headers ?? []).map((header) => [header.key, header.value]));
}

describe('security headers for the web app', () => {
  it('allow scripts, styles and requests from the app itself only', () => {
    const policy = pageHeaders('/employees')['Content-Security-Policy'] ?? '';
    const directives = Object.fromEntries(
      policy.split(';').map((part) => {
        const [name = '', ...values] = part.trim().split(/\s+/);
        return [name, values.join(' ')];
      }),
    );

    expect(directives).toMatchObject({
      'default-src': "'self'",
      'script-src': "'self'",
      'connect-src': "'self'",
      'object-src': "'none'",
      'frame-ancestors': "'none'",
      'base-uri': "'self'",
      'form-action': "'self'",
    });
    // Radix writes small style elements to lock page scrolling under dialogs and menus.
    expect(directives['style-src']).toBe("'self' 'unsafe-inline'");
  });

  it('stop framing, type sniffing, referrer leaks and unused browser features', () => {
    expect(pageHeaders('/')).toMatchObject({
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Opener-Policy': 'same-origin',
    });
    expect(pageHeaders('/')['Permissions-Policy']).toContain('camera=()');
  });

  it('leave API responses to the API, which sets its own headers', () => {
    expect(pageHeaders('/api/employees')).toEqual({});
  });
});
