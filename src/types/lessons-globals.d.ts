// The globals the reference publishes (src/reference/), for the code that
// uses them: the lessons' code blocks, the playground, and the e2e tests
// through `window`. Declared with `var`, so they're typed as
// `self.LogoReference`, `window.LogoReference` and plain `LogoReference`
// alike:
//
//   LogoReference.attach(code, LogoReference.textLocator(code));
import type { LogoReferenceApi } from '../reference/reference.js';

declare global {
  // The language reference: its rendering and search, lookups, and the
  // tooltips for words in Logo programs.
  var LogoReference: LogoReferenceApi;
  // The reference's text, which texts.ts sets before reference.ts reads
  // it: this package's additions (reference-site.html), and jslogo's
  // language.html.
  var LOGO_REFERENCE_SITE: string;
  var LOGO_REFERENCE_GUIDE: string;
}

export {};
