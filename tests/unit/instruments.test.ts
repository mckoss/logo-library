// The music player's instruments and notes (src/engine/instruments.ts):
// what SETINSTRUMENT accepts, and the pitch PLAYNOTE plays.
import { describe, expect, it } from 'vitest';
import { GM_FAMILIES, GM_PROGRAMS, INSTRUMENTS, frequency, lookupInstrument } from '../../src/engine/instruments.js';

describe('lookupInstrument', () => {
  it('takes an instrument\'s name, in any case', () => {
    expect(lookupInstrument('piano')).toBe('piano');
    expect(lookupInstrument('Violin')).toBe('violin');
    expect(lookupInstrument('STEELDRUM')).toBe('steeldrum');
  });

  it('takes the General MIDI programs the 1995 player used', () => {
    expect(lookupInstrument(6)).toBe('harpsichord');
    expect(lookupInstrument(30)).toBe('hendrix');
    expect(lookupInstrument(73)).toBe('flute');
    expect(lookupInstrument(127)).toBe('gun');
  });

  it('takes any other program as its family\'s instrument', () => {
    expect(lookupInstrument(0)).toBe('piano');
    expect(lookupInstrument(7)).toBe('piano');
    expect(lookupInstrument(16)).toBe('organ');
    expect(lookupInstrument(33)).toBe('bass');
    expect(lookupInstrument(57)).toBe('brass');
    expect(lookupInstrument(120)).toBe('gun');
  });

  it('takes a number as a Logo word, rounds it down, and wraps past 127', () => {
    expect(lookupInstrument('24')).toBe('guitar');
    expect(lookupInstrument(24.9)).toBe('guitar');
    expect(lookupInstrument(128 + 24)).toBe('guitar');
    expect(lookupInstrument(-1)).toBe(lookupInstrument(127));
  });

  it('refuses a name it doesn\'t know, listing the ones it does', () => {
    expect(() => lookupInstrument('kazoo')).toThrow(/^SETINSTRUMENT: unknown instrument kazoo\. Try piano, harpsichord, .*gun, or a number 0 to 127\.$/);
    expect(() => lookupInstrument('2.5')).toThrow(/unknown instrument 2\.5/);
  });

  it('only ever names an instrument that exists', () => {
    for (let n = 0; n < 128; n++) expect(INSTRUMENTS[lookupInstrument(n)]).toBeDefined();
    expect(GM_FAMILIES).toHaveLength(16);
    Object.values(GM_PROGRAMS).forEach(name => expect(INSTRUMENTS[name]).toBeDefined());
  });
});

describe('INSTRUMENTS', () => {
  it('gives each a wave or noise, and an envelope', () => {
    for (const [name, inst] of Object.entries(INSTRUMENTS)) {
      expect(Boolean(inst.wave) !== Boolean(inst.noise), name).toBe(true);
      expect(inst.attack, name).toBeGreaterThan(0);
      expect(inst.decay, name).toBeGreaterThan(0);
      expect(inst.sustain, name).toBeGreaterThanOrEqual(0);
      expect(inst.sustain, name).toBeLessThanOrEqual(1);
    }
  });
});

describe('frequency', () => {
  const piano = INSTRUMENTS.piano;

  it('tunes note 69 to A 440, twelve notes to the octave', () => {
    expect(frequency(piano, 69)).toBe(440);
    expect(frequency(piano, 81)).toBeCloseTo(880);
    expect(frequency(piano, 57)).toBeCloseTo(220);
    expect(frequency(piano, 60)).toBeCloseTo(261.626, 3);  // middle C
    expect(frequency(piano, 61) / frequency(piano, 60)).toBeCloseTo(Math.pow(2, 1 / 12));
  });

  it('shifts the instruments that play in another octave', () => {
    expect(frequency(INSTRUMENTS.musicbox, 69)).toBeCloseTo(880);
    expect(frequency(INSTRUMENTS.bass, 69)).toBeCloseTo(220);
  });
});
