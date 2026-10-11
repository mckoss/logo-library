// The music player's instruments, and the arithmetic of notes: pure data
// and functions, used by music.ts and checked by the unit tests.

// An instrument: one oscillator of the wave `wave` (or noise), through an
// envelope, with optional extras.
export type Instrument = {
  attack: number;      // seconds to full volume
  decay: number;       // seconds (roughly) to fall to the sustain level
  sustain: number;     // the held volume, a fraction of full
  filter?: number;     // a low-pass filter's cutoff, in Hz
  octave?: number;     // octaves to shift every note by
  drive?: boolean;     // distortion
  vibrato?: number;    // vibrato, in Hz
  bell?: boolean;      // a steel drum's bright overtone
  drop?: boolean;      // the pitch falls an octave over the decay (a drum)
} & ({ wave: OscillatorType; noise?: undefined } | { noise: true; wave?: undefined });

// Each instrument is one oscillator (or noise) through an envelope:
// attack and decay in seconds, sustain as a fraction of full volume.
export const INSTRUMENTS: Record<string, Instrument> = {
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
export const GM_PROGRAMS: Record<number, string> = {
  6: 'harpsichord', 10: 'musicbox', 24: 'guitar', 30: 'hendrix', 40: 'violin',
  56: 'trumpet', 61: 'brass', 73: 'flute', 105: 'banjo', 114: 'steeldrum',
  117: 'tom', 127: 'gun',
};
export const GM_FAMILIES = [
  'piano', 'musicbox', 'organ', 'guitar', 'bass', 'violin', 'violin', 'brass',
  'clarinet', 'flute', 'synth', 'synth', 'synth', 'banjo', 'steeldrum', 'gun',
];

// The frequency, in Hz, of the MIDI note number `midi` (60 is middle C, 69
// the A at 440 Hz) played on `inst`, which may shift it by octaves.
export function frequency(inst: Instrument, midi: number): number {
  return 440 * Math.pow(2, (midi + 12 * (inst.octave || 0) - 69) / 12);
}

// The instrument SETINSTRUMENT's input names: an instrument's name (any
// case), or a General MIDI program number (0 to 127, wrapping round). Throws
// a Logo error for a name it doesn't know.
export function lookupInstrument(value: unknown): string {
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
