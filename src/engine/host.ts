// What a host page can tell the controls with <meta> tags in its head
// (CONTRACT.md). mckoss.com sets neither; this repo's demo hosts and
// examples, served on mckoss.com's origin at /logo-library/, set both.

// The content of <meta name="NAME">, or '' (also outside a browser, as in
// the unit tests).
function meta(name: string): string {
  if (typeof document === 'undefined') return '';
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content || '';
}

// Where the host serves the Logo pages the controls link to (CONTRACT.md,
// "Paths"): /logo/ on mckoss.com, or another root a page names with
//   <meta name="logo-library-root" content="/logo-library/logo/">
export function logoRoot(): string {
  const root = meta('logo-library-root') || '/logo/';
  return root.endsWith('/') ? root : root + '/';
}

// A page under the root, e.g. logoPath('playground/') is the Playground.
export function logoPath(page = ''): string {
  return logoRoot() + page;
}

// The localStorage key for one of the controls' saved settings or programs
// (CONTRACT.md, "Saved in the browser"): the key itself on mckoss.com, or
// with the prefix a page names with
//   <meta name="logo-library-storage" content="logo-library-demo.">
// so pages sharing mckoss.com's origin keep their own saved programs.
export function storageKey(key: string): string {
  return meta('logo-library-storage') + key;
}
