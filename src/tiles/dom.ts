// Making Turtle Tiles' elements: plain elements, round buttons with a
// picture, and tiles.
import type { TileLook } from './pictures.js';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string | null,
  parent?: Element | null): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (parent) parent.appendChild(node);
  return node;
}

export function iconButton(className: string, label: string, icon: string, parent?: Element) {
  const b = el('button', 'tt-button ' + className, parent);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.title = label;
  b.innerHTML = icon;
  return b;
}

// A tile, showing `def` (see showTile).
export function tileElement(def: Pick<TileLook, 'id' | 'label' | 'icon' | 'color'>, className?: string) {
  const t = el('div', 'tt-tile ' + (className || ''));
  t.setAttribute('role', 'button');
  t.tabIndex = 0;
  showTile(t, def);
  return t;
}
// Shows `def` on tile `t`: its id, color, spoken name and picture.
export function showTile(t: HTMLElement, def: Pick<TileLook, 'id' | 'label' | 'icon' | 'color'>) {
  t.dataset.tile = def.id;
  t.style.setProperty('--tile-color', def.color);
  t.setAttribute('aria-label', def.label);
  t.innerHTML = def.icon;
}

// Sets attribute `name` of `node` to `value` (or removes it, for null),
// if it isn't already.
export function attr(node: Element, name: string, value: string | null) {
  if (value === null) {
    if (node.hasAttribute(name)) node.removeAttribute(name);
  } else if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}
// Sets `node`'s markup to `html`, if it was set to something else (a
// picture redrawn only when it changes).
const drawn = new WeakMap<Element, string>();
export function markup(node: Element, html: string) {
  if (drawn.get(node) === html) return;
  drawn.set(node, html);
  node.innerHTML = html;
}
