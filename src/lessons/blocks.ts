// Makes the Logo examples on a lesson page interactive: each ```logo block
// becomes editable with Run, Revert Code, Copy and Open in Playground, and draws
// on its own canvas below. Worksheet rows get a Check button that draws the
// answer in the empty box. Running an example first loads the procedures it
// uses that examples above it on the page define (LogoStage.program).
//
// The <logo-example> and <logo-worksheet> elements (elements.ts) hand each
// example and worksheet row to setup(), in page order.
import type { Stage } from '../engine/index.js';
import { logoPath, storageKey } from '../engine/host.js';

// An example or worksheet row, as LogoStage.program reads it: getters for
// its current (possibly edited) code and the command to run after it.
interface PageExample {
  code: () => string;
  run: () => string;
}

const { LogoStage } = self;
const IMPORT_KEY = storageKey('mckoss.logo.import');

function button(label: string, parent: Element, onClick: (e: MouseEvent) => unknown,
  className?: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'logo-btn' + (className ? ' ' + className : '');
  b.textContent = label;
  b.addEventListener('click', onClick);
  parent.appendChild(b);
  return b;
}

// Every example and worksheet row, in page order: {code, run} getters
// over their current (possibly edited) text.
const examples: PageExample[] = [];
const programFor = (example: PageExample): string => LogoStage.program(
  examples.map(ex => ({ code: ex.code(), run: ex.run() })), examples.indexOf(example));

// All the page's Logo source, for tooltips on procedures defined in
// other examples.
const pageSource = (): string => examples.map(ex => ex.code()).join('\n');

// Toggles a Run button between Run and Stop around one run of a stage.
// With a video name, the run is filmed and saved (stage.runAndRecord).
async function runOn(stage: Stage, runButton: HTMLButtonElement, label: string, source: string,
  video?: string): Promise<void> {
  if (stage.running) {
    stage.stop();
    return;
  }
  runButton.textContent = 'Stop';
  runButton.classList.add('logo-running');
  try {
    if (video) await stage.runAndRecord(source, video);
    else {
      await stage.fresh();
      await stage.run(source);
    }
  } finally {
    runButton.textContent = label;
    runButton.classList.remove('logo-running');
  }
}

function setupExample(block: HTMLElement, index: number): void {
  const code = block.querySelector('code')!;
  const original = code.innerHTML;
  const tryCommand = block.dataset.try || '';
  // (Its view attribute, as WIDTHxHEIGHT.)
  const view = (block.dataset.view || '600x360').split('x').map(Number) as [number, number];

  code.contentEditable = 'plaintext-only';
  code.spellcheck = false;
  code.setAttribute('aria-label', 'Logo program (editable)');


  const bar = document.createElement('div');
  bar.className = 'logo-toolbar';
  block.appendChild(bar);

  let tryInput: HTMLInputElement | null = null;
  if (tryCommand) {
    const label = document.createElement('label');
    label.className = 'logo-try';
    label.textContent = 'Then run ';
    tryInput = document.createElement('input');
    tryInput.value = tryCommand;
    tryInput.spellcheck = false;
    tryInput.setAttribute('aria-label', 'Command to run after the program');
    label.appendChild(tryInput);
    bar.appendChild(label);
  }

  const example: PageExample = {
    code: () => code.textContent,
    run: () => (tryInput ? tryInput.value.trim() : ''),
  };
  examples.push(example);
  const program = () => programFor(example);

  let stage: Stage | null = null;
  let panel: HTMLDivElement | null = null;
  const run = button('Run', bar, async () => {
    if (!stage) {
      panel = document.createElement('div');
      panel.className = 'logo-panel';
      block.after(panel);
      const created = stage = LogoStage.create(panel, { view });
      addStageTools(panel, stage, () => title(block, example, index),
        name => runOn(created, run, 'Run', program(), name));
    }
    await runOn(stage, run, 'Run', program());
  }, 'logo-btn-primary');
  if (tryInput) tryInput.addEventListener('keydown', e => { if (e.key === 'Enter') run.click(); });

  // Revert Code is enabled only while the code or the Then run command
  // differs from the original.
  const originalText = code.textContent;
  const revert = button('Revert Code', bar, () => {
    code.innerHTML = original;
    if (tryInput) tryInput.value = tryCommand;
    revert.disabled = true;
  });
  revert.title = 'Put back the original code and Then run command';
  const changed = () => {
    revert.disabled = code.textContent === originalText && (!tryInput || tryInput.value === tryCommand);
  };
  changed();
  code.addEventListener('input', changed);
  if (tryInput) tryInput.addEventListener('input', changed);

  const copy = button('Copy', bar, () => {
    navigator.clipboard.writeText(code.textContent).then(() => {
      copy.textContent = 'Copied';
      setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
    });
  });

  button('Open in Playground', bar, () => {
    const title = block.dataset.name || lessonTitle(block) || 'Example';
    try {
      localStorage.setItem(IMPORT_KEY, JSON.stringify({ name: title, code: program() }));
    } catch (e) { /* storage blocked: open the playground anyway */ }
    location.href = logoPath('playground/') + '?import';
  });

  bar.appendChild(LogoStage.speedControl());
  LogoReference.attach(code, LogoReference.textLocator(code), pageSource);
}

// The lesson's title: the example's data-lesson (its element's lesson
// attribute), else the page's .post-title, else the document's title.
function lessonTitle(block: HTMLElement): string {
  return (block.dataset.lesson ||
    (document.querySelector('.post-title')?.textContent || '').trim() ||
    document.title || '').trim();
}

// The title for an example's snapshots and recordings: the lesson, then
// the example's name, else the procedure its Then run command calls, else
// the last procedure it defines, else its number on the page.
function title(block: HTMLElement, example: PageExample, index: number): string {
  const lesson = lessonTitle(block);
  const defs = LogoStage.definitions(example.code());
  const what = block.dataset.name || example.run().split(/\s+/)[0] ||
    (defs.length ? defs[defs.length - 1].name : 'Example ' + (index + 1));
  return lesson ? lesson + ' - ' + what : what;
}

// Snapshot saves the stage as it is now. Make Recording starts the
// program over and films the whole run (recordRun(name) runs it); while
// recording, it stops the run and the video with it. During any other
// run, it stops that run and starts a recorded one.
function addStageTools(panel: HTMLElement, stage: Stage, name: () => string,
  recordRun: (name: string) => Promise<void>): void {
  const tools = document.createElement('div');
  tools.className = 'logo-toolbar logo-stage-tools';
  panel.appendChild(tools);
  const snapshot = button('Snapshot', tools, () => stage.download(name()));
  snapshot.title = 'Save a picture of the stage as it is now';
  let recording = false;
  const rec = button('Make Recording', tools, async () => {
    if (recording) {
      stage.stop();
      return;
    }
    await stage.halt();
    recording = true;
    rec.textContent = 'Stop recording';
    try {
      await recordRun(name());
    } finally {
      recording = false;
      rec.textContent = 'Make Recording';
    }
  });
  rec.title = 'Clear the stage and record a video of the program running from start to finish';
  if (!LogoStage.canRecord()) {
    rec.textContent = 'Video not supported';
    rec.disabled = true;
  }
}

function setupWorksheetRow(pre: HTMLElement, box: Element, index: number): void {
  // A row of TO ... END definitions is checked by running its data-check
  // command after them; any other row is run as it stands. (setup() put
  // the row's code in a <span>, its first child.)
  const textEl = pre.firstChild as HTMLElement;
  const example: PageExample = {
    code: () => textEl.textContent,
    run: () => (LogoStage.definitions(textEl.textContent).length ? pre.dataset.check || '' : ''),
  };
  examples.push(example);
  LogoReference.attach(textEl, LogoReference.textLocator(textEl), pageSource);
  let stage: Stage | null = null;
  const bar = document.createElement('div');
  bar.className = 'logo-toolbar';
  bar.setAttribute('aria-label', 'Worksheet answer ' + (index + 1));
  pre.appendChild(bar);
  const run = button('Check', bar, async () => {
    if (!stage) {
      box.textContent = '';
      stage = LogoStage.create(box, { view: [300, 220] });
    }
    await runOn(stage, run, 'Check', programFor(example));
  }, 'logo-btn-primary');
}

// Sets up one example (its .logo-code block) or worksheet row (its <pre>);
// call it for each in page order.
function setup(node: HTMLElement): void {
  if (node.matches('.logo-code')) {
    setupExample(node, examples.length);
  } else {
    // Keep the row's code in its own text node, apart from the toolbar.
    const text = document.createElement('span');
    text.textContent = node.textContent;
    node.textContent = '';
    node.appendChild(text);
    // (The row's box follows it.)
    setupWorksheetRow(node, node.nextElementSibling!, examples.length);
  }
}

export const LogoBlocks = { setup };
