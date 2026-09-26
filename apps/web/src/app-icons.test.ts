import { describe, expect, it } from 'vitest';
import indexHtml from '../index.html?raw';

/** Files served as they are from public/, by their address. */
const publicFiles = Object.keys(
  import.meta.glob('../public/*', { eager: true, query: '?url', import: 'default' }),
).map((path) => path.replace('../public', ''));

function iconLinks() {
  const page = new DOMParser().parseFromString(indexHtml, 'text/html');
  return Array.from(page.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')).map(
    (link) => ({
      rel: link.getAttribute('rel'),
      href: link.getAttribute('href'),
      type: link.getAttribute('type'),
      sizes: link.getAttribute('sizes'),
    }),
  );
}

describe('app icon', () => {
  it('is linked as a scalable icon, a 32 pixel icon and a home screen icon', () => {
    expect(iconLinks()).toEqual([
      { rel: 'icon', href: '/favicon.ico', type: null, sizes: '32x32' },
      { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml', sizes: null },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', type: null, sizes: null },
    ]);
  });

  it('is served from the app itself for every link', () => {
    for (const link of iconLinks()) {
      expect(publicFiles).toContain(link.href);
    }
  });
});
