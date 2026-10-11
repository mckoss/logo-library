// <logo-example> and <logo-worksheet>: a lesson's runnable examples and its
// worksheets. Each becomes the wrapper the site's templates wrote around the
// same content (partials/logo-code.html's .logo-code block, the
// logo-worksheet shortcode's .logo-worksheet), then hands each example and
// worksheet row to LogoBlocks.setup.
//
// The site set up every example and row on a page at once, in page order
// (an example can use the procedures examples above it define, and unnamed
// ones are numbered by position). Elements connect one at a time, and all
// <logo-example>s are upgraded before any <logo-worksheet> when the two
// are defined, so connected elements are queued and set up together, in
// page order: after the page has been parsed, as the site's script did on
// DOMContentLoaded, or a moment after they connect if it has.
import '../engine/index.js';
import '../reference/index.js';
import { LogoBlocks } from './blocks.js';

const queue: LessonElement[] = [];
let scheduled = false;

function flush(): void {
  scheduled = false;
  const elements = queue.splice(0).filter(el => el.isConnected);
  elements.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  elements.forEach(el => el.build().forEach(node => LogoBlocks.setup(node)));
}

function enqueue(el: LessonElement): void {
  queue.push(el);
  if (scheduled) return;
  scheduled = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', flush, { once: true });
  else queueMicrotask(flush);
}

abstract class LessonElement extends HTMLElement {
  // Set when first connected: the element is queued and set up only once.
  private started = false;

  connectedCallback(): void {
    if (this.started) return;
    this.started = true;
    enqueue(this);
  }

  // Makes the element the wrapper the site wrote; returns the examples and
  // worksheet rows in it, for LogoBlocks.setup.
  abstract build(): HTMLElement[];
}

// <logo-example try="…" view="600x360" name="…" lesson="…"><pre><code>…</code></pre></logo-example>
export class LogoExample extends LessonElement {
  // The element is the example's block, as partials/logo-code.html's
  // <div class="logo-code" data-try data-view data-name> was: it takes that
  // class and those data attributes (and data-lesson). The toolbar goes in
  // it, and the stage, once the example runs, after it.
  build(): HTMLElement[] {
    this.classList.add('logo-code');
    ['try', 'view', 'name', 'lesson'].forEach(attr => {
      const value = this.getAttribute(attr);
      if (value) this.dataset[attr] = value;
    });
    return [this];
  }
}

// <logo-worksheet><pre data-check="…">…</pre><div class="logo-box"></div>…</logo-worksheet>
export class LogoWorksheet extends LessonElement {
  // The element is the worksheet (class logo-worksheet); each <pre> is a row
  // and the box after it is where its Check draws.
  build(): HTMLElement[] {
    this.classList.add('logo-worksheet');
    return [...this.querySelectorAll('pre')];
  }
}
