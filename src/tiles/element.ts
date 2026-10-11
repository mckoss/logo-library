// <turtle-tiles>: Turtle Tiles, filling its box. The element is the app's
// root, as the site's <main class="turtle-tiles" data-version> was: it takes
// that class and this package's version, and the main landmark role unless
// the host gave it a role or put it inside a <main>, then calls
// LogoTiles.init on itself.
import '../engine/index.js';
import { LogoTiles } from './tiles.js';
import { version } from '../version.js';

export class TurtleTiles extends HTMLElement {
  // Whether it has started (connecting again, after a move, doesn't start
  // it again).
  private started = false;

  connectedCallback() {
    if (this.started) return;
    this.started = true;
    this.classList.add('turtle-tiles');
    this.dataset.version = version;
    if (!this.hasAttribute('role') && !this.closest('main')) this.setAttribute('role', 'main');
    LogoTiles.init(this);
  }
}
