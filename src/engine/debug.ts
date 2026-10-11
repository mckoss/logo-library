// Single stepping and breakpoints for a jslogo interpreter.
//
//   const debug = LogoDebug.attach(logo, turtle);
//   debug.onPause = info => ...;    // paused before info.name with info.args
//   debug.start('step');            // or 'run', at the start of each run
//   debug.step(); debug.resume(); debug.stop();
//
// Every command goes through jslogo's routines table, so each one is
// wrapped there: before it runs (with its inputs evaluated), the wrapper
// pauses if the debugger is stepping, the command is a PAUSE, or it calls a
// procedure with a breakpoint. jslogo itself is unchanged; it doesn't track
// source lines, so a pause shows the command and its procedure, not a line.

// A debugger's mode: run freely, or pause before every command.
export type DebugMode = 'run' | 'step';
// How a pause ends: stepping on, running on, or stopping the program.
export type Resume = 'run' | 'step' | 'stop';

// A variable, with its value as it would be printed.
export interface Variable {
  name: string;
  value: string;
}

// What a pause reports (to debug.onPause).
export interface PauseInfo {
  reason: 'step' | 'breakpoint' | 'pause';
  // The command about to run, lowercase.
  name: string;
  // Its inputs, as they'd be written.
  args: string[];
  // A procedure's inputs, by name (":size").
  inputs: Variable[];
  // The procedures running, outermost first.
  calls: string[];
  variables: { locals: Variable[]; globals: Variable[] };
  turtle: { x: string; y: string; heading: string; pen: 'down' | 'up' };
}

// A stage's debugger, as LogoDebug.attach returns it.
export interface Debugger {
  mode: DebugMode;
  // Procedure names, lowercase.
  breakpoints: Set<string>;
  // The pause in progress, if any.
  paused: { info: PauseInfo; resolve: (how: Resume) => void } | null;
  onPause: ((info: PauseInfo) => void) | null;
  onResume: ((how: Resume) => void) | null;
  // Set by stop() until the next start(): no more commands pause or run.
  stopping?: boolean;
  start(mode: DebugMode): void;
  step(): void;
  resume(): void;
  stop(): void;
}

// Variables the built-in music player keeps; not shown when paused.
const LIBRARY_VARIABLES = new Set(['octave', 'length', 'accidental']);

// A Logo value as a pause shows it: lists in brackets, numbers rounded.
function format(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(format).join(' ') + ']';
  if (value === undefined) return '(no value)';
  if (typeof value === 'number') return String(Math.round(value * 1e6) / 1e6);
  return String(value);
}

// Adds a debugger to the interpreter `logo`, whose turtle is `turtle`.
function attach(logo: LogoInterpreter, turtle: CanvasTurtle): Debugger {
  const debug: Debugger = {
    mode: 'run',               // 'run' or 'step'
    breakpoints: new Set(),    // procedure names, lowercase
    paused: null,              // the pause in progress, if any
    onPause: null,
    onResume: null,
    start(mode) {
      this.mode = mode;
      this.stopping = false;
    },
    step() { finish('step'); },
    resume() { finish('run'); },
    stop() {
      this.stopping = true;
      finish('stop');
    },
  };

  // Ends the pause in progress, if any, `how` the viewer chose.
  function finish(how: Resume) {
    const paused = debug.paused;
    if (!paused) return;
    debug.paused = null;
    if (how !== 'stop') debug.mode = how;
    if (debug.onResume) debug.onResume(how);
    paused.resolve(how);
  }

  // The variables to show: the innermost procedure's, and the globals.
  function variables() {
    const show = (scope: JSLogo.StringMap<JSLogo.ScopeEntry>) => {
      const vars: Variable[] = [];
      scope.forEach((name, entry) => {
        if (!LIBRARY_VARIABLES.has(name) && !name.startsWith('_') && !entry.buried) {
          vars.push({ name, value: format(entry.value) });
        }
      });
      return vars;
    };
    const scopes = logo.scopes;
    return {
      locals: scopes.length > 1 ? show(scopes[scopes.length - 1]) : [],
      globals: show(scopes[0]),
    };
  }

  // The turtle's position, heading and pen, as a pause shows them.
  function turtleState(): PauseInfo['turtle'] {
    const heading = ((90 - turtle.r * 180 / Math.PI) % 360 + 360) % 360;
    return {
      x: format(turtle.x), y: format(turtle.y),
      heading: format(Math.abs(heading - 360) < 1e-9 ? 0 : heading),
      pen: turtle.pendown ? 'down' : 'up',
    };
  }

  // Pauses before the command `name` (the routine `proc`) with its inputs
  // `args`; resolves with how the pause ended.
  async function pause(reason: PauseInfo['reason'], name: string, proc: JSLogo.Routine | null,
    args: unknown[]): Promise<Resume> {
    const inputs = (proc && proc.inputs) || [];
    const info: PauseInfo = {
      reason,
      name,
      // Inputs as they'd be written: words with their quote, like "half.
      args: args.map(a => (typeof a === 'string' && isNaN(Number(a)) ? '"' + a : format(a))),
      inputs: inputs.map((input, i) => ({ name: ':' + input, value: format(args[i]) })),
      // The procedures running, outermost first. jslogo's stack (names in
      // capitals) already ends with the command about to run; leave it off.
      calls: logo.stack.slice(0, -1)
        .filter(n => {
          const r = logo.routines.get(n);
          return r && !r.primitive;
        })
        .map(n => n.toLowerCase()),
      variables: variables(),
      turtle: turtleState(),
    };
    const done = new Promise<Resume>(resolve => { debug.paused = { info, resolve }; });
    if (debug.onPause) debug.onPause(info);
    return done;
  }

  // The routine `proc`, wrapped to pause before it runs when it should.
  function wrap(name: string, proc: JSLogo.Routine): JSLogo.Routine {
    if (typeof proc !== 'function' || proc.special || proc.debugWrapped) return proc;
    const key = String(name).toLowerCase();
    const wrapped = function (this: unknown, ...args: unknown[]) {
      // jslogo calls a few primitives directly, expecting an answer right
      // away; only calls the interpreter dispatches (this === logo) pause.
      if (this !== logo) return proc.apply(this, args);
      if (debug.stopping) return undefined;
      const stepping = debug.mode === 'step' && key !== 'pause';
      const breaking = !proc.primitive && debug.breakpoints.has(key);
      if (!stepping && !breaking) return proc.apply(this, args);
      return pause(breaking && !stepping ? 'breakpoint' : 'step', key, proc, args).then(how =>
        how === 'stop' ? undefined : proc.apply(this, args));
    };
    // Read everything else (input counts, inputs, flags) from the original.
    Object.setPrototypeOf(wrapped, proc);
    Object.defineProperty(wrapped, 'debugWrapped', { value: true });
    return wrapped;
  }

  const routines = logo.routines;
  const set = routines.set.bind(routines);
  routines.set = (name, proc) => set(name, wrap(name, proc));
  routines.forEach((name, proc) => set(name, wrap(name, proc)));

  // PAUSE: a breakpoint written in the program.
  const pauseCommand: JSLogo.Routine = () => (debug.stopping ? undefined : pause('pause', 'pause', null, []).then(() => undefined));
  pauseCommand.minimum = pauseCommand.default = pauseCommand.maximum = 0;
  pauseCommand.primitive = true;
  routines.set('pause', pauseCommand);

  return debug;
}

const api = { attach, format };
// LogoDebug, the global.
export type LogoDebugApi = typeof api;
self.LogoDebug = api;
