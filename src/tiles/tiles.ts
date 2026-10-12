// Turtle Tiles: Logo for children who can't read yet. Picture tiles make
// the turtle move, turn, change color and play notes.
//
// Tapping a tile makes the turtle do it right away. While Record is on, the
// tile is also added to the end of the recording, the strip of tiles. The
// strip works like a tape: Play plays it from the playhead (the tile with
// the dashed outline), Pause stops after the tile that's playing, Step
// plays one tile, and Rewind takes the playhead back to the start; tapping
// a tile in the strip moves the playhead to it. Playing never clears the
// drawing or moves the turtle home first: Clear (which also sends the
// turtle home and rewinds the strip) and Home do that, when the child
// wants. Home is a tile like the others, so it can be recorded too
// (to start each drawing from the middle); Clear is a button and isn't.
// Tiles can be dragged into the strip, moved around in it, or dragged out
// onto the trash can to throw them away (dropped anywhere else, they go
// back); tapping the trash can twice empties the whole strip. Repeat, while
// recording, opens a repeat in the strip; the tiles tapped next go into
// it, and tapping Repeat again (or stopping recording) closes it. Its big
// number is how many times it goes round: 1 at first, so it's just a
// group, and tapping it opens a pop-up to count up or down, 0 to 99. Dots
// (or for big counts a bar) under the number show how far round it has
// gone. Dragged to the trash, a repeat lets go of its tiles, which stay.
// The strip is saved in this browser.
//
// Moves and turns are set the same way: the Step size button opens a
// spinner that sets how many units (of 25 turtle steps, 1 to 99) the Move
// and Back buttons go, and the turn wheel sets how far the turtle in its
// middle turns. The wheel's arm shows where the turtle will face, and the wedge how far it
// turns: tap or drag around the ring to move the arm (in steps of 15
// degrees, with bigger dots at 45, 60, 90, 120 and 180), then tap the
// turtle to turn. The turtle in the middle is drawn as on the stage, and it
// and the dial turn with the turtle on the stage, so the arm always shows
// the turn from the way the turtle faces and tapping again turns the same
// way again. Move tiles show their units and turn tiles their degrees (-
// for left, + for right). Tapping a move in the strip opens the spinner to
// change it (and sets Move and Back to it); tapping a turn opens it too, in
// steps of 15 degrees (and sets the wheel to it). While recording, a move after a move the same way, or a turn after a
// turn, merges into the tile before (a whole turn disappears).
//
// Colors: the Colors button opens the crayons (swatches of the named Logo
// colors, which put the pen down, a white one that lifts it, and Next
// color, a rainbow, which goes round the rainbow). The Music button opens the notes (named do, re, mi...).
//
// The drawing gets all the room the controls leave. A gutter down the left
// has Home, Clear, Speed, Colors, Music and Turtle (how the turtle shows: as
// itself, with where it is and which way it faces, or as an arrow). Under the
// drawing, the strip has a row
// of its own, the whole width, growing to three lines before it scrolls;
// under that are the tape buttons (with Repeat), and the wheel in the
// corner with Move, Back and Step size beside it.
//
// Programs: there are four, A to D, each with its own strip; the button
// left of the strip shows which one the strip shows and picks another.
// The Play program button (by Move and Back) plays one, and while
// recording adds a tile that plays it (a Play button with its letter), so a
// program can be made of others. Play and Step go into a program played:
// the strip shows it while it plays, then comes back. A program can't play
// itself, even by way of another: those choices are faded. In the
// playground each program played is a Logo word (TO B ... END).
//
// A grown-ups button, opened by holding it down, has Snapshot, Make
// Recording and Open in Playground, which shows the strip as Logo.
//
// The <turtle-tiles> element (element.ts) calls init() on itself.
//
// How it's built: all of its state is one object (state.ts, with the
// changes taps and drags make to it as functions of it). Event handlers
// change the state, then call commit(), which saves the programs if they
// changed and calls render(), which brings the whole page in line with the
// state. The strip (strip.ts) keeps each item's element from one render to
// the next. What a program is, the tiles' names, colors and Logo, and a
// program as Logo are in program.ts; share links are in share.ts; the
// pictures are in pictures.ts.
import type { SpeedName, Stage, TurtleAt } from '../engine/index.js';
import { logoPath, storageKey } from '../engine/host.js';
import {
  BLUE, HOME, NAMES, PROGRAM_COLORS, STEP, TILES, UNIT, clean, codeFor, isName, moveLabel, namedLogo, normalize, toLogo,
  turnLabel, turnTint,
} from './program.js';
import type { Item, ProgramName, Programs, Step, Tile, TileGroup } from './program.js';
import { SHARE_PARAM, pack, unpack } from './share.js';
import type { IncomingPayload, SharePayload } from './share.js';
import {
  ABOVE, BOLT_TIP, BUTTONS, LOOKS, MENU, MUSIC, PICTURED, TURTLE, animal, arcArrow, arrowIcon, crayon, lookOf,
  playsIcon, polar, progIcon, rulerIcon, svg, wedge,
} from './pictures.js';
import {
  SPEEDS, advance, blocked, changed, closePopup, createState, differs, dropDragged, emptyProgram, goProgram, loadLook,
  loadPace, loadPrograms, next, nudgeAngle, openPrograms, openSpinner, program, record, rewind,
  roomAround, saved, select, setAngle, setRecording, sourceItem, speedOf, spinBy, spinRange, steps, tapItem,
  tapRepeat, togglePopup,
} from './state.js';
import type { PopupId } from './state.js';
import { attr, el, iconButton, markup, tileElement } from './dom.js';
import { createStrip } from './strip.js';

const { LogoStage } = self;
const SAVE_KEY = storageKey('mckoss.logo.tiles');
const SPEED_KEY = storageKey('mckoss.logo.tiles.speed');
const LOOK_KEY = storageKey('mckoss.logo.tiles.look');
const IMPORT_KEY = storageKey('mckoss.logo.import');
const TITLE = 'Turtle Tiles';
const PRELUDE = 'setpensize 2';
const FRIENDLY = [45, 60, 90, 120, 180];  // the wheel's bigger dots
const SHORT_SIDE = 240;  // turtle steps across the stage's shorter side
const HOLD_MS = 800;
const CONFIRM_MS = 3000;
// Layout, in pixels: the page's padding, the gap between tiles, the
// largest and smallest tile, and the least of the height the drawing
// keeps.
const PAD = 8;
const GAP = 6;
const MAX_TILE = 76;
const MIN_TILE = 26;
const STAGE_SHARE = 0.6;

// This browser's storage, which may be blocked.
function load(key: string): string | null {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function store(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch (e) { /* storage blocked */ }
}

// A drag under way, as startDrag returns it: follows the pointer, then
// ends, dropping the item (or not, if `cancelled`).
interface Drag {
  move(ev: PointerEvent): void;
  end(cancelled: boolean): void;
}

// Sizes the tiles and arranges them, as big as they can be while the
// drawing keeps at least STAGE_SHARE of the height. The crayons and the
// notes wait in pop-ups. There is always a left gutter, one tile wide,
// with Home, Clear, Colors, Music and Turtle; under the drawing, the strip on
// its own row, the whole width (one line of tiles, growing to three as
// it fills, then scrolling); and under that the wheel in the corner,
// with Move, Back and Step size (a spinner, in a pop-up) beside
// it. 'wide' has the tape buttons (with Repeat) beside the top of the
// wheel and those tiles in a row beside its bottom; 'tall' has the tape
// buttons the whole width, then the wheel with the tiles in two rows
// beside it.
function plan(W: number, H: number) {
  const g = GAP;
  const fit = (units: number) => (W - units * g) / units;
  // The strip's height at its smallest, for tile size b.
  const STRIP = 0.76, STRIP_EXTRA = 16;
  const options = [
    {
      // Beside the wheel: the tape buttons and Repeat; and Move, Back
      // and Step size. Beside the drawing: Home, Speed, Clear, Colors,
      // Music and Turtle.
      layout: 'wide',
      limits: [fit(2 + 6), fit(2 + 4), (H - STRIP_EXTRA - 8 * g) / (8 + STRIP),
        ((1 - STAGE_SHARE) * H - STRIP_EXTRA - 3 * g) / (2 + STRIP)],
      stage: (b: number) => (W - b - g) * (H - (2 + STRIP) * b - STRIP_EXTRA - 3 * g),
    },
    {
      // The same, for a short screen: the gutter two buttons wide.
      layout: 'wide2',
      limits: [fit(2 + 6), fit(2 + 4), (H - STRIP_EXTRA - 5 * g) / (5 + STRIP),
        ((1 - STAGE_SHARE) * H - STRIP_EXTRA - 3 * g) / (2 + STRIP)],
      stage: (b: number) => (W - 2 * b - 2 * g) * (H - (2 + STRIP) * b - STRIP_EXTRA - 3 * g),
    },
    {
      // Beside the wheel, in two rows: Move and Back, Step size and
      // Play a program, then the tape buttons three by two. Six down
      // the gutter beside the drawing.
      layout: 'tall',
      limits: [fit(2 + 2 + 3), ((1 - STAGE_SHARE) * H - STRIP_EXTRA - 3 * g) / (2 + STRIP),
        (STAGE_SHARE * H - 6 * g) / 6],
      stage: (b: number) => (W - b - g) * (H - (2 + STRIP) * b - STRIP_EXTRA - 3 * g),
    },
  ];
  let best = null as (typeof options[number] & { size: number; area: number }) | null;
  options.forEach(o => {
    const size = Math.floor(Math.min(MAX_TILE, ...o.limits));
    const area = o.stage(size);
    if (!best || size > best.size || (size === best.size && area > best.area)) best = { ...o, size, area };
  });
  return best!;
}

function init(root: HTMLElement) {
  // The state: the programs, kept in this browser, and the speed and the
  // turtle display choice, kept too (and stored again, checked).
  const loaded = loadPrograms(load(SAVE_KEY));
  const state = createState(loaded.programs, loaded.current, loadLook(load(LOOK_KEY)), loadPace(load(SPEED_KEY)));
  store(LOOK_KEY, state.look);
  store(SPEED_KEY, state.pace);

  // The page ----------------------------------------------------------------

  // The stylesheet's grid places each part, in one of two arrangements
  // (root.dataset.layout, chosen by layout()).
  const stageArea = el('div', 'tt-stage-area', root);
  const stageHost = el('div', 'tt-stage', stageArea);
  // The Logo programs' version (from the page), faint in a corner.
  const version = el('div', 'tt-version', stageArea);
  version.textContent = 'v' + (root.dataset.version || '');
  const grownUps = iconButton('tt-grownups', 'Grown-ups (hold)', MENU, stageArea);

  // The left gutter: Home and Clear for the drawing, then the Colors and
  // Music buttons.
  const left = el('div', 'tt-left', root);
  const stageTools = el('div', 'tt-stage-tools', left);
  stageTools.setAttribute('role', 'group');
  stageTools.setAttribute('aria-label', 'Drawing');
  const clearBtn = iconButton('tt-clear', 'Clear drawing', BUTTONS.clear, stageTools);

  // The strip's row: the program it shows (its letter, with arrows to go
  // up and down through A to D), then the strip. Under it, the tape
  // buttons: Record, (Repeat,) Play, Step, Rewind and the trash.
  const stripRow = el('div', 'tt-strip-row', root);
  const progBtn = el('div', 'tt-button tt-prog', stripRow);
  progBtn.setAttribute('role', 'group');
  const progLetter = el('div', 'tt-prog-letter', progBtn);
  const progArrow = (className: string, label: string, d: string) => {
    const b = el('button', 'tt-prog-step ' + className, progBtn);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = svg(`<path d="${d}"/>`);
    return b;
  };
  const progUp = progArrow('tt-prog-up', 'Previous program', 'M32 4 L44 14 H20 Z');
  const progDown = progArrow('tt-prog-down', 'Next program', 'M32 60 L44 50 H20 Z');
  const stripArea = el('div', 'tt-strip-area', stripRow);
  const strip = el('div', 'tt-strip', stripArea);
  strip.setAttribute('aria-label', 'Program');
  strip.setAttribute('role', 'list');
  const stripView = createStrip(strip);
  const line = el('div', 'tt-line', root);
  line.setAttribute('role', 'group');
  line.setAttribute('aria-label', 'Recording');
  const recordBtn = iconButton('tt-record', 'Record', BUTTONS.record, line);
  const playBtn = iconButton('tt-play', 'Play', BUTTONS.play, line);
  const stepBtn = iconButton('tt-step', 'Step', BUTTONS.step, line);
  const rewindBtn = iconButton('tt-rewind', 'Rewind', BUTTONS.rewind, line);
  const speedBtn = iconButton('tt-pop tt-speed', 'Speed', '');
  const trashBtn = iconButton('tt-trash', 'Trash', BUTTONS.trash, line);

  const wheel = el('div', 'tt-wheel', root);
  const tiles = el('div', 'tt-tiles', root);

  const groupEls = { drawing: stageTools } as Record<TileGroup, HTMLDivElement>;  // (the rest made here)
  ([['core', 'Moves'], ['crayons', 'Crayons'], ['notes', 'Music']] as const).forEach(([id, label]) => {
    const g = el('div', 'tt-group tt-' + id);
    g.setAttribute('role', 'toolbar');
    g.setAttribute('aria-label', label);
    groupEls[id] = g;
  });

  // The crayons and the notes wait in pop-ups, opened by the Colors button
  // (a crayon in the pen's color) and the Music button; how the turtle
  // shows, from the Turtle button; playing a program, A to D, from the Play
  // program button (a round Play button in the programs' four colors); the
  // speed, from the Speed button; and how far Move and Back go, from the
  // Step size button, which opens the spinner.
  const popButtons = el('div', 'tt-pop-buttons', left);
  const colorsBtn = iconButton('tt-pop tt-colors', 'Colors', crayon('#282828'), popButtons);
  const musicBtn = iconButton('tt-pop tt-music', 'Music', MUSIC, popButtons);
  const lookBtn = iconButton('tt-pop tt-look', 'Turtle', LOOKS[0].icon, popButtons);
  const playsBtn = iconButton('tt-pop tt-plays', 'Play a program', playsIcon(NAMES.map(p => PROGRAM_COLORS[p])));
  const sizeBtn = iconButton('tt-pop tt-size', 'Step size', rulerIcon(2));
  const popups = {} as Record<PopupId, { pop: HTMLDivElement; btn: HTMLElement | null }>;  // (each made below)
  ([['crayons', colorsBtn, 'Colors'], ['notes', musicBtn, 'Music'], ['looks', lookBtn, 'Turtle'],
    ['plays', playsBtn, 'Play a program'], ['speeds', speedBtn, 'Speed']] as const)
    .forEach(([id, btn, label]) => {
    const pop = el('div', 'tt-popup', root);
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', label);
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', () => {
      togglePopup(state, id);
      commit();
    });
    popups[id] = { pop, btn };
  });
  const lookChoices = el('div', 'tt-group tt-looks', popups.looks.pop);
  const lookButtons = LOOKS.map(l => {
    const b = iconButton('tt-look-choice', l.label, l.icon, lookChoices);
    b.addEventListener('click', () => {
      state.look = l.id;
      store(LOOK_KEY, l.id);
      closePopup(state);
      commit();
    });
    return b;
  });
  const speedChoices = el('div', 'tt-group tt-speeds', popups.speeds.pop);
  const speedButtons = SPEEDS.map(v => {
    const b = iconButton('tt-speed-choice', v.label, animal(v.id), speedChoices);
    b.dataset.speed = v.id;
    b.addEventListener('click', () => {
      state.pace = v.id;
      store(SPEED_KEY, v.id);
      closePopup(state);
      commit();
    });
    return b;
  });
  // The tiles that play a program. One that would play the program it
  // goes in (itself, or by way of another) is faded and does nothing.
  const callChoices = el('div', 'tt-group tt-calls', popups.plays.pop);
  const callTiles = NAMES.map(p => {
    const t = tileElement(lookOf({ t: 'call', p }), 'tt-source');
    t.dataset.p = p;
    callChoices.appendChild(t);
    return t;
  });
  popups.crayons.pop.appendChild(groupEls.crayons);
  popups.notes.pop.appendChild(groupEls.notes);

  const menu = el('div', 'tt-menu', root);
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'Grown-ups');
  menu.innerHTML = '<h2>Grown-ups <small class="tt-menu-version"></small></h2><p>Tap the picture tiles to make the turtle move, draw and ' +
    'play notes; the rainbow changes to the next color, and the white one draws nothing. The step size button sets how far the arrow moves; to turn, move the wheel\'s arm to where ' +
    'the turtle should face, then tap the turtle. While the red Record button is on, each tile ' +
    'tapped is added to the strip (after the tile you last tapped in the strip, if any: Rewind lets go of it); ' +
    'tap it again to stop recording. Play plays the strip from the ' +
    'dashed tile, Step plays one tile, and Rewind goes back to the start. Playing doesn\'t clear ' +
    'the drawing or send the turtle home: use the eraser (which does both) and the house for that (the house can be ' +
    'recorded too, to start from the middle each time). Drag tiles to ' +
    'move them, or onto the trash can to throw them away; tap the trash can twice to empty the program it shows. While recording, ' +
    'Repeat starts a group and the tiles tapped next go in it; tap Repeat again to close it. Tap a ' +
    'group\'s number to set how many times it goes round (0 to 99) and to record on the end of it; drag the number to the trash ' +
    'to undo the group and keep its tiles. There are four programs, A to D: the arrows on the letter by the strip go up ' +
    'and down through them (showing another stops recording), and the Play program button plays one (and records it), so programs can be made ' +
    'of other programs. Share a link sends all four programs: opening it loads them here.</p>';
  menu.querySelector('.tt-menu-version')!.textContent = 'Turtle Tiles v' + (root.dataset.version || '');
  const menuTools = el('div', 'tt-menu-tools', menu);
  const textButton = (label: string, onClick: () => unknown) => {
    const b = el('button', 'logo-btn', menuTools);
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };
  const lessons = el('a', 'tt-menu-link', menu);
  lessons.href = logoPath();
  lessons.textContent = 'Logo lessons';
  // Its buttons.
  const closeMenu = () => {
    state.menu = false;
    commit();
  };
  const pretty = () => '; Made with Turtle Tiles\n' + PRELUDE + '\n' + namedLogo(state.programs, state.current);
  textButton('Snapshot', () => stage!.download(TITLE));
  // A video of the whole recording, from a clean page with the turtle
  // at home; the drawing it leaves stays.
  const rec = textButton('Make Recording', () => {
    closeMenu();
    schedule(async () => {
      state.playing = true;
      commit();
      try {
        history = [toLogo(state.programs, program(state), { silent: true })];
        await stage!.runAndRecord(PRELUDE + '\n' + toLogo(state.programs, program(state)), TITLE);
      } finally {
        state.playing = false;
        commit();
      }
    });
  });
  if (!LogoStage.canRecord()) {
    rec.disabled = true;
    rec.textContent = 'Video not supported';
  }
  textButton('Open in Playground', () => {
    try {
      localStorage.setItem(IMPORT_KEY, JSON.stringify({ name: TITLE, code: pretty() }));
    } catch (e) { /* storage blocked: open the playground anyway */ }
    location.href = logoPath('playground/') + '?import';
  });
  // Share a link: a link to this page that carries all the programs (by
  // the phone's share sheet, or copied).
  const shareBtn = textButton('Share a link', async () => {
    const shared = NAMES.filter(n => state.programs[n].length);
    const data: SharePayload = {
      current: state.current, programs: Object.fromEntries(shared.map(n => [n, state.programs[n]])),
    };
    const url = location.origin + location.pathname + '?' + SHARE_PARAM + '=' + await pack(data);
    if (navigator.share) {
      try {
        await navigator.share({ title: TITLE, url });
        return;
      } catch (e) {
        if (e && (e as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      state.copied = true;
      commit();
      setTimeout(() => {
        state.copied = false;
        commit();
      }, 2000);
    } catch (e) {
      self.prompt('Copy this link:', url);
    }
  });
  textButton('Close', closeMenu);

  // The source tiles: Move and Back (as far as Step size says), and the
  // fixed tiles in their groups.
  const moveBtn = tileElement({ id: 'move', label: '', icon: '', color: BLUE }, 'tt-source');
  const backBtn = tileElement({ id: 'back', label: '', icon: '', color: BLUE }, 'tt-source');
  groupEls.core.append(moveBtn, backBtn);
  TILES.forEach(t => t.group && groupEls[t.group].appendChild(tileElement(PICTURED[t.id], 'tt-source')));
  stageTools.append(clearBtn, speedBtn);  // Home first, then Clear and Speed
  tiles.append(groupEls.core);
  backBtn.after(sizeBtn);
  sizeBtn.after(playsBtn);
  // Repeat works on the recording, so it sits with the tape buttons.
  const repeatBtn = groupEls.core.querySelector<HTMLElement>('[data-tile="repeat"]')!;
  line.insertBefore(repeatBtn, playBtn);

  // The spinner: a pop-up with up and down arrows (hold one to count
  // fast) around a number. It sets a repeat's count (0 to 99, over its
  // head), how far Move and Back go (1 to 99 units, over the Step size
  // button), and how far a move or a turn in the strip goes.
  const countPop = el('div', 'tt-popup tt-count-pop', root);
  countPop.setAttribute('role', 'dialog');
  const arrowButton = (label: string, d: string) => {
    const b = iconButton('tt-count-step', label, svg(`<path d="${d}" fill="#fff"/>`), countPop);
    b.style.setProperty('--tile-color', '#f08c00');
    return b;
  };
  const upBtn = arrowButton('More times', 'M32 14 L54 46 H10 Z');
  const countNum = el('div', 'tt-count-num', countPop);
  countNum.setAttribute('aria-live', 'polite');
  const downBtn = arrowButton('Fewer times', 'M32 50 L54 18 H10 Z');
  popups.count = { pop: countPop, btn: null };

  // The turn wheel: the ring, with the arm, and the turtle to tap in its
  // middle.
  const C = 60;      // the wheel's center, in its 120 x 120 drawing
  const RING = 46;
  wheel.innerHTML = `<svg class="tt-wheel-ring" viewBox="0 0 120 120" role="slider" tabindex="0"
    aria-label="Turn angle" aria-valuemin="-165" aria-valuemax="180">
    <circle cx="${C}" cy="${C}" r="${RING + 12}" fill="#dbe8f8"/>
    <g class="tt-dial">
    <path class="tt-wedge" fill="${BLUE}" opacity=".35"/>
    <path d="M${C} ${C} V${C - RING}" stroke="${BLUE}" stroke-width="2.5" stroke-dasharray="4 4"/>
    ${Array.from({ length: 24 }, (_, i) => {
      const a = normalize(i * STEP);
      const [x, y] = polar(C, RING, a);
      const big = FRIENDLY.includes(Math.abs(a));
      return a ? `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${big ? 4.5 : 2}" fill="${BLUE}"
        opacity="${big ? 0.9 : 0.5}"/>` : '';
    }).join('')}
    <path class="tt-arc" stroke="${BLUE}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path class="tt-arrowhead" fill="${BLUE}" stroke="${BLUE}" stroke-width="2" stroke-linejoin="round"/>
    <path class="tt-arm" stroke="${BLUE}" stroke-width="4" stroke-linecap="round" opacity=".7"/>
    <circle class="tt-knob" r="9" fill="${BLUE}" stroke="#fff" stroke-width="3"/>
    </g>
  </svg>`;
  const ring = wheel.querySelector<SVGSVGElement>('.tt-wheel-ring')!;
  const go = tileElement({ id: 'turn', label: '', icon: TURTLE, color: '#fff' }, 'tt-source tt-turn-go');
  wheel.appendChild(go);
  const dial = ring.querySelector('.tt-dial')!;
  const turtleTurn = go.querySelector('.tt-turtle-turn')!;
  // The turn, in degrees, over the turtle (and spilling past it):
  // outside the part that turns with it, so it always reads right side up.
  const goText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  goText.setAttribute('class', 'tt-turn-degrees');
  goText.setAttribute('y', '10');
  goText.setAttribute('text-anchor', 'middle');
  go.querySelector('svg')!.appendChild(goText);

  // Where the turtle is, for the Turtle choices that show it: with the
  // turtle, a flashing dot in the pen's color (white when the pen is up),
  // its x, y and its heading on its nose; or just a flashing arrow. It's
  // laid over the stage, so snapshots never have it.
  const posMarker = el('div', 'tt-marker-pos');
  const markerDot = el('span', 'tt-pos-dot', posMarker);
  // Just an arrow: an arrowhead in the pen's color, pointing the way the
  // turtle faces, on a shaft as wide as the pen draws, so it carries on
  // from the line behind it. With the pen up, it's white.
  const markerArrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  markerArrow.setAttribute('class', 'tt-pos-arrow');
  markerArrow.setAttribute('aria-hidden', 'true');
  const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  markerArrow.appendChild(arrowPath);
  posMarker.appendChild(markerArrow);
  // At other speeds than the turtle's, the stage's turtle is the animal,
  // seen from above, the same size, facing the way the turtle does.
  const markerAnimal = el('div', 'tt-pos-animal', posMarker);
  const markerText = el('span', 'tt-pos-xy', posMarker);
  const markerHeading = el('span', 'tt-pos-heading', posMarker);

  // Render ------------------------------------------------------------------

  // The stage (made by makeStage, below, before anything runs: `stage!`
  // from then on) and its options, which the stage reads as it goes.
  const stageOptions: { view: [number, number]; speed: SpeedName } = { view: [SHORT_SIDE, SHORT_SIDE], speed: 'slow' };
  let stage = null as Stage | null;
  let replaying = false;  // (a replay goes at once, then takes the speed)
  // A drag's ghost: a copy of the tile dragged, following the pointer.
  let ghost: HTMLElement | null = null;

  // Saves the programs if they changed, then brings the page in line with
  // the state.
  function commit() {
    if (state.unsaved) {
      state.unsaved = false;
      store(SAVE_KEY, saved(state));
    }
    render();
  }

  // Brings the whole page in line with the state.
  function render() {
    renderRoot();
    renderStrip();
    renderTape();
    renderMoves();
    renderWheel();
    renderPopups();
    renderMenu();
    renderDrag();
    renderStage();
  }

  function renderRoot() {
    root.classList.toggle('tt-recording', state.recording);
    root.classList.toggle('tt-playing', state.playing);
    // Busy while anything is waiting or running, for tests to wait on.
    root.classList.toggle('tt-busy', state.waiting > 0);
    attr(root, 'data-look', state.look);
    attr(root, 'data-animal', state.pace);
    if (state.layout) {
      attr(root, 'data-layout', state.layout);
      root.style.setProperty('--b', Math.max(MIN_TILE, state.size) + 'px');
      root.style.setProperty('--gap', GAP + 'px');
      root.style.setProperty('--pad', PAD + 'px');
    }
  }

  // The program the strip shows, and the strip. Going to another program
  // scrolls the letter and the strip: the new ones in as the old ones go.
  let shownProgram: ProgramName | null = null;
  function renderStrip() {
    const p = state.current;
    const by = shownProgram ? Math.sign(NAMES.indexOf(p) - NAMES.indexOf(shownProgram)) : 0;
    const before = by ? [snapshot(progLetter), snapshot(strip, 'tt-strip-ghost')] : null;
    shownProgram = p;
    markup(progLetter, progIcon(p));
    attr(progBtn, 'data-program', p);
    progBtn.style.setProperty('--tile-color', PROGRAM_COLORS[p]);
    attr(progBtn, 'aria-label', 'Program ' + p);
    progUp.hidden = p === NAMES[0];
    progDown.hidden = p === NAMES[NAMES.length - 1];
    const drag = state.drag;
    stripView.render({
      program: program(state), selected: state.selected, openRepeat: state.openRepeat, next: next(state),
      active: state.active, lifted: drag && drag.lifted, drop: drag && drag.drop,
    });
    if (before) {
      scroll(progLetter, before[0], by);
      scroll(strip, before[1], by);
    }
  }
  // A copy of `node` as it looks now, laid over it, for scroll() to move
  // away. (A copy of the strip is renamed, so it isn't taken for the
  // strip, and hidden from screen readers.)
  function snapshot(node: HTMLElement, className?: string) {
    const copy = node.cloneNode(true) as HTMLElement;
    if (className) copy.className = node.className.replace(/\btt-strip\b/, className);
    copy.removeAttribute('role');
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    return copy;
  }
  // Scrolls `node`'s new look in as its old one (`copy`) goes: up when
  // going down to a later program, `by` 1, and down when going up.
  const still = self.matchMedia && self.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function scroll(node: HTMLElement, copy: HTMLElement, by: number) {
    const box = node.parentNode as HTMLElement;
    if (still || !node.animate) return;
    Object.assign(copy.style, {
      position: 'absolute', left: node.offsetLeft + 'px', top: node.offsetTop + 'px',
      width: node.offsetWidth + 'px', margin: 0,
    });
    box.classList.add('tt-scrolling');
    box.appendChild(copy);
    const far = box.clientHeight;
    const timing = { duration: 280, easing: 'ease-in-out' };
    node.animate([{ transform: `translateY(${by * far}px)` }, { transform: 'none' }], timing);
    copy.animate([{ transform: 'none' }, { transform: `translateY(${-by * far}px)` }], timing).onfinish = () => {
      copy.remove();
      if (!box.querySelector('[aria-hidden="true"][inert]')) box.classList.remove('tt-scrolling');
    };
  }

  // The tape buttons: Record glows while recording; while the strip plays,
  // Play is Pause and the others rest; Repeat pulses while a repeat is
  // open; and the trash can lights up under a tile dragged onto it, and
  // turns red after one tap, waiting for a second to empty the strip.
  function renderTape() {
    attr(recordBtn, 'aria-pressed', String(state.recording));
    const play = state.playing ? 'Pause' : 'Play';
    attr(playBtn, 'aria-label', play);
    playBtn.title = play;
    markup(playBtn, state.playing ? BUTTONS.pause : BUTTONS.play);
    [stepBtn, rewindBtn, recordBtn].forEach(b => { b.disabled = state.playing; });
    repeatBtn.classList.toggle('tt-open', Boolean(state.openRepeat));
    attr(repeatBtn, 'aria-pressed', String(Boolean(state.openRepeat)));
    trashBtn.classList.toggle('tt-armed', state.armed);
    attr(trashBtn, 'aria-label', state.armed ? 'Tap again to empty the strip' : 'Trash');
    trashBtn.classList.toggle('tt-drop', Boolean(state.drag && state.drag.trashing));
  }

  // Move and Back go as far as Step size says, which its ruler shows.
  let shownDistance = 0;
  function renderMoves() {
    const n = state.distance;
    if (n === shownDistance) return;
    shownDistance = n;
    ([[moveBtn, n * UNIT], [backBtn, -n * UNIT]] as [HTMLElement, number][]).forEach(([btn, d]) => {
      btn.dataset.d = String(n * UNIT);
      btn.innerHTML = arrowIcon(d);
      btn.setAttribute('aria-label', moveLabel(d));
      btn.title = moveLabel(d);
    });
    sizeBtn.innerHTML = rulerIcon(n);
  }

  // The wheel's arm shows where the turtle will face, and the wedge how far
  // it turns; the turtle in its middle has the turn on it, in degrees.
  let shownAngle = 0;
  function renderWheel() {
    const a = state.angle;
    if (a === shownAngle) return;
    shownAngle = a;
    const [x, y] = polar(C, RING, a);
    ring.querySelector('.tt-wedge')!.setAttribute('d', wedge(C, RING, a));
    ring.querySelector('.tt-arm')!.setAttribute('d', `M${C} ${C} L${x} ${y}`);
    const { arc, head } = arcArrow(C, RING - 10, a, 14);
    ring.querySelector('.tt-arc')!.setAttribute('d', arc);
    ring.querySelector('.tt-arrowhead')!.setAttribute('d', head);
    const knob = ring.querySelector('.tt-knob')!;
    knob.setAttribute('cx', String(x));
    knob.setAttribute('cy', String(y));
    ring.setAttribute('aria-valuenow', String(a));
    ring.setAttribute('aria-valuetext', turnLabel(a));
    go.dataset.angle = String(a);
    goText.textContent = (a > 0 ? '+' : '−') + Math.abs(a);
    goText.style.fontSize = goText.textContent.length > 3 ? '24px' : '30px';
    goText.style.fill = turnTint(a) || '';
    go.setAttribute('aria-label', turnLabel(a));
    go.title = turnLabel(a);
  }

  // The pop-ups: only the open one shows, just above the button that
  // opened it, or beside it for the buttons in the left gutter, kept on
  // the screen (placed when it opens).
  let shownPopup: PopupId | null = null;
  let shownAnchor: HTMLElement | null = null;
  // The element the spinner opened from: the Step size button, a repeat's
  // head, or a move or a turn in the strip.
  function spinAnchor(): HTMLElement | null {
    const target = state.spin;
    if (!target) return null;
    if (target.kind === 'size') return sizeBtn;
    return (target.kind === 'count' ? stripView.headOf(target.item) : stripView.nodeOf(target.item)) || null;
  }
  function renderPopups() {
    // Their insides first, then where the open one goes.
    lookButtons.forEach((b, i) => attr(b, 'aria-pressed', String(LOOKS[i].id === state.look)));
    markup(lookBtn, LOOKS.find(l => l.id === state.look)!.icon);
    speedButtons.forEach(b => attr(b, 'aria-pressed', String(b.dataset.speed === state.pace)));
    markup(speedBtn, animal(state.pace));
    attr(speedBtn, 'aria-label', 'Speed: ' + SPEEDS.find(v => v.id === state.pace)!.label);
    callTiles.forEach(t => {
      const no = blocked(state, t.dataset.p as ProgramName);
      t.classList.toggle('tt-blocked', no);
      attr(t, 'aria-disabled', String(no));
    });
    if (state.spin) {
      const range = spinRange(state, state.spin);
      attr(countPop, 'aria-label', range.label);
      const shown = range.format(range.value);
      if (countNum.textContent !== shown) countNum.textContent = shown;
    }
    const open = state.popup;
    (Object.keys(popups) as PopupId[]).forEach(id => { popups[id].pop.hidden = id !== open; });
    const anchor = open === 'count' ? spinAnchor() : open ? popups[open].btn : null;
    if (anchor !== shownAnchor) {
      if (shownAnchor) shownAnchor.setAttribute('aria-expanded', 'false');
      if (anchor) anchor.setAttribute('aria-expanded', 'true');
    }
    if (open && anchor && (open !== shownPopup || anchor !== shownAnchor)) placePopup(popups[open].pop, anchor);
    shownPopup = open;
    shownAnchor = anchor;
  }
  function placePopup(pop: HTMLElement, btn: HTMLElement) {
    const b = btn.getBoundingClientRect();
    const r = pop.getBoundingClientRect();
    const clamp = (v: number, size: number, room: number) => Math.max(PAD, Math.min(room - size - PAD, v));
    if (left.contains(btn)) {
      pop.style.left = clamp(b.right + GAP, r.width, self.innerWidth) + 'px';
      pop.style.top = clamp(b.top, r.height, self.innerHeight) + 'px';
    } else {
      pop.style.left = clamp(b.left + b.width / 2 - r.width / 2, r.width, self.innerWidth) + 'px';
      pop.style.top = Math.max(PAD, b.top - r.height - GAP) + 'px';
    }
  }

  function renderMenu() {
    menu.hidden = !state.menu;
    grownUps.classList.toggle('tt-holding', state.holding);
    const share = state.copied ? 'Link copied' : 'Share a link';
    if (shareBtn.textContent !== share) shareBtn.textContent = share;
  }

  // The ghost of a dragged tile, under the pointer, faded over the trash.
  function renderDrag() {
    if (!ghost || !state.drag) return;
    ghost.style.transform = `translate(${state.drag.x}px, ${state.drag.y}px)`;
    ghost.classList.toggle('tt-ghost-trash', state.drag.trashing);
  }

  // The stage goes at the speed picked, and its view keeps room around the
  // turtle for its numbers or the lightning (whenever either changes).
  let shownTurtle = '';
  function renderStage() {
    if (!replaying) stageOptions.speed = speedOf(state);
    const now = state.look + ' ' + state.pace;
    if (stage && now !== shownTurtle) stage.view.setTurtlePad(roomAround(state));
    shownTurtle = now;
  }

  // Following the turtle ------------------------------------------------------

  // The dial and the turtle in its middle turn with the turtle on the
  // stage, every frame (and the Colors button shows the pen's color, or a
  // white crayon while the pen is up): straight up on the dial is the way
  // the turtle faces, so the arm always shows the same turn from there, and
  // tapping the turtle again turns it the same way again.
  let heading = 0;
  let penColor: string | null = null;
  wheel.dataset.heading = '0';
  requestAnimationFrame(function follow() {
    const turtle = stage && stage.logo.turtle;
    if (turtle) {
      const h = Math.round((90 - turtle.r * 180 / Math.PI) * 100) / 100;
      if (h !== heading) {
        heading = h;
        dial.setAttribute('transform', `rotate(${h} ${C} ${C})`);
        turtleTurn.setAttribute('transform', `rotate(${h})`);
        wheel.dataset.heading = String(Math.round(((h % 360) + 360) % 360));
      }
      const { look, pace } = state;
      const at = (look !== 'turtle' || pace !== 'turtle') && stage!.view.turtleAt && stage!.view.turtleAt();
      if (at) {
        posMarker.style.transform = `translate(${at.x}px, ${at.y}px)`;
        markerDot.style.background = turtle.pendown ? turtle.color : '#fff';
        if (look === 'arrow') pointArrow(turtle, at);
        else if (pace !== 'turtle') showAnimal(turtle, at);
        markerText.textContent = Math.round(turtle.x) + ', ' + Math.round(turtle.y);
        // The heading, just past the turtle's nose (20 steps ahead), with
        // room between, whichever way it faces.
        const heading = ((Math.round(90 - turtle.r * 180 / Math.PI) % 360) + 360) % 360;
        const rad = heading * Math.PI / 180;
        markerHeading.textContent = heading + '°';
        const ahead = 20 * at.scale + 6 + Math.abs(Math.sin(rad)) * markerHeading.offsetWidth / 2 +
          Math.abs(Math.cos(rad)) * markerHeading.offsetHeight / 2;
        // The coordinates go beside the dot on a side the turtle isn't
        // facing, so they keep clear of the heading: right if they can,
        // else below, left or above.
        const way = [Math.sin(rad), -Math.cos(rad)];
        const side = XY_SIDES.find(([dx, dy]) => dx * way[0] + dy * way[1] < 0.25) || XY_SIDES[0];
        markerText.style.transform = side[2];
        markerHeading.style.transform =
          `translate(calc(${Math.sin(rad) * ahead}px - 50%), calc(${-Math.cos(rad) * ahead}px - 50%))`;
      }
      const pen = turtle.pendown ? turtle.color : 'up';
      if (pen !== penColor) {
        penColor = pen;
        colorsBtn.innerHTML = crayon(turtle.pendown ? turtle.color : '#fff');
        colorsBtn.dataset.color = turtle.color;
      }
    }
    requestAnimationFrame(follow);
  });
  const XY_SIDES: [number, number, string][] = [
    [1, 0, 'translate(16px, -50%)'], [0, 1, 'translate(-50%, 14px)'],
    [-1, 0, 'translate(calc(-100% - 16px), -50%)'], [0, -1, 'translate(-50%, calc(-100% - 14px))'],
  ];
  let arrowWas = '';
  function pointArrow(turtle: CanvasTurtle, at: TurtleAt) {
    const w = Math.max(1, turtle.penwidth * at.zoom);  // the shaft, as wide as the line
    const half = Math.max(7, w * 1.4);  // the head's half width
    const long = Math.max(13, w * 2.2);  // and its length
    const shaft = 8;
    const r = (n: number) => Math.round(n * 10) / 10;
    const d = `M${r(-w / 2)} 0 V${-shaft} H${r(-half)} L0 ${r(-shaft - long)} L${r(half)} ${-shaft} ` +
      `H${r(w / 2)} V0 Z`;
    const heading = 90 - turtle.r * 180 / Math.PI;
    const now = d + heading + turtle.pendown + turtle.color;
    if (now === arrowWas) return;
    arrowWas = now;
    arrowPath.setAttribute('d', d);
    arrowPath.setAttribute('fill', turtle.pendown ? turtle.color : '#fff');
    arrowPath.setAttribute('stroke', turtle.pendown ? 'none' : 'rgba(0, 0, 0, .45)');
    arrowPath.setAttribute('transform', `rotate(${r(heading)})`);
  }
  let animalWas = '';
  function showAnimal(turtle: CanvasTurtle, at: TurtleAt) {
    const { pace } = state;
    const heading = ((90 - turtle.r * 180 / Math.PI) % 360 + 360) % 360;
    const size = Math.round(44 * at.scale);
    const now = pace + size + heading;
    if (now === animalWas) return;
    if (!animalWas.startsWith(pace)) markerAnimal.innerHTML = `<svg viewBox="0 0 64 64">${ABOVE[pace]}</svg>`;
    animalWas = now;
    markerAnimal.style.width = markerAnimal.style.height = size + 'px';
    // The animals turn about their middles; lightning turns about its
    // point, which stays on the turtle's place.
    const [ox, oy] = pace === 'bolt' ? BOLT_TIP.map(v => v / 64 * 100) : [50, 50];
    markerAnimal.style.transformOrigin = `${ox}% ${oy}%`;
    markerAnimal.style.transform = `translate(${-ox}%, ${-oy}%) rotate(${Math.round(heading * 10) / 10}deg)`;
  }

  // Layout and the stage ------------------------------------------------------

  // Picks the arrangement and the tile size for the page's size (a new
  // arrangement closes any pop-up).
  function layout() {
    const best = plan(root.clientWidth - 2 * PAD, root.clientHeight - 2 * PAD);
    state.size = best.size;
    if (best.layout !== state.layout) {
      if (state.layout) closePopup(state);
      state.layout = best.layout;
    }
    commit();
  }

  // The stage fills its area. Its view (in turtle steps) takes the area's
  // shape when the stage is made, and it is made again if the area's
  // shape changes a lot, as when a phone is turned; then everything the
  // turtle has done since the last fresh start is done again, at once
  // and silently, to bring the drawing and the turtle back.
  let history: string[] = [];
  function fitStage() {
    const [vw, vh] = stageOptions.view;
    const w = stageArea.clientWidth;
    const h = stageArea.clientHeight;
    stageHost.style.width = Math.max(60, Math.min(w, h * vw / vh)) + 'px';
  }
  function makeStage() {
    const w = Math.max(1, stageArea.clientWidth);
    const h = Math.max(1, stageArea.clientHeight);
    stageOptions.view = w >= h
      ? [Math.round(SHORT_SIDE * w / h), SHORT_SIDE]
      : [SHORT_SIDE, Math.round(SHORT_SIDE * h / w)];
    stageHost.textContent = '';
    fitStage();
    stage = LogoStage.create(stageHost, stageOptions);
    stage.element.appendChild(posMarker);
    stage.view.setTurtlePad(roomAround(state));
  }
  function reshaped() {
    const [vw, vh] = stageOptions.view;
    const ratio = (stageArea.clientWidth / Math.max(1, stageArea.clientHeight)) / (vw / vh);
    return Math.abs(Math.log(ratio)) > 0.25;
  }

  commit();
  layout();
  makeStage();

  // Running -----------------------------------------------------------------

  // Everything the turtle does goes through one queue, in order. Making
  // the stage again makes anything still waiting from before it skip.
  let queue: Promise<unknown> = stage!.fresh().then(() => stage!.run(PRELUDE));
  let generation = 0;
  function schedule(fn: () => unknown) {
    const g = generation;
    const run = () => (g === generation ? fn() : null);
    state.waiting++;
    render();
    queue = queue.then(run, run).catch(() => {}).then(() => {
      state.waiting--;
      render();
    });
    return queue;
  }

  // Runs Logo on the stage, remembering it (silently) for remaking it.
  function perform(code: string, silentCode = code) {
    if (silentCode) history.push(silentCode);
    return stage!.run(code);
  }
  // A tile's Logo, run, while `shown` (the tile in the strip, if any) is lit
  // up.
  async function performTile(item: Tile, shown: Tile | null) {
    if (shown) {
      state.active = shown;
      render();
    }
    try {
      await perform(codeFor(state.programs, item), codeFor(state.programs, item, true));
    } finally {
      if (shown && state.active === shown) {
        state.active = null;
        render();
      }
    }
  }

  function relayout() {
    layout();
    if (!reshaped()) {
      fitStage();
      return;
    }
    generation++;
    stage!.stop();
    makeStage();
    schedule(replay);
  }
  // Starts the stage again and, at once, does everything in the history.
  async function replay() {
    stageOptions.speed = 'instant';
    replaying = true;
    try {
      await stage!.fresh();
      await stage!.run(PRELUDE + '\n' + history.join(' '));
    } finally {
      replaying = false;
      stageOptions.speed = speedOf(state);
    }
  }
  // The stage area changes size with the page, and also when the strip
  // grows or shrinks a line, which leaves the page the same size.
  if (self.ResizeObserver) {
    const observer = new ResizeObserver(relayout);
    observer.observe(root);
    observer.observe(stageArea);
  }
  else self.addEventListener('resize', relayout);

  // A tile's (or a button's) bounce, when tapped.
  function flash(node: HTMLElement | null | undefined) {
    if (!node) return;
    node.classList.remove('tt-bounce');
    void node.offsetWidth;  // restart the animation
    node.classList.add('tt-bounce');
    // Then let it go, or the bounce would play again whenever the tile
    // shows again (as when a pop-up opens).
    const done = (e: AnimationEvent) => {
      if (e.target !== node || e.animationName !== 'tt-bounce') return;
      node.classList.remove('tt-bounce');
      node.removeEventListener('animationend', done);
    };
    node.addEventListener('animationend', done);
  }
  // Scrolls the strip to show `item`.
  function reveal(item: Item | null | undefined) {
    const node = stripView.nodeOf(item);
    if (node) node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // Plays the tile at the playhead, lit up, and moves the playhead on
  // (back to the start after the last tile).
  async function playStep(list: Step[]) {
    const step = list[state.playhead];
    await performTile(step.item, step.item);
    advance(state, list.length);
    commit();
  }

  function play() {
    if (state.playing) {
      state.pausing = true;
      return;
    }
    if (!steps(state).length) {
      flash(playBtn);
      return;
    }
    select(state, null);
    commit();
    schedule(async () => {
      state.playing = true;
      state.pausing = false;
      commit();
      try {
        const list = steps(state);
        do {
          await playStep(list);
        } while (state.playhead !== 0 && !state.pausing);
      } finally {
        state.playing = false;
        commit();
      }
    });
  }

  function step() {
    if (state.playing) return;
    const list = steps(state);
    flash(stepBtn);
    if (!list.length) return;
    select(state, null);
    commit();
    schedule(() => playStep(list));
  }

  // Tapping a source tile: the turtle does it now, and, while recording,
  // it joins the strip (see record). Repeat, while recording, opens or
  // closes a repeat in the strip (see tapRepeat).
  function tapSource(node: HTMLElement) {
    // A crayon or a program picked closes its pop-up; the notes stay open
    // for a tune.
    const open = state.popup;
    if (open && ['crayons', 'plays'].includes(open) && popups[open].pop.contains(node)) closePopup(state);
    const id = node.dataset.tile!;
    if (id === 'call' && blocked(state, node.dataset.p as ProgramName)) {
      flash(node);
      commit();
      return;
    }
    if (id === 'repeat') {
      const done = tapRepeat(state);
      if (done === 'refused') flash(node);
      commit();
      if (done === 'opened') reveal(state.openRepeat);
      return;
    }
    const item = sourceItem(state, id, node.dataset.p) as Tile;  // (not a repeat)
    flash(node);
    let added: Tile | null = null;
    if (state.recording) {
      added = record(state, item, Boolean(stage && !stage.logo.turtle.pendown)) as Tile | null;
      changed(state);
      commit();
      reveal(added);
    }
    schedule(() => performTile(item, added));
  }

  // Tapping in the strip: a repeat's head opens its count; another tile
  // moves the playhead to it, and a move or a turn opens the spinner to
  // change it.
  function tapStripItem(node: HTMLElement) {
    const item = stripView.itemOf(node)!;
    tapItem(state, item);
    if (item.t === 'turn') flash(go);
    if (item.t !== 'repeat') flash(node);
    commit();
  }

  // Dragging ------------------------------------------------------------------

  function startDrag(e: PointerEvent, node: HTMLElement, fromSource: boolean): Drag {
    const item = fromSource ? null : stripView.itemOf(node)!;
    const r = node.getBoundingClientRect();
    ghost = node.cloneNode(true) as HTMLElement;
    // No bounce or highlight on the ghost: an animation would move it.
    const marks = ['tt-bounce', 'tt-active', 'tt-next'];
    [ghost, ...ghost.querySelectorAll('.tt-bounce, .tt-active, .tt-next')].forEach(n => n.classList.remove(...marks));
    ghost.classList.add('tt-ghost');
    ghost.style.width = r.width + 'px';
    ghost.style.height = r.height + 'px';
    document.body.appendChild(ghost);
    const offset = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (state.popup && popups[state.popup].pop.contains(node)) closePopup(state);
    // Where it lands: a place in the strip, or (for a tile from the
    // strip) the trash can. Dropped anywhere else, it goes back.
    const drag = state.drag = {
      moving: item || sourceItem(state, node.dataset.tile!, node.dataset.p),
      lifted: item, drop: null, trashing: false, x: r.left, y: r.top,
    } as NonNullable<typeof state.drag>;
    commit();
    return {
      move(ev: PointerEvent) {
        drag.x = ev.clientX - offset.x;
        drag.y = ev.clientY - offset.y;
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        drag.trashing = Boolean(item && under && trashBtn.contains(under));
        drag.drop = drag.trashing ? null : stripView.dropAt(ev.clientX, ev.clientY, drag.moving, item, stripArea);
        commit();
      },
      end(cancelled: boolean) {
        ghost!.remove();
        ghost = null;
        state.drag = null;
        if (!cancelled && dropDragged(state, drag).trashed) flash(trashBtn);
        commit();
      },
    };
  }

  // A press on a tile is a tap, or a drag once it moves a little. While
  // the strip plays, the tiles rest.
  root.addEventListener('pointerdown', e => {
    self.LogoMusic.unlock();
    const tile = (e.target as Element).closest<HTMLElement>('.tt-tile');
    if (!tile || state.playing || e.button > 0) return;
    e.preventDefault();
    const fromSource = tile.classList.contains('tt-source');
    const node = fromSource ? tile : tile.closest<HTMLElement>('.tt-item')!;
    const start = { x: e.clientX, y: e.clientY };
    let drag: Drag | null = null;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const stuck = fromSource && tile.dataset.tile === 'call' && blocked(state, tile.dataset.p as ProgramName);
      if (!drag && !stuck && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) {
        drag = startDrag(e, node, fromSource);
      }
      if (drag) drag.move(ev);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      self.removeEventListener('pointermove', move);
      self.removeEventListener('pointerup', end);
      self.removeEventListener('pointercancel', end);
      if (drag) drag.end(ev.type === 'pointercancel');
      else if (ev.type === 'pointerup') (fromSource ? tapSource : tapStripItem)(node);
    };
    self.addEventListener('pointermove', move);
    self.addEventListener('pointerup', end);
    self.addEventListener('pointercancel', end);
  });
  root.addEventListener('keydown', e => {
    const target = e.target as Element;
    const tile = target.closest && target.closest<HTMLElement>('.tt-tile');
    if (!tile || state.playing || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    if (tile.classList.contains('tt-source')) tapSource(tile);
    else tapStripItem(tile.closest<HTMLElement>('.tt-item')!);
  });
  root.addEventListener('contextmenu', e => e.preventDefault());

  // Buttons -----------------------------------------------------------------

  // A press anywhere but the open pop-up and its button closes it; and
  // anywhere but the trash can calls off emptying the strip.
  document.addEventListener('pointerdown', e => {
    const target = e.target as Node;
    let changes = false;
    if (state.popup) {
      const { pop } = popups[state.popup];
      if (!pop.contains(target) && !(shownAnchor && shownAnchor.contains(target))) {
        closePopup(state);
        changes = true;
      }
    }
    if (state.armed && !trashBtn.contains(target)) {
      disarm();
      changes = true;
    }
    if (changes) commit();
  }, true);

  ([[progUp, -1], [progDown, 1]] as const).forEach(([b, by]) => b.addEventListener('click', () => {
    if (goProgram(state, by)) commit();
  }));
  sizeBtn.addEventListener('click', () => {
    openSpinner(state, { kind: 'size' });
    commit();
  });
  // The spinner's arrows; holding one counts fast.
  ([[upBtn, 1], [downBtn, -1]] as const).forEach(([b, delta]) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => clearTimeout(timer);
    const count = () => {
      spinBy(state, delta);
      commit();
    };
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      count();
      timer = setTimeout(function again() {
        count();
        timer = setTimeout(again, 90);
      }, 450);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => b.addEventListener(type, stop));
    b.addEventListener('click', e => { if (e.detail === 0) count(); });  // the keyboard
  });

  // Tapping or dragging on the ring moves the arm to the nearest step,
  // measured from the way the turtle faces.
  function aim(e: PointerEvent) {
    const r = ring.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) return;
    setAngle(state, Math.atan2(dx, -dy) * 180 / Math.PI - heading);
    commit();
  }
  ring.addEventListener('pointerdown', e => {
    e.preventDefault();
    ring.setPointerCapture(e.pointerId);
    aim(e);
    const move = (ev: PointerEvent) => aim(ev);
    const up = () => {
      ring.removeEventListener('pointermove', move);
      ring.removeEventListener('pointerup', up);
      ring.removeEventListener('pointercancel', up);
    };
    ring.addEventListener('pointermove', move);
    ring.addEventListener('pointerup', up);
    ring.addEventListener('pointercancel', up);
  });
  ring.addEventListener('keydown', e => {
    const by = ({ ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP } as Record<string, number>)[e.key];
    if (!by) return;
    e.preventDefault();
    nudgeAngle(state, by);
    commit();
  });

  // Clear wipes the drawing, sends the turtle home and rewinds the strip,
  // so the next Play starts from the beginning.
  clearBtn.addEventListener('click', () => {
    flash(clearBtn);
    rewind(state);
    commit();
    schedule(() => perform('clean ' + HOME));
  });
  recordBtn.addEventListener('click', () => {
    setRecording(state, !state.recording);
    commit();
  });
  playBtn.addEventListener('click', play);
  stepBtn.addEventListener('click', step);
  rewindBtn.addEventListener('click', () => {
    flash(rewindBtn);
    rewind(state);
    commit();
  });
  // The trash can: drag a tile from the strip onto it to throw the tile
  // away. Tapping it empties the whole strip, but only after a second tap
  // to confirm: the first makes it turn red and pulse for a few seconds.
  let armed: ReturnType<typeof setTimeout> | undefined;
  function disarm() {
    clearTimeout(armed);
    state.armed = false;
  }
  trashBtn.addEventListener('click', () => {
    if (!program(state).length || state.playing) {
      flash(trashBtn);
      return;
    }
    if (state.armed) {
      disarm();
      emptyProgram(state);
    } else {
      state.armed = true;
      armed = setTimeout(() => {
        disarm();
        commit();
      }, CONFIRM_MS);
    }
    commit();
  });

  // The grown-ups menu opens after holding its button down (or from the
  // keyboard), so small fingers don't open it by accident.
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  const openMenu = () => {
    state.menu = true;
    commit();
  };
  grownUps.addEventListener('pointerdown', () => {
    state.holding = true;
    commit();
    holdTimer = setTimeout(openMenu, HOLD_MS);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => grownUps.addEventListener(type, () => {
    clearTimeout(holdTimer);
    state.holding = false;
    commit();
  }));
  grownUps.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    }
  });

  // Recording starts only when Record is tapped, so nothing is added
  // to a program by surprise.
  commit();
  openShared();

  // Opened from a shared link: its programs replace these (asking first
  // if that would lose some), then the address goes back to the plain
  // page, so reloading doesn't load them again.
  async function openShared() {
    const query = new URLSearchParams(location.search);
    const text = query.get(SHARE_PARAM);
    if (!text) return;
    try {
      // (Anything at all, parsed: clean() makes sense of its programs.)
      const data = await unpack(text) as IncomingPayload;
      const incoming = {} as Programs;  // (each set here)
      NAMES.forEach(n => { incoming[n] = clean(data.programs && data.programs[n]); });
      if (!differs(state, incoming) || self.confirm('Open the shared programs? They replace the programs here.')) {
        openPrograms(state, incoming, isName(data.current) ? data.current : 'A');
        commit();
      }
    } catch (e) {
      console.warn('Turtle Tiles: could not open the shared link.', e);
    }
    query.delete(SHARE_PARAM);
    const rest = query.toString();
    self.history.replaceState(self.history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
  }
}

export const LogoTiles = { init };
