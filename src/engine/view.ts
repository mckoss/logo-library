// Zoom and pan for a Logo stage.
//
// jslogo draws on what it thinks is a fixed worldW x worldH canvas with home
// in the middle. LogoView.attach gives it stand-in drawing contexts instead:
// each call goes to the real canvas through a view transform (zoom and pan),
// and the sandbox's calls are also recorded, so the whole drawing can be
// replayed whenever the view changes. Points drawn are tracked in a
// bounding box, and the view zooms out on its own to keep the drawing, and
// the whole turtle (drawing or not), in sight until the viewer pans or
// zooms it themselves.
import * as math from './view-math.js';
import { IDENTITY, multiply, apply, isIdentity, NOTHING, include, margin } from './view-math.js';
import type { Box, Matrix, ViewPoint } from './view-math.js';

export type { Box, ViewPoint } from './view-math.js';

// (MARGIN, MARGIN_SHARE and SLACK, and the matrix arithmetic, are in
// view-math.ts.)
const TURTLE_SIZE = 20;     // turtle units from the turtle's middle to its edge
const GUIDE_MS = 1200;      // how long the home marker stays after moving the view
const GLIDE_MS = 320;       // how long an auto-fit takes to glide to its new view
const GLIDE_OPS = 30000;    // past this many drawing calls, it jumps instead
const STATE = ['strokeStyle', 'fillStyle', 'lineWidth', 'lineCap', 'lineJoin',
  'globalCompositeOperation', 'font', 'textAlign', 'textBaseline'] as const;

// The view a stage's contexts draw through: the world's size, and the
// current zoom and middle.
export interface View extends ViewPoint {
  worldW: number;
  worldH: number;
  // The transform from world units to canvas pixels.
  matrix(): Matrix;
}

// The arguments of a context call, recorded and replayed as jslogo made
// it: numbers for the drawing calls, a property's name and value for '='.
// The proxy forwards whatever jslogo calls, by name, so each case below
// reads its own arguments; this is the one loosely typed spot.
type CallArgs = any[];
// A recorded call: a context method's name (or '=' to set a property) and
// its arguments.
type Op = [name: string | symbol, args: CallArgs];
// The context as the proxy reaches it: methods and properties by name.
type NamedContext = Record<string | symbol, unknown>;
// The drawing state and transform at some point, as calls that bring them
// back.
interface Snapshot {
  state: Op[];
  m: Matrix;
}
// Where to start the record over once the outermost restore() runs: the
// state at the outermost save(), and the index of its call in the record.
interface Restart extends Snapshot {
  index: number;
}

// What a stand-in context reports to its view.
interface ContextHooks {
  // Keep a replayable record of the calls, and the box of what they drew.
  record?: boolean;
  // Something was drawn (the box grew).
  drew?: () => void;
  // jslogo cleared its whole canvas.
  cleared?: () => void;
  // jslogo moved to the turtle to draw it.
  moved?: () => void;
  // How much to scale the turtle, to draw it the same size at any zoom.
  size?: () => number;
}

// A stand-in context, and what the view needs from it.
interface ViewContext {
  context: CanvasRenderingContext2D;
  box: Box;
  readonly size: number;
  replay(): void;
  refresh(): void;
}

// A Proxy for a canvas's 2D context that maps jslogo's world coordinates
// through view.matrix(). With `record`, it keeps a replayable list of the
// calls since the last clear, and a bounding box of what they drew.
function viewContext(canvas: HTMLCanvasElement, view: View, hooks: ContextHooks = {}): ViewContext {
  const ctx = canvas.getContext('2d')!;
  const named = ctx as unknown as NamedContext;
  const record = Boolean(hooks.record);
  let ops: Op[] = [];
  let m = IDENTITY;
  const stack: Matrix[] = [];
  let replaying = false;
  let topSave: Restart | null = null;
  let restartAt: Restart | null = null;
  const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };

  function grow(x: number, y: number, r = 0) {
    if (replaying || !record) return;
    const [wx, wy] = apply(m, x, y);
    const scale = Math.hypot(m[0], m[1]);
    box.x0 = Math.min(box.x0, wx - r * scale);
    box.x1 = Math.max(box.x1, wx + r * scale);
    box.y0 = Math.min(box.y0, wy - r * scale);
    box.y1 = Math.max(box.y1, wy + r * scale);
    if (hooks.drew) hooks.drew();
  }

  function snapshot(): Snapshot {
    return { state: STATE.map((p): Op => ['=', [p, ctx[p]]]), m };
  }

  const fullCanvas = (x: number, y: number, w: number, h: number) =>
    isIdentity(m) && x <= 0 && y <= 0 && x + w >= view.worldW && y + h >= view.worldH;

  function run(name: string | symbol, args: CallArgs): unknown {
    switch (name) {
      case '=':
        named[args[0]] = args[1];
        return undefined;
      case 'setTransform':
        m = args.slice(0, 6) as Matrix;
        ctx.setTransform(...multiply(view.matrix(), m));
        return undefined;
      case 'translate':
        m = multiply(m, [1, 0, 0, 1, args[0], args[1]]);
        if (hooks.moved) hooks.moved();  // jslogo moves to the turtle to draw it
        if (hooks.size) {
          // Draw the turtle the same size on the screen at any zoom.
          const k = hooks.size();
          m = multiply(m, [k, 0, 0, k, 0, 0]);
        }
        break;
      case 'scale': m = multiply(m, [args[0], 0, 0, args[1], 0, 0]); break;
      case 'rotate': {
        const c = Math.cos(args[0]), s = Math.sin(args[0]);
        m = multiply(m, [c, s, -s, c, 0, 0]);
        break;
      }
      case 'save':
        if (record && !replaying && stack.length === 0) topSave = { index: ops.length - 1, ...snapshot() };
        stack.push(m);
        break;
      case 'restore':
        m = stack.pop() || IDENTITY;
        // The canvas's own restore brings back the transform from when
        // save() ran, with the view as it was then; a clear in between
        // (cs inside jslogo's save/restore) may have reset the view, so
        // apply the current one. Otherwise the drawing would carry on at
        // the old view, away from the turtle.
        ctx.restore();
        ctx.setTransform(...multiply(view.matrix(), m));
        if (restartAt && stack.length === 0) {
          // Start the record over from the clear, with the state it began in.
          ops = [...restartAt.state, ['setTransform', restartAt.m], ...ops.slice(restartAt.index)];
          restartAt = null;
        }
        return undefined;
      case 'moveTo': case 'lineTo': grow(args[0], args[1]); break;
      case 'arc': grow(args[0], args[1], args[2]); break;
      case 'fillText': {
        const size = parseFloat(ctx.font) || 14;
        grow(args[1], args[2], size);
        break;
      }
      case 'clearRect': case 'fillRect':
        if (fullCanvas(args[0], args[1], args[2], args[3])) {
          // Clearing jslogo's whole canvas clears all of ours, at any view.
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx[name](0, 0, canvas.width, canvas.height);
          ctx.restore();
          if (name === 'clearRect' && record && !replaying) {
            box.x0 = box.y0 = Infinity;
            box.x1 = box.y1 = -Infinity;
            if (stack.length) {
              restartAt = topSave;  // applied when the outermost restore() runs
            } else {
              const start = snapshot();
              ops = [...start.state, ['setTransform', start.m], ops[ops.length - 1]];
            }
            if (hooks.cleared) hooks.cleared();
          }
          return undefined;
        }
        break;
      case 'floodFill': {
        // jslogo fills from a point on its own canvas; find that pixel on ours.
        const [x, y] = apply(view.matrix(), args[0], args[1]);
        return ctx.floodFill(x, y);
      }
      default:
        break;
    }
    // (On the context: the parentheses keep it as `this`.)
    return (named[name] as (...args: CallArgs) => unknown)(...args);
  }

  const proxy = new Proxy(ctx, {
    get(target, prop) {
      if (prop === 'canvas') return canvas;
      const value = (target as unknown as NamedContext)[prop];
      if (typeof value !== 'function') return value;
      return (...args: CallArgs) => {
        if (record && !replaying) ops.push([prop, args]);
        return run(prop, args);
      };
    },
    set(target, prop, value) {
      if (record && !replaying) ops.push(['=', [prop, value]]);
      run('=', [prop, value]);
      return true;
    },
  });

  return {
    context: proxy,
    box,
    get size() { return ops.length; },
    // Redraws everything recorded, for the current view.
    replay() {
      const saved = m;
      replaying = true;
      canvas.width = canvas.width;  // resets the context's state
      m = IDENTITY;
      stack.length = 0;
      for (const [name, args] of ops) run(name, args);
      replaying = false;
      m = saved;
      ctx.setTransform(...multiply(view.matrix(), m));
    },
    // Re-applies the current transform after the view changes.
    refresh() {
      ctx.setTransform(...multiply(view.matrix(), m));
    },
  };
}

// Where the turtle is on the stage (see ViewControls.turtleAt).
export interface TurtleAt {
  // In CSS pixels from the stage's top left.
  x: number;
  y: number;
  // CSS pixels per turtle step, as the turtle is drawn (the same at any zoom).
  scale: number;
  // CSS pixels per turtle step of the drawing, at the current zoom.
  zoom: number;
}

// The view's controls, a stage's `view`: the zoom buttons' actions, and
// what a control needs to keep things beside the turtle.
export interface ViewControls {
  zoomIn(): void;
  zoomOut(): void;
  // Fits the drawing and the turtle in view.
  fit(): void;
  // Back to the starting view.
  home(): void;
  turtleAt(): TurtleAt | null;
  settle(): void;
  setTurtlePad(px: number): void;
}

// What LogoView.attach returns.
export interface ViewAttachment {
  // The stand-in contexts to give jslogo's CanvasTurtle: the drawing's
  // (recorded) and the turtle's.
  drawing: CanvasRenderingContext2D;
  sprite: CanvasRenderingContext2D;
  view: View;
  controls: ViewControls;
  // Tells the view about the turtle, once it exists.
  bind(turtle: CanvasTurtle): void;
}

// Sets up the view for a stage. Returns the contexts to give jslogo's
// CanvasTurtle, and bind(turtle) to call once it exists.
function attach(stageEl: HTMLElement, sandbox: HTMLCanvasElement, sprite: HTMLCanvasElement,
  worldW: number, worldH: number): ViewAttachment {
  let turtle: CanvasTurtle | null = null;
  const guides = document.createElement('canvas');
  guides.className = 'logo-guides';
  guides.width = sandbox.width;
  guides.height = sandbox.height;
  stageEl.appendChild(guides);

  const home: ViewPoint = { s: sandbox.width / worldW, cx: worldW / 2, cy: worldH / 2 };
  const view: View = {
    worldW, worldH,
    s: home.s, cx: home.cx, cy: home.cy,
    matrix() {
      return [this.s, 0, 0, this.s, sandbox.width / 2 - this.s * this.cx, sandbox.height / 2 - this.s * this.cy];
    },
  };
  let autoFit = true;
  let pending = false;
  // Everything the view has had to show since the last clear. It only
  // grows, so the view never zooms back in or slides about: it moves only
  // to bring something new into sight. (NOTHING and include() are in
  // view-math.ts.)
  const needed: Box = { ...NOTHING };
  function need() {
    return include(needed, wanted());
  }

  const drawing = viewContext(sandbox, view, {
    record: true,
    drew: () => { if (autoFit) schedule(); },
    cleared: () => {
      stopGlide();
      autoFit = true;
      Object.assign(needed, NOTHING);
      if (view.s !== home.s || view.cx !== home.cx || view.cy !== home.cy) {
        Object.assign(view, home);
        showZoom();
        drawing.refresh();
        turtleView.refresh();
        nudgeSprite();
      }
    },
  });
  const turtleView = viewContext(sprite, view, {
    moved: () => { if (autoFit) schedule(); },
    size: () => home.s / view.s,
  });
  // Room to keep around the turtle, in CSS pixels, for things shown
  // beside it (see setTurtlePad).
  let turtlePad = 0;

  // jslogo redraws the turtle only when it moves; nudge its heading by a
  // hair and back so the turtle follows the view. If the heading changed
  // in between, a clear set it exactly (leave it) or a turn added to the
  // nudged value (take the hair back off); never restore the old heading,
  // which would undo the turn.
  // Nudges in a row (a frame apart, while the view glides) alternate
  // between one hair and two, so each differs from the last and the
  // turtle redraws every frame, keeping up with the drawing.
  const HOME_HEADING = Math.PI / 2;
  let nudges = 0;
  function nudgeSprite() {
    if (!turtle) return;
    const t = turtle;
    const hair = 1e-9 * (1 + (++nudges % 2));
    const before = t.r;
    const nudged = before + hair;
    t.r = nudged;
    requestAnimationFrame(() => {
      if (t.r === nudged) t.r = before;
      else if (t.r !== HOME_HEADING) t.r -= hair;
    });
  }

  // The zoom relative to the starting view, on the stage for tests.
  function showZoom() {
    stageEl.dataset.zoom = (view.s / home.s).toFixed(3);
  }

  function redraw() {
    showZoom();
    drawing.replay();
    turtleView.refresh();
    nudgeSprite();
    drawGuides();
  }

  // The part of the world in view, in world units.
  function visible() {
    const hw = sandbox.width / 2 / view.s, hh = sandbox.height / 2 / view.s;
    return { x0: view.cx - hw, x1: view.cx + hw, y0: view.cy - hh, y1: view.cy + hh };
  }

  // (margin(size), the room to leave around something `size` units
  // across, is in view-math.ts.)
  function fitTo(box: Box, slack: number) {
    const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
    const w = bw + 2 * margin(bw), h = bh + 2 * margin(bh);
    view.s = Math.min(sandbox.width / w, sandbox.height / h) * slack;
    view.cx = (box.x0 + box.x1) / 2;
    view.cy = (box.y0 + box.y1) / 2;
  }

  // What must stay in view: the drawing and the whole turtle, if it shows.
  function wanted(): Box {
    const box = { ...drawing.box };
    if (turtle && turtle.visible) {
      const x = turtle.width / 2 + turtle.sx * turtle.x;
      const y = turtle.height / 2 - turtle.sy * turtle.y;
      // The turtle is drawn the same size at any zoom (in screen pixels,
      // as at the starting view), so its size in the world grows as the
      // view zooms out.
      const px = TURTLE_SIZE * Math.max(Math.abs(turtle.sx), Math.abs(turtle.sy)) * home.s +
        turtlePad * sandbox.width / stageEl.clientWidth;
      const r = px / view.s;
      box.x0 = Math.min(box.x0, x - r);
      box.x1 = Math.max(box.x1, x + r);
      box.y0 = Math.min(box.y0, y - r);
      box.y1 = Math.max(box.y1, y + r);
    }
    return box;
  }

  // Zoom out, never in, when the drawing or the turtle leaves the view.
  // Whether `box` is in view at the view `v`, with room around it (see
  // view-math.ts).
  const fits = (box: Box, v: ViewPoint) => math.fits(box, v, sandbox.width, sandbox.height);
  // The view that shows `box`: the starting view if it fits there, else
  // the closest of a fixed ladder of zooms, but never closer than the zoom
  // `most` (see view-math.ts).
  const canonical = (box: Box, most = home.s) => math.canonical(box, most, home, sandbox.width, sandbox.height);
  // Refits when what has to show no longer does (zooming out only).
  function settle() {
    const box = need();
    const to = aim();
    if (!autoFit || !(box.x1 >= box.x0) || fits(box, to)) return;
    glideTo(canonical(box, to.s));
  }
  // An auto-fit glides to its new view (zooming evenly, easing in to a
  // stop) instead of jumping, redrawing each frame; a new one on the way
  // sets off from wherever the view has got to. `aim` is where it's
  // going (the view itself, when still).
  let glide: { from: ViewPoint; to: ViewPoint; t0: number } | null = null;
  const aim = (): ViewPoint => (glide ? glide.to : view);
  const still = self.matchMedia && self.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function glideTo(v: ViewPoint) {
    const to = aim();
    if (v.s === to.s && v.cx === to.cx && v.cy === to.cy) return;
    if (still || drawing.size > GLIDE_OPS) {
      glide = null;
      Object.assign(view, v);
      redraw();
      return;
    }
    const start = !glide;
    glide = { from: { s: view.s, cx: view.cx, cy: view.cy }, to: { ...v }, t0: performance.now() };
    if (start) requestAnimationFrame(glideFrame);
  }
  function glideFrame(now: number) {
    if (!glide) return;
    const { from, to, t0 } = glide;
    const k = Math.min(1, Math.max(0, (now - t0) / GLIDE_MS));
    const e = 1 - Math.pow(1 - k, 3);
    // Even zooming: the scale goes geometrically, and the middle moves
    // so the point it heads for comes in at the same pace.
    const s = from.s * Math.pow(to.s / from.s, e);
    const f = to.s === from.s ? e : (1 / s - 1 / from.s) / (1 / to.s - 1 / from.s);
    view.s = s;
    view.cx = from.cx + (to.cx - from.cx) * f;
    view.cy = from.cy + (to.cy - from.cy) * f;
    if (k === 1) {
      Object.assign(view, to);
      glide = null;
    }
    redraw();
    if (glide) requestAnimationFrame(glideFrame);
  }
  function stopGlide() {
    glide = null;
  }
  // Zoom out when the drawing or the turtle leaves the view (on the next
  // frame), to the view for what's there.
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      settle();
    });
  }

  // Home marker and the default view's frame, shown while the view moves.
  let guideTimer: ReturnType<typeof setTimeout> | null = null;
  function drawGuides(show?: boolean) {
    const g = guides.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, guides.width, guides.height);
    if (show === undefined) show = guideTimer !== null;
    if (!show) return;
    const m = view.matrix();
    const [hx, hy] = apply(m, home.cx, home.cy);
    const [fx0, fy0] = apply(m, 0, 0);
    const [fx1, fy1] = apply(m, worldW, worldH);
    const px = sandbox.width / stageEl.clientWidth;
    g.lineWidth = px;
    g.strokeStyle = 'rgba(236, 48, 19, 0.6)';
    g.setLineDash([6 * px, 4 * px]);
    g.strokeRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    g.setLineDash([]);
    g.beginPath();
    g.moveTo(hx - 10 * px, hy); g.lineTo(hx + 10 * px, hy);
    g.moveTo(hx, hy - 10 * px); g.lineTo(hx, hy + 10 * px);
    g.stroke();
    g.fillStyle = 'rgba(236, 48, 19, 0.85)';
    g.font = (11 * px) + 'px sans-serif';
    g.fillText('home', hx + 4 * px, hy - 4 * px);
  }
  function showGuides() {
    clearTimeout(guideTimer ?? undefined);
    guideTimer = setTimeout(() => { guideTimer = null; drawGuides(); }, GUIDE_MS);
    drawGuides(true);
  }

  // A view change made by the viewer: auto-fit stops until the next
  // clear. Redraws wait for the next frame, so a fast drag replays a big
  // drawing once per frame, not once per pointer event.
  let redrawPending = false;
  function moved() {
    stopGlide();
    autoFit = false;
    showZoom();
    showGuides();
    if (redrawPending) return;
    redrawPending = true;
    requestAnimationFrame(() => {
      redrawPending = false;
      redraw();
    });
  }

  function zoomAt(factor: number, canvasX: number, canvasY: number) {
    const s = Math.max(home.s / 64, Math.min(home.s * 64, view.s * factor));
    const m = view.matrix();
    const wx = (canvasX - m[4]) / view.s, wy = (canvasY - m[5]) / view.s;
    view.s = s;
    view.cx = wx - (canvasX - sandbox.width / 2) / s;
    view.cy = wy - (canvasY - sandbox.height / 2) / s;
    moved();
  }

  const toCanvas = (e: MouseEvent): [number, number] => {
    const rect = stageEl.getBoundingClientRect();
    return [(e.clientX - rect.left) * sandbox.width / rect.width,
      (e.clientY - rect.top) * sandbox.height / rect.height];
  };

  // Drag to pan, pinch or Ctrl/Cmd+scroll to zoom, double-click to fit.
  const pointers = new Map<number, [number, number]>();
  let pinch: number | null = null;
  stageEl.addEventListener('pointerdown', e => {
    if ((e.target as Element).closest('.logo-view-tools')) return;
    stageEl.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, toCanvas(e));
    stageEl.classList.add('logo-dragging');
  });
  stageEl.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const [x, y] = toCanvas(e);
    const [px, py] = pointers.get(e.pointerId)!;
    pointers.set(e.pointerId, [x, y]);
    if (pointers.size === 1) {
      view.cx -= (x - px) / view.s;
      view.cy -= (y - py) / view.s;
      moved();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) zoomAt(dist / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      pinch = dist;
    }
  });
  const release = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinch = null;
    if (!pointers.size) stageEl.classList.remove('logo-dragging');
  };
  stageEl.addEventListener('pointerup', release);
  stageEl.addEventListener('pointercancel', release);
  stageEl.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const [x, y] = toCanvas(e);
    zoomAt(Math.exp(-e.deltaY * 0.01), x, y);
  }, { passive: false });
  stageEl.addEventListener('dblclick', () => controls.fit());

  const controls: ViewControls = {
    zoomIn: () => zoomAt(1.5, sandbox.width / 2, sandbox.height / 2),
    zoomOut: () => zoomAt(1 / 1.5, sandbox.width / 2, sandbox.height / 2),
    fit() {
      const box = wanted();
      if (box.x1 >= box.x0) fitTo(box, 1);
      else Object.assign(view, home);
      moved();
    },
    home() {
      Object.assign(view, home);
      moved();
    },
    // Where the turtle is on the stage, in CSS pixels from its top left,
    // how many CSS pixels one of its own steps is drawn (the same at any
    // zoom), and how many one step of the drawing is (`zoom`).
    turtleAt() {
      if (!turtle) return null;
      const [x, y] = apply(view.matrix(),
        turtle.width / 2 + turtle.sx * turtle.x, turtle.height / 2 - turtle.sy * turtle.y);
      const k = stageEl.clientWidth / sandbox.width;
      return { x: x * k, y: y * k, scale: home.s * k * Math.abs(turtle.sx), zoom: view.s * k * Math.abs(turtle.sx) };
    },
    // After a run: zooms out if what it drew isn't all in view yet.
    settle,
    // Keeps `px` CSS pixels clear around the turtle, for labels beside it.
    setTurtlePad(px: number) {
      turtlePad = px;
      schedule();
    },
  };

  const tools = document.createElement('div');
  tools.className = 'logo-view-tools';
  const buttons: [label: string, title: string, fn: () => void][] = [
    ['−', 'Zoom out', controls.zoomOut], ['+', 'Zoom in', controls.zoomIn],
    ['Fit', 'Fit the drawing in view', controls.fit], ['Home', 'Back to the starting view', controls.home]];
  buttons.forEach(([label, title, fn]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.addEventListener('click', fn);
    tools.appendChild(b);
  });
  stageEl.appendChild(tools);
  showZoom();
  stageEl.title = 'Drag to move the view; Ctrl or ⌘ + scroll, or pinch, to zoom; double-click to fit';

  return {
    drawing: drawing.context,
    sprite: turtleView.context,
    view,
    controls,
    bind(t) { turtle = t; },
  };
}

const api = { attach };
// LogoView, the global.
export type LogoViewApi = typeof api;
self.LogoView = api;
