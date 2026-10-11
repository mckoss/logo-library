// Types for jslogo (vendor/jslogo, plain JavaScript, unchanged), as this
// package uses it. Its scripts are classic scripts that publish globals:
// turtle.js the CanvasTurtle class, logo.js the LogoInterpreter
// constructor (see src/engine/jslogo.ts), and floodfill.js a floodFill
// method on canvas 2D contexts. Only what the package touches is typed;
// Logo values (words, numbers, lists, arrays) are `unknown` here, since
// jslogo hands them over unchecked.

// The engine imports jslogo's scripts for their side effects only.
declare module 'jslogo/*';

declare namespace JSLogo {
  // A turtle mode: what the turtle does at the canvas's edge.
  type TurtleMode = 'wrap' | 'fence' | 'window';
  // A pen mode: paint, erase, or reverse (XOR-like difference).
  type PenMode = 'paint' | 'erase' | 'reverse';

  // jslogo's StringMap: a Map with (optionally case-folded) string keys,
  // whose forEach passes (key, value), unlike Map's.
  interface StringMap<T> {
    get(key: string): T | undefined;
    set(key: string, value: T): void;
    has(key: string): boolean;
    delete(key: string): boolean;
    keys(): string[];
    empty(): boolean;
    forEach(fn: (key: string, value: T) => void): void;
  }

  // A variable in a scope.
  interface ScopeEntry {
    value: unknown;
    buried?: boolean;
  }

  // A routine in the interpreter's table: a primitive or a procedure, as a
  // function with flags. Its parameters and `this` are the interpreter's
  // business; the engine only wraps and forwards them.
  interface Routine {
    // (`this` is the interpreter when it dispatches the call.)
    (this: unknown, ...args: unknown[]): unknown;
    minimum?: number;
    default?: number;
    maximum?: number;
    primitive?: boolean;
    // Gets its inputs unevaluated (TO, and the like).
    special?: boolean;
    noeval?: boolean;
    buried?: boolean;
    // A procedure's input names.
    inputs?: string[];
    // Set by the engine's debugger on the routines it has wrapped.
    debugWrapped?: boolean;
  }

  // The text stream an interpreter reads from and prints to.
  interface Stream {
    read(prompt?: string): Promise<string>;
    write(...args: unknown[]): Promise<void>;
    clear(): Promise<void>;
    readback(): Promise<string>;
    textsize: number;
    font: string;
    color: string;
  }

  // A turtle's saved state (getstate/setstate).
  interface TurtleState {
    isturtlestate: true;
    color: string;
    bgcolor: string;
    position: [number, number];
    heading: number;
    penmode: PenMode;
    turtlemode: TurtleMode;
    width: number;
    fontsize: number;
    fontname: string;
    visible: boolean;
    pendown: boolean;
    scrunch: [number, number];
  }
}

// jslogo's turtle: draws on canvas_ctx and shows itself on turtle_ctx (the
// engine hands it LogoView's stand-in contexts), in a width x height world
// with home in the middle and y up.
interface CanvasTurtle {
  canvas_ctx: CanvasRenderingContext2D;
  turtle_ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  // Position, in turtle steps from home.
  x: number;
  y: number;
  px: number;
  py: number;
  // Heading in radians, counterclockwise from east (home is PI / 2).
  r: number;
  // Scale from turtle steps to world units (SETSCRUNCH).
  sx: number;
  sy: number;
  color: string;
  bgcolor: string;
  penwidth: number;
  penmode: JSLogo.PenMode;
  fontsize: number;
  fontname: string;
  turtlemode: JSLogo.TurtleMode;
  visible: boolean;
  pendown: boolean;
  was_oob: boolean;
  filling: number;
  position: [number, number];
  // Heading in degrees, clockwise from north.
  heading: number;
  scrunch: [number, number];
  readonly bounds: [number, number, number, number];
  readonly mousepos: [number, number];
  readonly clickpos: [number, number];
  readonly button: number;
  readonly touches: { x: number; y: number }[];
  currentturtle: number;
  readonly turtles: number;

  // The engine replaces move and turn with animated versions that resolve
  // when the move is drawn; jslogo awaits whatever they return.
  move(distance: number): void | Promise<void>;
  turn(angle: number): void | Promise<void>;
  towards(x: number, y: number): number;
  resize(w: number, h: number): void;
  clearscreen(): void;
  clear(): void;
  clearturtles(): void;
  home(): void;
  drawtext(text: string): void;
  beginpath(): void;
  fillpath(fillcolor: string): void;
  fill(): void;
  arc(angle: number, radius: number): void;
  getstate(): JSLogo.TurtleState;
  setstate(state: JSLogo.TurtleState): void;
  copy(w: number, h: number): void;
  paste(): void;
}

declare var CanvasTurtle: {
  prototype: CanvasTurtle;
  // `events`, if given, is the element whose mouse and touches the turtle
  // reports (MOUSEPOS and the like); the engine passes null.
  new (canvas_ctx: CanvasRenderingContext2D, turtle_ctx: CanvasRenderingContext2D,
    w: number, h: number, events: Element | null): CanvasTurtle;
};

// jslogo's interpreter, as the engine drives it.
interface LogoInterpreter {
  turtle: CanvasTurtle;
  stream: JSLogo.Stream;
  // Every command, primitives and procedures, by name (case-folded).
  routines: JSLogo.StringMap<JSLogo.Routine>;
  // Variable scopes: globals first, the innermost procedure's last.
  scopes: JSLogo.StringMap<JSLogo.ScopeEntry>[];
  // The commands running, outermost first, names in capitals.
  stack: string[];
  // Maps a color name jslogo doesn't know to a color, or null (this
  // package's "rainbow").
  colorAlias: ((name: unknown) => string | null) | null;
  // Parses and runs Logo source after any runs already queued; resolves
  // with its result, or rejects with a Logo error.
  run(source: string, options?: object): Promise<unknown>;
  // Stops the running program at its next command.
  bye(): void;
  // Runs a task in turn with the queued runs.
  queueTask<T>(task: () => T | Promise<T>): Promise<T>;
}

declare var LogoInterpreter: {
  prototype: LogoInterpreter;
  // `savehook`, if given, is called with each procedure defined.
  new (turtle: CanvasTurtle, stream: JSLogo.Stream,
    savehook?: ((name: string, def: unknown) => void) | null): LogoInterpreter;
};

// floodfill.js: fills the area around a pixel, in canvas pixels, with the
// fill style.
interface CanvasRenderingContext2D {
  floodFill(x: number, y: number): void;
}
