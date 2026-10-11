// ProgramScroller.svelte's props, for TypeScript (tsc doesn't read .svelte
// files; the component declares the same props).
import type { Component } from 'svelte';
import type { ScrollerProps } from './strip.svelte.js';

declare const ProgramScroller: Component<ScrollerProps>;
export default ProgramScroller;
