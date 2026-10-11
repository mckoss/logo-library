// <logo-reference hint="…">: the Logo language reference with its search,
// on a page of its own. It builds what the site's logo-reference shortcode
// wrote (a .logo-reference-page holding the reference's section) and sets
// it up with LogoReference.setup, without a place to run examples.
import './index.js';
import { referenceSection } from './markup.js';

const HINT = "Type the start of a command's name to find it.";

export class LogoReferenceElement extends HTMLElement {
  connectedCallback() {
    if (this.started) return;
    this.started = true;
    this.classList.add('logo-reference-page');
    const section = referenceSection(this.getAttribute('hint') ?? HINT);
    this.appendChild(section);
    self.LogoReference.setup(section);
  }
}
