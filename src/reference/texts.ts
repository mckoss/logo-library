// The reference's text, as the global strings reference.ts reads: this
// package's additions (reference-site.html), then jslogo's language.html.
import site from './reference-site.html?raw';
import guide from 'jslogo/language.html?raw';

self.LOGO_REFERENCE_SITE = site;
self.LOGO_REFERENCE_GUIDE = guide;
