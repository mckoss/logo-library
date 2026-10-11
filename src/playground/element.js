// <logo-playground>: the whole Logo Playground. The element is the
// playground (class logo-playground, as the shortcode's <div> was): it
// builds the shortcode's markup in front of the host's
// <script type="application/json" class="pg-examples-data"> (the Examples
// folder) and calls LogoPlayground.init on itself.
import '../engine/index.js';
import '../reference/index.js';
import { LogoPlayground } from './playground.js';
import { playgroundMarkup } from './markup.js';

export class LogoPlaygroundElement extends HTMLElement {
  connectedCallback() {
    if (this.started) return;
    this.started = true;
    const start = () => {
      this.classList.add('logo-playground');
      const data = this.querySelector('script.pg-examples-data') ||
        this.querySelector('script[type="application/json"]');
      if (data) data.classList.add('pg-examples-data');
      this.prepend(playgroundMarkup());
      LogoPlayground.init(this);
    };
    // The examples are the element's content: wait for the page to be parsed.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
}
