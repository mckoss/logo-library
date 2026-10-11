// Where the host serves the Logo pages the controls link to (CONTRACT.md,
// "Paths"): /logo/ on mckoss.com, or another root a page names with
//   <meta name="logo-library-root" content="/logo-library/logo/">
// (the demo hosts on GitHub Pages, served under /logo-library/).
export function logoRoot(doc: Document = document): string {
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="logo-library-root"]');
  const root = meta?.content || '/logo/';
  return root.endsWith('/') ? root : root + '/';
}

// A page under the root, e.g. logoPath('playground/') is the Playground.
export function logoPath(page = '', doc: Document = document): string {
  return logoRoot(doc) + page;
}
