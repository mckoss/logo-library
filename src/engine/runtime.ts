// A Logo "stage": a turtle canvas and text output wired to a jslogo
// interpreter with the music commands and the music player library loaded.
//
//   const stage = LogoStage.create(host, { view: [600, 360] });
//   await stage.run('repeat 4 [fd 100 rt 90]');
//
// The view is in turtle steps; the canvas fills the host's width and keeps
// that aspect ratio, drawn at the screen's full resolution.
import { definitions, program } from './program.js';
import { storageKey } from './host.js';
import type { Debugger, DebugMode } from './debug.js';
import type { ViewControls } from './view.js';

// A drawing speed, as the speed menu and the stage options name it.
export type SpeedName = 'instant' | 'fast' | 'slow' | 'crawl';

// Options for LogoStage.create. A stage reads `speed` each time it draws,
// so changing it later takes effect.
export interface StageOptions {
  // The stage's size in turtle steps; default [600, 360].
  view?: [number, number];
  // Where to put the text output; default the stage's host.
  outputHost?: Element;
  // The speed to draw at, overriding the page's speed setting.
  speed?: SpeedName;
}

// A stage, as LogoStage.create returns it.
export interface Stage {
  element: HTMLDivElement;
  output: HTMLPreElement;
  debug: Debugger;
  view: ViewControls;
  logo: LogoInterpreter;
  readonly running: boolean;
  run(source: string, mode?: DebugMode): Promise<boolean>;
  stop(): void;
  halt(): Promise<void>;
  reset(): Promise<void>;
  fresh(): Promise<void>;
  download(title?: string): void;
  record(title?: string): (() => Promise<void>) | null;
  runAndRecord(source: string, title?: string): Promise<boolean | null>;
}

// Turtle steps and degrees per animation frame for each drawing speed.
const SPEEDS: Record<SpeedName, { steps: number; degrees: number } | null> = {
  instant: null,
  fast: { steps: 12, degrees: 18 },
  slow: { steps: 4, degrees: 6 },
  crawl: { steps: 1.5, degrees: 3 },
};
const SPEED_KEY = storageKey('mckoss.logo.speed');
// Whether `value` names a drawing speed.
const isSpeed = (value: string): value is SpeedName => value in SPEEDS;
let saved = 'fast';
try { saved = localStorage.getItem(SPEED_KEY) || saved; } catch (e) { /* storage blocked */ }
let speed: SpeedName = isSpeed(saved) ? saved : 'fast';
const speedListeners = new Set<(value: SpeedName) => void>();

// Sets the page's drawing speed (if `value` names one), remembers it, and
// updates every speed menu.
function setSpeed(value: string) {
  if (!isSpeed(value)) return;
  speed = value;
  try { localStorage.setItem(SPEED_KEY, value); } catch (e) { /* storage blocked */ }
  speedListeners.forEach(fn => fn(value));
}

// A <select> for the drawing speed, kept in sync across the page.
function speedControl() {
  const select = document.createElement('select');
  select.className = 'logo-speed';
  select.setAttribute('aria-label', 'Drawing speed');
  [['instant', 'Instant'], ['fast', 'Fast'], ['slow', 'Slow'], ['crawl', 'Crawl']].forEach(([value, label]) => {
    select.add(new Option(label, value));
  });
  select.value = speed;
  select.addEventListener('change', () => setSpeed(select.value));
  speedListeners.add(value => { select.value = value; });
  return select;
}

const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// A recorded run starts with a moment of the empty stage and ends with a
// moment of the finished drawing.
const LEAD_IN = 500;
const HOLD = 1000;

// The video format this browser can record the stage in, if any.
function videoType() {
  const MediaRecorder = self.MediaRecorder;
  if (!MediaRecorder || !(self.HTMLCanvasElement && HTMLCanvasElement.prototype.captureStream)) return null;
  // Formats that carry the music too come first.
  return ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus',
    'video/mp4', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || null;
}
const canRecord = () => Boolean(videoType());

// A file name for a snapshot or recording: the title, made safe for file
// systems, then the local date and time so no two are named the same,
// like "Pumpkin 2026-10-08 14.05.32".
function fileName(title?: string) {
  const clean = String(title || '').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').trim();
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, '0');
  return (clean || 'Logo drawing') + ' ' + d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) +
    ' ' + two(d.getHours()) + '.' + two(d.getMinutes()) + '.' + two(d.getSeconds());
}

// A new element of the kind `tag`, with a class, added to a parent.
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string | null,
  parent?: Element | null): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (parent) parent.appendChild(node);
  return node;
}

// Makes a stage in `host` (see the top of this file).
function create(host: Element, options: StageOptions = {}): Stage {
  const [viewW, viewH] = options.view || [600, 360];
  const stageEl = el('div', 'logo-stage', host);
  stageEl.style.aspectRatio = viewW + ' / ' + viewH;
  const sandbox = el('canvas', 'logo-sandbox', stageEl);
  const sprite = el('canvas', 'logo-sprite', stageEl);
  const output = el('pre', 'logo-output', options.outputHost || host);
  output.hidden = true;

  // The canvases match the stage's size in screen pixels; LogoView maps
  // jslogo's viewW x viewH world onto them and handles zoom and pan.
  const cssWidth = stageEl.clientWidth || viewW;
  const scale = cssWidth / viewW * (self.devicePixelRatio || 1);
  [sandbox, sprite].forEach(c => {
    c.width = Math.round(viewW * scale);
    c.height = Math.round(viewH * scale);
  });
  const view = self.LogoView.attach(stageEl, sandbox, sprite, viewW, viewH);

  const write = (text: string) => {
    output.hidden = false;
    output.textContent += text;
    output.scrollTop = output.scrollHeight;
  };
  const stream: JSLogo.Stream = {
    read: s => Promise.resolve(self.prompt(s || '') || ''),
    write: (...args) => { args.forEach(a => write(String(a))); return Promise.resolve(); },
    clear: () => { output.textContent = ''; output.hidden = true; return Promise.resolve(); },
    readback: () => Promise.resolve(output.textContent),
    textsize: 13, font: 'monospace', color: 'black',
  };

  const turtle = new self.CanvasTurtle(view.drawing, view.sprite, viewW, viewH, null);
  view.bind(turtle);
  turtle.turtlemode = 'window';  // draw past the edges; the view zooms out to follow
  turtle.penwidth = 1.5;

  // Animate moves and turns at the chosen speed by breaking them into
  // per-frame steps. Stopping ends the current move early.
  let stopped = false;
  const move = turtle.move.bind(turtle);
  const turn = turtle.turn.bind(turtle);
  async function animate(amount: number, step: number, apply: (part: number) => void) {
    let left = Math.abs(amount);
    const sign = Math.sign(amount);
    while (left > 0 && !stopped) {
      const part = Math.min(step, left);
      apply(sign * part);
      left -= part;
      if (left > 0) await frame();
    }
  }
  // options.speed, if given, overrides the page's speed setting.
  turtle.move = distance => {
    const s = SPEEDS[options.speed || speed];
    return s ? animate(distance, s.steps, move) : move(distance);
  };
  turtle.turn = angle => {
    const s = SPEEDS[options.speed || speed];
    return s ? animate(angle, s.degrees, turn) : turn(angle);
  };

  const logo = new self.LogoInterpreter(turtle, stream, () => {});
  // "rainbow", a color word of this site's: each time the pen is set to
  // it, the pen takes the next color round the rainbow (red after any
  // color that isn't in it).
  const RAINBOW = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
  logo.colorAlias = name => (String(name).toLowerCase() === 'rainbow'
    ? RAINBOW[(RAINBOW.indexOf(turtle.color) + 1) % RAINBOW.length]
    : null);
  self.LogoMusic.install(logo);
  const debug = self.LogoDebug.attach(logo, turtle);
  const ready = logo.run(self.LOGO_LIBRARY || '').then(() => logo.run('cs'));

  let running = 0;
  const stage: Stage = {
    element: stageEl,
    output,
    debug,
    view: view.controls,
    logo,
    get running() { return running > 0; },

    // Runs Logo source; resolves when it finishes, reports errors in the
    // output area, and resolves false if it failed or was stopped.
    // mode 'step' pauses before the first command (see LogoDebug).
    async run(source, mode = 'run') {
      await ready;
      debug.start(mode);
      stopped = false;
      running++;
      try {
        await logo.run(source);
        view.controls.settle();
        return !stopped;
      } catch (err) {
        if (!stopped) write((output.textContent && !output.textContent.endsWith('\n') ? '\n' : '') +
          (err && (err as Error).message ? (err as Error).message : String(err)) + '\n');
        output.classList.toggle('logo-error', !stopped);
        return false;
      } finally {
        running--;
      }
    },

    stop() {
      stopped = true;
      debug.stop();
      // (Only while something runs: jslogo keeps the stop until the next
      // command, so with nothing running it would stop that instead.)
      if (running) logo.bye();
      self.LogoMusic.stop();
    },

    // Stops any run and resolves once it has wound down.
    async halt() {
      stage.stop();
      while (running) await wait(20);
    },

    // Clears the screen and the output, keeping everything else.
    async reset() {
      await ready;
      debug.start('run');
      output.classList.remove('logo-error');
      await logo.run('cs ct');
    },

    // A fresh start for a run: the default pen and turtle, no procedures
    // or variables left from earlier runs (the music player is reloaded),
    // and a cleared screen and output.
    async fresh() {
      await ready;
      debug.start('run');
      self.LogoMusic.stop();
      Object.assign(turtle, {
        pendown: true, penmode: 'paint', penwidth: 1.5, color: '#000000',
        bgcolor: '#ffffff', visible: true, turtlemode: 'window',
        fontsize: 14, fontname: 'sans-serif',
      });
      output.classList.remove('logo-error');
      await logo.run('erall');
      await logo.run(self.LOGO_LIBRARY || '');
      await logo.run('cs ct');
    },

    // Saves the drawing as a PNG, without the turtle, named for the title
    // and the time (fileName).
    download(title) {
      const name = fileName(title);
      // (toBlob gives null only for a canvas with no pixels, which a
      // stage's never is.)
      sandbox.toBlob(blob => save(blob!, name + '.png'));
    },

    // Records the canvas, turtle included, and the music until the
    // returned function is called; that function resolves once the video
    // has been saved, named like a snapshot.
    record(title) {
      const type = videoType();
      if (!type) return null;
      const name = fileName(title);
      const film = document.createElement('canvas');
      film.width = sandbox.width;
      film.height = sandbox.height;
      const ctx = film.getContext('2d')!;
      let filming = true;
      (function paint() {
        ctx.drawImage(sandbox, 0, 0);
        ctx.drawImage(sprite, 0, 0);
        if (filming) requestAnimationFrame(paint);
      }());
      // The music goes on the video's sound track.
      const music = self.LogoMusic.capture();
      const tracks = film.captureStream(30).getVideoTracks();
      if (music) tracks.push(...music.stream.getAudioTracks());
      const recorder = new self.MediaRecorder(new MediaStream(tracks), { mimeType: type });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise<void>(resolve => {
        recorder.onstop = () => {
          filming = false;
          if (music) music.end();
          const ext = type.startsWith('video/mp4') ? '.mp4' : '.webm';
          save(new Blob(chunks, { type: type.split(';')[0] }), name + ext);
          resolve();
        };
      });
      recorder.start();
      return () => { recorder.stop(); return done; };
    },

    // Clears the stage and films a fresh run of source, from the empty
    // stage until a moment after the run ends or is stopped, then saves
    // the video. The stage counts as running throughout. Resolves like
    // run, or null without running if this browser can't record video.
    async runAndRecord(source, title) {
      if (!videoType()) return null;
      // Start the sound while this is still part of the click.
      self.LogoMusic.unlock();
      running++;
      let finish: (() => Promise<void>) | null = null;
      try {
        await stage.fresh();
        finish = stage.record(title);
        stopped = false;
        await wait(LEAD_IN);
        const ok = !stopped && await stage.run(source);
        await wait(HOLD);
        return ok;
      } finally {
        if (finish) await finish();
        running--;
      }
    },
  };
  return stage;
}

// Saves `blob` as a download named `filename`.
function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const api = { create, save, definitions, program, speedControl, setSpeed, canRecord };
// LogoStage, the global.
export type LogoStageApi = typeof api;
self.LogoStage = api;
