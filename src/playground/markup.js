// The Playground's markup, as the site's logo-playground shortcode wrote it
// (with the logo-version partial and the reference's section);
// LogoPlayground.init brings it to life.
import { referenceSection } from '../reference/markup.js';
import { version } from '../version.js';

const HINT = 'Click an example to run it in the command line. Hover over a word in any program to see what it does.';

export function playgroundMarkup() {
  const template = document.createElement('template');
  template.innerHTML = `
  <div class="pg-sidebar">
    <h2 class="pg-heading">My Programs</h2>
    <ul class="pg-list pg-files"></ul>
    <div class="logo-toolbar pg-file-tools">
      <button type="button" class="logo-btn pg-new">New</button>
      <button type="button" class="logo-btn pg-copy pg-needs-program">Copy</button>
      <button type="button" class="logo-btn pg-rename pg-needs-file">Rename</button>
      <button type="button" class="logo-btn pg-delete pg-needs-file">Delete</button>
      <button type="button" class="logo-btn pg-download pg-needs-program">Download</button>
      <button type="button" class="logo-btn pg-open">Open file…</button>
      <input type="file" class="pg-file-input" accept=".lgo,.logo,.txt,text/plain" multiple hidden>
    </div>
    <p class="pg-notice" hidden>This browser isn't letting the page save, so programs will be lost when you leave. Use Download to keep them.</p>
    <h2 class="pg-heading">Examples</h2>
    <div class="pg-examples"></div>
  </div>
  <div class="pg-main">
    <div class="pg-titlebar">
      <h2 class="pg-name"></h2>
      <p class="pg-example-note" hidden>An example from <a class="pg-example-link" href="">the lesson</a>. Use Copy to make your own version to change.</p>
    </div>
    <textarea class="pg-editor" wrap="off" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Program"></textarea>
    <div class="logo-toolbar">
      <button type="button" class="logo-btn logo-btn-primary pg-vcr pg-run pg-needs-program">Play</button>
      <button type="button" class="logo-btn pg-vcr pg-stop" disabled>Stop</button>
      <button type="button" class="logo-btn pg-vcr pg-step pg-needs-program">Step</button>
      <button type="button" class="logo-btn pg-vcr pg-clear">Reset</button>
      <span class="pg-speed"></span>
      <span class="pg-hint">Ctrl+Enter plays the program</span>
    </div>
    <div class="pg-breaks" hidden>
      <span class="pg-breaks-label">Break at:</span>
      <span class="pg-breaks-list"></span>
    </div>
    <div class="pg-debug" hidden aria-live="polite">
      <div class="pg-debug-head">
        <span class="pg-debug-where"></span>
      </div>
      <div class="pg-debug-calls"></div>
      <div class="pg-debug-grid">
        <div><h3>Inputs and local variables</h3><dl class="pg-debug-locals"></dl></div>
        <div><h3>Global variables</h3><dl class="pg-debug-globals"></dl></div>
        <div><h3>Turtle</h3><dl class="pg-debug-turtle"></dl></div>
      </div>
    </div>
    <div class="pg-stage"></div>
    <input class="pg-command" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="Type a command and press Enter, like: fd 50 rt 90" aria-label="Command">
    <div class="pg-output"></div>
    <div class="logo-toolbar">
      <button type="button" class="logo-btn pg-image" title="Save a picture of the stage as it is now">Snapshot</button>
      <button type="button" class="logo-btn pg-record pg-needs-program" title="Clear the stage and record a video of the program running from start to finish">Make Recording</button>
    </div>
    <p class="logo-version"></p>
  </div>
  `;
  const markup = template.content;
  markup.querySelector('.logo-version').textContent = 'Logo v' + version;
  markup.appendChild(referenceSection(HINT));
  return markup;
}
