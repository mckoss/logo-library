// The Logo Playground: an editor, a command line and a turtle stage, with
// named programs saved in this browser's localStorage. Programs can be
// created, copied, renamed, deleted, downloaded as .lgo files and opened
// from files.
//
// The <logo-playground> element (element.ts) builds the markup and calls
// init() on it. The saved programs' format, the Examples folder and the
// other logic that needs no page are in model.ts.
import {
  IMPORT_KEY, FILES_KEY, isImport, load, names as sortedNames, openable, procedureNames, starterState,
  uniqueName as uniqueNameIn,
} from './model.js';
import type { LessonData, OpenExample } from './model.js';
import type { PauseInfo } from '../engine/index.js';

const { LogoStage } = self;

// How a run starts: plainly, paused before the first command, or filmed.
type RunMode = 'run' | 'step' | 'record';

// Brings the Playground's markup (markup.ts) in `root` to life.
function init(root: HTMLElement) {
  const loaded = load();
  let storageOK = loaded.stored;
  const state = loaded.state || starterState();

  function persist() {
    if (!storageOK) return;
    try {
      localStorage.setItem(FILES_KEY, JSON.stringify(state));
    } catch (e) {
      storageOK = false;
      notice.hidden = false;
    }
  }

  // The element in the markup that `sel` finds (the markup has every one
  // this file asks for).
  const $ = <E extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<E>(sel)!;
  const list = $<HTMLUListElement>('.pg-files');
  const editor = $<HTMLTextAreaElement>('.pg-editor');
  const nameEl = $('.pg-name');
  const command = $<HTMLInputElement>('.pg-command');
  const runBtn = $<HTMLButtonElement>('.pg-run');
  const rec = $<HTMLButtonElement>('.pg-record');
  const notice = $('.pg-notice');
  const exampleNote = $('.pg-example-note');
  const exampleLink = $<HTMLAnchorElement>('.pg-example-link');
  notice.hidden = storageOK;
  if (!LogoStage.canRecord()) {
    rec.textContent = 'Video not supported';
    rec.classList.remove('pg-needs-program');
    rec.disabled = true;
  }
  $('.pg-speed').appendChild(LogoStage.speedControl());

  const stage = LogoStage.create($('.pg-stage'), { view: [600, 400], outputHost: $('.pg-output') });

  // The programs' names, in order, and a name for a new one (see model.ts).
  const names = () => sortedNames(state.files);
  const uniqueName = (base?: string | null) => uniqueNameIn(state.files, base);

  // The read-only examples from the lessons, built into the page as JSON:
  // [{lesson, url, examples: [{name, code, run}]}]. An open example is shown
  // in place of the current program until a program is opened again.
  let data: LessonData[] = [];
  try { data = JSON.parse($('.pg-examples-data').textContent!); } catch (e) { /* none */ }
  // Each example made a complete program, without repeats (model.ts).
  const lessons = openable(data);
  let example: OpenExample | null = null;

  // A button in a list of programs or examples.
  function fileButton(label: string, current: boolean, onClick: () => void) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (current) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', onClick);
    li.appendChild(b);
    return li;
  }

  function renderExamples() {
    const host = $('.pg-examples');
    host.textContent = '';
    lessons.forEach(lesson => {
      const group = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = lesson.lesson + ' ';
      // A link to the lesson, beside its name (the name opens the folder).
      const link = document.createElement('a');
      link.className = 'pg-lesson-link';
      link.href = lesson.url;
      link.textContent = '\u2197';
      link.title = 'Read the lesson';
      link.setAttribute('aria-label', 'Read the lesson: ' + lesson.lesson);
      summary.appendChild(link);
      group.appendChild(summary);
      const ul = document.createElement('ul');
      ul.className = 'pg-list';
      lesson.examples.forEach(ex => {
        ul.appendChild(fileButton(ex.name, ex === example, () => openExample(ex)));
        if (ex === example) group.open = true;
      });
      group.appendChild(ul);
      host.appendChild(group);
    });
  }

  function render() {
    list.textContent = '';
    names().forEach(name => {
      list.appendChild(fileButton(name, !example && name === state.current, () => open(name)));
    });
    renderExamples();
    const mine = !example && Boolean(state.current);
    nameEl.textContent = example ? example.name : state.current || '';
    exampleNote.hidden = !example;
    if (example) exampleLink.href = example.url;
    editor.disabled = !example && !state.current;
    editor.readOnly = Boolean(example);
    root.querySelectorAll<HTMLButtonElement>('.pg-needs-file').forEach(b => { b.disabled = !mine; });
    root.querySelectorAll<HTMLButtonElement>('.pg-needs-program').forEach(b => { b.disabled = !mine && !example; });
  }

  // Opens the program `name` (or, with null, nothing).
  function open(name: string | null) {
    example = null;
    state.current = name;
    editor.value = name ? state.files[name] : '';
    persist();
    render();
    root.dispatchEvent(new Event('logo-opened'));
  }

  // Opens an example, read-only.
  function openExample(ex: OpenExample) {
    example = ex;
    editor.value = ex.code;
    render();
    root.dispatchEvent(new Event('logo-opened'));
  }

  // The name and code of whatever is open, program or example. (Only the
  // buttons that need a program call it, and they're disabled when
  // nothing is open.)
  const opened = () => example
    ? { name: example.name, code: example.code }
    : { name: state.current as string, code: state.files[state.current as string] };

  // Adds a program, under a name no other has, and opens it.
  function add(name: string | null | undefined, code: string) {
    name = uniqueName(name);
    state.files[name] = code;
    open(name);
    return name;
  }

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  editor.addEventListener('input', () => {
    if (example || !state.current) return;
    state.files[state.current] = editor.value;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 300);
  });
  // Tab inserts two spaces instead of leaving the editor.
  editor.addEventListener('keydown', e => {
    if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      editor.setRangeText('  ', editor.selectionStart, editor.selectionEnd, 'end');
      editor.dispatchEvent(new Event('input'));
    }
  });

  $('.pg-new').addEventListener('click', () => {
    const name = self.prompt('Name for the new program:', uniqueName('Untitled'));
    if (name !== null) add(name, '');
    editor.focus();
  });
  $('.pg-copy').addEventListener('click', () => {
    const { name: from, code } = opened();
    const name = self.prompt('Name for the copy:', uniqueName(example ? from : from + ' copy'));
    if (name !== null) add(name, code);
  });
  // (Rename and Delete are enabled only while a program is open.)
  $('.pg-rename').addEventListener('click', () => {
    const old = state.current as string;
    const name = (self.prompt('Rename "' + old + '" to:', old) || '').trim();
    if (!name || name === old) return;
    if (name in state.files) {
      self.alert('There is already a program called "' + name + '".');
      return;
    }
    state.files[name] = state.files[old];
    delete state.files[old];
    open(name);
  });
  $('.pg-delete').addEventListener('click', () => {
    if (!self.confirm('Delete "' + state.current + '"? This can\'t be undone.')) return;
    delete state.files[state.current as string];
    open(names()[0] || null);
  });
  $('.pg-download').addEventListener('click', () => {
    const { name, code } = opened();
    LogoStage.save(new Blob([code.replace(/\r?\n/g, '\r\n')], { type: 'text/plain' }), name + '.lgo');
  });
  const fileInput = $<HTMLInputElement>('.pg-file-input');
  $('.pg-open').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    for (const file of fileInput.files!) {
      add(file.name.replace(/\.(lgo|logo|txt)$/i, ''), (await file.text()).replace(/\r\n?/g, '\n'));
    }
    fileInput.value = '';
  });

  // The controls, like a tape player's: Play (Pause while a program
  // runs, which stops before its next command and shows the step panel;
  // Play again carries on), Stop, Step (one command at a time) and Reset
  // (stop, and clear the stage).
  const icon = (body: string) => `<svg viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
  const ICONS = {
    play: icon('<path d="M20 12 L52 32 L20 52 Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>'),
    pause: icon('<rect x="15" y="12" width="12" height="40" rx="3" fill="currentColor"/>' +
      '<rect x="37" y="12" width="12" height="40" rx="3" fill="currentColor"/>'),
    stop: icon('<rect x="14" y="14" width="36" height="36" rx="4" fill="currentColor"/>'),
    step: icon('<path d="M12 14 L40 32 L12 50 Z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>' +
      '<rect x="44" y="14" width="8" height="36" rx="2" fill="currentColor"/>'),
    reset: icon('<g transform="rotate(-35 32 30)"><rect x="12" y="18" width="40" height="24" rx="4" fill="none" ' +
      'stroke="currentColor" stroke-width="5"/><rect x="12" y="18" width="14" height="24" rx="4" fill="#e8869c"/></g>' +
      '<path d="M8 58 H44" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 8"/>'),
  };
  // Gives a control button its icon, its text and its tooltip.
  function label(btn: HTMLElement, name: keyof typeof ICONS, text: string, title: string) {
    btn.innerHTML = ICONS[name] + `<span>${text}</span>`;
    btn.title = title;
  }
  const stopBtn = $<HTMLButtonElement>('.pg-stop');
  const stepBtn = $<HTMLButtonElement>('.pg-step');
  label(stopBtn, 'stop', 'Stop', 'Stop the program, keeping the drawing');
  label(stepBtn, 'step', 'Step', 'Run one command at a time');
  label($('.pg-clear'), 'reset', 'Reset', 'Stop the program and clear the stage');

  // Play starts the program fresh; command-line lines keep the current
  // state. With mode 'step', it pauses before the first command; with
  // mode 'record', the run is filmed and saved as a video.
  let active = false;
  // Shows on the buttons whether a program is running, paused or neither.
  function showRunState() {
    const paused = Boolean(stage.debug.paused);
    if (!active) label(runBtn, 'play', 'Play', 'Play the program (Ctrl+Enter)');
    else if (paused) label(runBtn, 'play', 'Play', 'Carry on from here');
    else label(runBtn, 'pause', 'Pause', 'Pause before the next command');
    runBtn.classList.toggle('logo-running', active && !paused);
    stopBtn.disabled = !active;
  }
  showRunState();
  async function runSource(source: string, fresh: boolean, mode: RunMode = 'run') {
    if (stage.running) {
      stage.stop();
      return;
    }
    active = true;
    showRunState();
    if (mode === 'record') rec.textContent = 'Stop recording';
    try {
      if (mode === 'record') await stage.runAndRecord(source, title());
      else {
        if (fresh) await stage.fresh();
        await stage.run(source, mode);
      }
    } finally {
      active = false;
      showRunState();
      if (mode === 'record') rec.textContent = 'Make Recording';
      showPause(null);
    }
  }
  runBtn.addEventListener('click', () => {
    if (!active) runSource(editor.value, true);
    else if (stage.debug.paused) stage.debug.resume();
    else stage.debug.mode = 'step';
  });
  setupDebugger();
  editor.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      runBtn.click();
    }
  });
  // Reset stops any program and clears the stage.
  $('.pg-clear').addEventListener('click', async () => {
    await stage.halt();
    stage.reset();
  });

  // The debugger: Step runs a program one command at a time (or, while it
  // runs, pauses it); PAUSE in a program and procedure breakpoints pause
  // it too. While paused, the panel shows the next command, the
  // procedures it's inside, the variables and the turtle.
  function showPause(info: PauseInfo | null) {
    const panel = $('.pg-debug');
    panel.hidden = !info;
    panel.classList.remove('pg-debug-busy');
    command.disabled = Boolean(info);
    command.placeholder = info ? 'Paused: Step, Continue or Stop first'
      : 'Type a command and press Enter, like: fd 50 rt 90';
    if (!info) return;
    const what = [info.name, ...info.args].join(' ');
    const where = $('.pg-debug-where');
    where.textContent = '';
    const label = document.createElement('strong');
    label.textContent = { step: 'Next: ', breakpoint: 'Breakpoint: ', pause: 'Paused by PAUSE' }[info.reason];
    where.appendChild(label);
    if (info.reason !== 'pause') {
      const code = document.createElement('code');
      code.textContent = what;
      where.appendChild(code);
    }
    $('.pg-debug-calls').textContent = info.calls.length
      ? 'Inside: ' + info.calls.join(' \u203a ') : 'In the main program';
    const list = (dl: HTMLElement, pairs: [string, string][]) => {
      dl.textContent = '';
      if (!pairs.length) {
        const dd = document.createElement('dd');
        dd.className = 'pg-debug-none';
        dd.textContent = 'None';
        dl.appendChild(dd);
      }
      pairs.forEach(([name, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = name;
        const dd = document.createElement('dd');
        dd.textContent = value;
        dl.append(dt, dd);
      });
    };
    const locals = info.variables.locals.map((v): [string, string] => [':' + v.name, v.value]);
    const inputs = info.inputs.map((i): [string, string] => [i.name + ' (input to ' + info.name + ')', i.value]);
    list($('.pg-debug-locals'), [...inputs, ...locals]);
    list($('.pg-debug-globals'), info.variables.globals.map((v): [string, string] => [':' + v.name, v.value]));
    const t = info.turtle;
    list($('.pg-debug-turtle'), [['position', t.x + ', ' + t.y], ['heading', t.heading], ['pen', t.pen]]);
    stepBtn.focus({ preventScroll: true });
  }

  // Wires the debugger to the panel, Step and Stop, and the breakpoints.
  function setupDebugger() {
    const debug = stage.debug;
    debug.onPause = info => {
      showPause(info);
      showRunState();
    };
    // A Step leaves the panel up (dimmed) while the command runs, so the
    // page doesn't jump at every step; Play and Stop put it away.
    debug.onResume = how => {
      if (how === 'step') $('.pg-debug').classList.add('pg-debug-busy');
      else showPause(null);
      showRunState();
    };
    stepBtn.addEventListener('click', () => {
      if (debug.paused) debug.step();
      else if (stage.running) debug.mode = 'step';
      else runSource(editor.value, true, 'step');
    });
    stopBtn.addEventListener('click', () => stage.stop());

    // A "Break at" toggle for each procedure the program defines.
    const breaks = $('.pg-breaks');
    const list = $('.pg-breaks-list');
    let names = '';
    // (Redone only when the procedures change; procedureNames is in model.ts.)
    function update() {
      const procs = procedureNames(editor.value);
      if (procs.join(' ') === names) return;
      names = procs.join(' ');
      [...debug.breakpoints].forEach(name => { if (!procs.includes(name)) debug.breakpoints.delete(name); });
      list.textContent = '';
      procs.forEach(name => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pg-break';
        b.textContent = name;
        b.setAttribute('aria-pressed', String(debug.breakpoints.has(name)));
        b.title = 'Pause whenever ' + name + ' is called';
        b.addEventListener('click', () => {
          const on = !debug.breakpoints.has(name);
          if (on) debug.breakpoints.add(name); else debug.breakpoints.delete(name);
          b.setAttribute('aria-pressed', String(on));
        });
        list.appendChild(b);
      });
      breaks.hidden = !procs.length;
    }
    editor.addEventListener('input', update);
    root.addEventListener('logo-opened', update);
    update();
  }

  // The command line runs one line at a time against whatever the editor
  // program has defined, without clearing the screen.
  const commands: string[] = [];
  let back = 0;
  command.addEventListener('keydown', e => {
    if (e.key === 'Enter' && command.value.trim()) {
      const line = command.value;
      commands.push(line);
      back = 0;
      command.value = '';
      runSource(line, false);
    } else if (e.key === 'ArrowUp' && commands.length) {
      back = Math.min(back + 1, commands.length);
      command.value = commands[commands.length - back];
      e.preventDefault();
    } else if (e.key === 'ArrowDown' && back > 0) {
      back--;
      command.value = back ? commands[commands.length - back] : '';
      e.preventDefault();
    }
  });

  // The title for snapshots and recordings: the program's name, or an
  // example's lesson and name.
  function title() {
    if (!example) return state.current || 'Logo drawing';
    return example.name === example.lesson ? example.name : example.lesson + ' - ' + example.name;
  }

  // Snapshot saves the stage as it is now. Make Recording starts
  // the program over and films the whole run; while recording, it stops
  // the run (and the video with it). During any other run, it stops that
  // run and starts a recorded one.
  $('.pg-image').addEventListener('click', () => stage.download(title()));
  let recording = false;
  rec.addEventListener('click', async () => {
    if (recording) {
      stage.stop();
      return;
    }
    await stage.halt();
    recording = true;
    try {
      await runSource(editor.value, true, 'record');
    } finally {
      recording = false;
    }
  });

  // Tooltips for the words in the program.
  LogoReference.attach(editor, LogoReference.textareaLocator(editor));

  LogoReference.setup($('.pg-reference'), line => {
    command.value = line;
    command.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    command.focus();
  });

  // An example sent from a lesson's "Open in Playground" button.
  if (/[?&]import\b/.test(location.search)) {
    try {
      // (Nothing saved reads as null, which parses as null.)
      const item: unknown = JSON.parse(localStorage.getItem(IMPORT_KEY) ?? 'null');
      localStorage.removeItem(IMPORT_KEY);
      if (isImport(item)) add(item.name, item.code);
    } catch (e) { /* nothing to import */ }
    self.history.replaceState(null, '', location.pathname);
  }

  // (String(): `in` reads a saved null or non-string name as a string.)
  open(String(state.current) in state.files ? state.current : names()[0] || null);
}

// LogoPlayground.init, for <logo-playground> (element.ts). (A module export,
// not a global.)
export const LogoPlayground = { init };

