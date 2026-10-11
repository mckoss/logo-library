// Strip.svelte's props and exports, for TypeScript (tsc doesn't read
// .svelte files; the component declares the same props).
import type { Component } from 'svelte';
import type { StripExports, StripProps } from './strip.svelte.js';

declare const Strip: Component<StripProps, StripExports>;
export default Strip;
