// Music commands for Logo, played with Web Audio:
//
//   PLAYNOTE note beats   play a MIDI note number (60 is middle C) and wait
//   SETINSTRUMENT name    a name below, or a General MIDI program number
//   SETTEMPO bpm          beats per minute (default 120)
//
// LogoMusic.install(logo) adds them to a jslogo interpreter; LogoMusic.stop()
// silences anything still sounding; LogoMusic.capture() taps the sound for
// recording.
(function (global) {
  'use strict';

  // Each instrument is one oscillator (or noise) through an envelope:
  // attack and decay in seconds, sustain as a fraction of full volume.
  const INSTRUMENTS = {
    piano:       { wave: 'triangle', attack: 0.005, decay: 0.8, sustain: 0.15 },
    harpsichord: { wave: 'sawtooth', attack: 0.002, decay: 0.4, sustain: 0.05, filter: 3000 },
    musicbox:    { wave: 'sine', attack: 0.002, decay: 0.5, sustain: 0, octave: 1 },
    organ:       { wave: 'square', attack: 0.01, decay: 0.05, sustain: 0.6, filter: 1800 },
    guitar:      { wave: 'triangle', attack: 0.003, decay: 0.6, sustain: 0.1, filter: 2200 },
    bass:        { wave: 'triangle', attack: 0.005, decay: 0.4, sustain: 0.4, octave: -1 },
    hendrix:     { wave: 'sawtooth', attack: 0.01, decay: 0.2, sustain: 0.7, filter: 1400, drive: true },
    violin:      { wave: 'sawtooth', attack: 0.08, decay: 0.1, sustain: 0.8, filter: 2600, vibrato: 6 },
    trumpet:     { wave: 'sawtooth', attack: 0.03, decay: 0.1, sustain: 0.8, filter: 1800 },
    brass:       { wave: 'sawtooth', attack: 0.05, decay: 0.1, sustain: 0.8, filter: 1100 },
    clarinet:    { wave: 'square', attack: 0.04, decay: 0.1, sustain: 0.7, filter: 1600 },
    flute:       { wave: 'sine', attack: 0.06, decay: 0.1, sustain: 0.8, vibrato: 5 },
    synth:       { wave: 'square', attack: 0.01, decay: 0.1, sustain: 0.6 },
    banjo:       { wave: 'square', attack: 0.002, decay: 0.3, sustain: 0, filter: 2500 },
    steeldrum:   { wave: 'sine', attack: 0.002, decay: 0.6, sustain: 0.05, bell: true },
    tom:         { wave: 'sine', attack: 0.002, decay: 0.35, sustain: 0, drop: true },
    gun:         { noise: true, attack: 0.001, decay: 0.3, sustain: 0 },
  };

  // General MIDI program numbers: the ones the 1995 player used, then the
  // closest instrument for each family of eight programs.
  const GM_PROGRAMS = {
    6: 'harpsichord', 10: 'musicbox', 24: 'guitar', 30: 'hendrix', 40: 'violin',
    56: 'trumpet', 61: 'brass', 73: 'flute', 105: 'banjo', 114: 'steeldrum',
    117: 'tom', 127: 'gun',
  };
  const GM_FAMILIES = [
    'piano', 'musicbox', 'organ', 'guitar', 'bass', 'violin', 'violin', 'brass',
    'clarinet', 'flute', 'synth', 'synth', 'synth', 'banjo', 'steeldrum', 'gun',
  ];

  const VOLUME = 0.25;
  const RELEASE = 0.05;

  let context = null;
  let master = null;
  const sounding = new Set();

  function audio() {
    if (!context) {
      const AudioContext = global.AudioContext || global.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = VOLUME;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume();
    return context;
  }

  // Resolves once the audio clock is running. A new or suspended context's
  // clock stands still while it starts, so notes scheduled before then would
  // all start at the same moment and play together.
  function running() {
    const ctx = audio();
    if (!ctx || ctx.state === 'running') return Promise.resolve();
    return Promise.race([ctx.resume(), new Promise(resolve => setTimeout(resolve, 1000))]);
  }

  function noiseBuffer(ctx) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // When the last note scheduled ends, on the audio clock.
  let nextStart = 0;

  function sound(inst, midi, seconds) {
    const ctx = audio();
    if (!ctx) return;
    // Start when the previous note ends, or now if that's past. The audio
    // clock can stand still for a moment after audio starts, so scheduling
    // every note "now" would play the first few at once.
    const t0 = Math.max(ctx.currentTime, nextStart);
    nextStart = t0 + seconds;
    const end = t0 + seconds;
    const freq = 440 * Math.pow(2, (midi + 12 * (inst.octave || 0) - 69) / 12);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(1, t0 + inst.attack);
    // Each setTargetAtTime starts from wherever the previous one left off.
    env.gain.setTargetAtTime(inst.sustain, t0 + inst.attack, inst.decay / 3);
    env.gain.setTargetAtTime(0, end, RELEASE / 3);

    let out = env;
    if (inst.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = inst.filter;
      filter.connect(env);
      out = filter;
    }
    if (inst.drive) {
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) curve[i] = Math.tanh((i / 128 - 1) * 4);
      shaper.curve = curve;
      shaper.connect(out);
      out = shaper;
    }
    env.connect(master);

    const sources = [];
    if (inst.noise) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      src.connect(out);
      sources.push(src);
    } else {
      const osc = ctx.createOscillator();
      osc.type = inst.wave;
      osc.frequency.setValueAtTime(freq, t0);
      if (inst.drop) osc.frequency.exponentialRampToValueAtTime(freq / 2, t0 + inst.decay);
      if (inst.vibrato) {
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = inst.vibrato;
        depth.gain.value = freq * 0.006;
        lfo.connect(depth);
        depth.connect(osc.frequency);
        sources.push(lfo);
      }
      osc.connect(out);
      sources.push(osc);
      if (inst.bell) {
        // A steel drum's bright overtone, a little above two octaves.
        const partial = ctx.createOscillator();
        const level = ctx.createGain();
        partial.frequency.value = freq * 2.76;
        level.gain.value = 0.3;
        partial.connect(level);
        level.connect(out);
        sources.push(partial);
      }
    }

    const voice = { sources, env };
    sources.forEach(src => {
      src.start(t0);
      src.stop(end + RELEASE * 4);
    });
    sources[sources.length - 1].onended = () => {
      env.disconnect();
      sounding.delete(voice);
    };
    sounding.add(voice);
  }

  // Browsers only let a page start sound from inside a click or key
  // press, and a Logo program plays its notes later, so start the audio on
  // any interaction with a Logo program. On iPhone and iPad, also ask to play
  // even when the ring/silent switch is set to silent.
  let unlocked = false;
  function unlock() {
    try {
      if (navigator.audioSession && navigator.audioSession.type !== 'playback') {
        navigator.audioSession.type = 'playback';
      }
    } catch (e) { /* not supported */ }
    const ctx = audio();
    if (!ctx || unlocked) return;
    unlocked = true;
    const silence = ctx.createBufferSource();
    silence.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    silence.connect(ctx.destination);
    silence.start();
  }
  ['pointerdown', 'keydown'].forEach(type => global.addEventListener(type, e => {
    if (e.target.closest && e.target.closest('.logo-code, .logo-worksheet, .logo-playground')) unlock();
  }, true));

  function stop() {
    nextStart = 0;
    for (const voice of sounding) {
      voice.sources.forEach(src => { try { src.stop(); } catch (e) { /* already stopped */ } });
      voice.env.disconnect();
    }
    sounding.clear();
  }

  // A MediaStream of everything the music plays, for recording, until its
  // end() is called; null without Web Audio.
  function capture() {
    const ctx = audio();
    if (!ctx || !ctx.createMediaStreamDestination) return null;
    const tap = ctx.createMediaStreamDestination();
    master.connect(tap);
    return { stream: tap.stream, end: () => master.disconnect(tap) };
  }

  function lookupInstrument(value) {
    if (typeof value === 'number' || /^\d+$/.test(String(value))) {
      const n = Math.floor(Number(value)) & 127;
      return GM_PROGRAMS[n] || GM_FAMILIES[n >> 3];
    }
    const name = String(value).toLowerCase();
    if (!INSTRUMENTS[name]) {
      throw new Error('SETINSTRUMENT: unknown instrument ' + value +
        '. Try ' + Object.keys(INSTRUMENTS).join(', ') + ', or a number 0 to 127.');
    }
    return name;
  }

  // Registers a primitive the way jslogo's own def() does: the function's
  // parameter count is its fixed number of inputs.
  function define(logo, name, fn) {
    fn.minimum = fn.default = fn.maximum = fn.length;
    fn.primitive = true;
    logo.routines.set(name, fn);
  }

  function install(logo) {
    const state = { instrument: 'piano', tempo: 120 };

    define(logo, 'playnote', (note, beats) => {
      const midi = Number(note);
      const length = Number(beats);
      if (!isFinite(midi) || !isFinite(length) || length < 0) {
        throw new Error('PLAYNOTE needs a note number and a number of beats, like PLAYNOTE 60 1');
      }
      const seconds = length * 60 / state.tempo;
      return running().then(() => {
        // If the browser still won't start audio, stay silent rather than
        // queue notes that would all sound at once when it does.
        if (context && context.state === 'running') sound(INSTRUMENTS[state.instrument], midi, seconds);
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
      });
    });

    define(logo, 'setinstrument', name => {
      state.instrument = lookupInstrument(name);
    });

    define(logo, 'settempo', bpm => {
      const tempo = Number(bpm);
      if (!(tempo > 0)) throw new Error('SETTEMPO needs a number of beats per minute, like SETTEMPO 120');
      state.tempo = tempo;
    });
  }

  global.LogoMusic = { install, stop, unlock, capture, instruments: Object.keys(INSTRUMENTS) };
}(self));
