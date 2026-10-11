// The globals the engine publishes (src/engine/index.ts), for the code that
// uses them: the controls, and the e2e tests through `window`. jslogo's own
// globals, CanvasTurtle and LogoInterpreter, are in jslogo.d.ts. Declared
// with `var`, so they're typed as `self.LogoStage`, `window.LogoStage` and
// plain `LogoStage` alike:
//
//   const { LogoStage } = self;
//   const stage = LogoStage.create(host, { view: [600, 360] });
import type { LogoStageApi } from '../engine/runtime.js';
import type { LogoViewApi } from '../engine/view.js';
import type { LogoDebugApi } from '../engine/debug.js';
import type { LogoMusicApi } from '../engine/music.js';

declare global {
  // Stages: LogoStage.create(host, options), and the page's speed setting.
  var LogoStage: LogoStageApi;
  // Zoom and pan for a stage.
  var LogoView: LogoViewApi;
  // Stepping and breakpoints for a stage.
  var LogoDebug: LogoDebugApi;
  // The music commands.
  var LogoMusic: LogoMusicApi;
  // The music player library's source (player.lgo).
  var LOGO_LIBRARY: string;

  // Older Safari's Web Audio.
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }

  // Safari's audio session, which can play through the silent switch.
  interface Navigator {
    audioSession?: { type: string };
  }
}

export {};
