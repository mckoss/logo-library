import { afterEach, describe, expect, it, vi } from 'vitest';
import { logoPath, logoRoot, storageKey } from '../../src/engine/host.js';

// A page whose head has these <meta name=… content=…> tags.
function page(metas: Record<string, string>) {
  vi.stubGlobal('document', {
    querySelector: (selector: string) => {
      const name = /meta\[name="([^"]+)"\]/.exec(selector)?.[1] ?? '';
      return name in metas ? { content: metas[name] } : null;
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('host settings', () => {
  it('outside a browser, uses /logo/ and the frozen keys as they are', () => {
    expect(logoRoot()).toBe('/logo/');
    expect(storageKey('mckoss.logo.files')).toBe('mckoss.logo.files');
  });

  it('on a page that sets nothing (mckoss.com), the same', () => {
    page({});
    expect(logoPath('playground/')).toBe('/logo/playground/');
    expect(storageKey('mckoss.logo.tiles')).toBe('mckoss.logo.tiles');
  });

  it('follows the page: another root, and a prefix for the storage keys', () => {
    page({ 'logo-library-root': '/logo-library/logo', 'logo-library-storage': 'logo-library-demo.' });
    expect(logoRoot()).toBe('/logo-library/logo/');
    expect(logoPath()).toBe('/logo-library/logo/');
    expect(storageKey('mckoss.logo.files')).toBe('logo-library-demo.mckoss.logo.files');
  });
});
