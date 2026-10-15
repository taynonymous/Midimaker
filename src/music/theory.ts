export const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
} as const;
export type ScaleName = keyof typeof SCALES;

// How many stacked thirds per chord. "vapor" adds the 9th and drops the 5th
// for the lush maj9/min9 sound; "sus2" and "power" are EDM staples.
export const VOICINGS = {
  triad: { label: "Triad", degrees: [0, 2, 4] },
  seventh: { label: "7th", degrees: [0, 2, 4, 6] },
  ninth: { label: "9th", degrees: [0, 2, 4, 6, 8] },
  vapor: { label: "Vapor 9", degrees: [0, 2, 6, 8] },
  sus2: { label: "Sus2", degrees: [0, 1, 4] },
  power: { label: "Power", degrees: [0, 4, 7] },
} as const;
export type VoicingName = keyof typeof VOICINGS;

export const midiToName = (m: number) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

export function isInScale(midi: number, root: number, scale: ScaleName) {
  return (SCALES[scale] as readonly number[]).includes((((midi - root) % 12) + 12) % 12);
}

/** Snap a MIDI note to the nearest scale tone (ties go down). */
export function snapToScale(midi: number, root: number, scale: ScaleName) {
  for (let d = 0; d < 12; d++) {
    if (isInScale(midi - d, root, scale)) return midi - d;
    if (isInScale(midi + d, root, scale)) return midi + d;
  }
  return midi;
}

/** Note at a scale degree (can exceed 7 — wraps into higher octaves). */
function degreeToMidi(degree: number, tonicMidi: number, scale: ScaleName) {
  const steps = SCALES[scale];
  const oct = Math.floor(degree / steps.length);
  return tonicMidi + oct * 12 + steps[((degree % steps.length) + steps.length) % steps.length];
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

export interface Chord {
  degree: number;
  notes: number[];
  name: string;
  roman: string;
}

/** Diatonic chord on scale degree `degree` (0-6). */
export function diatonicChord(
  degree: number,
  keyRoot: number,
  scale: ScaleName,
  voicing: VoicingName,
  octave: number,
): Chord {
  const tonic = keyRoot + (octave + 1) * 12;
  const notes = VOICINGS[voicing].degrees.map((d) => degreeToMidi(degree + d, tonic, scale));
  const root = notes[0];
  const third = degreeToMidi(degree + 2, tonic, scale) - root;
  const fifth = degreeToMidi(degree + 4, tonic, scale) - root;
  const seventh = degreeToMidi(degree + 6, tonic, scale) - root;
  const minor = third === 3;
  const dim = minor && fifth === 6;

  let suffix = dim ? "dim" : minor ? "m" : "";
  if (voicing === "seventh" || voicing === "ninth" || voicing === "vapor") {
    const ext = voicing === "seventh" ? "7" : "9";
    if (dim) suffix = seventh === 10 ? `m${ext}b5` : `dim${ext}`;
    else if (seventh === 11) suffix = `${minor ? "m" : ""}maj${ext}`;
    else suffix = `${minor ? "m" : ""}${ext}`;
  } else if (voicing === "sus2") suffix = "sus2";
  else if (voicing === "power") suffix = "5";

  let roman = ROMAN[degree];
  if (minor) roman = roman.toLowerCase();
  if (dim) roman += "°";

  return { degree, notes, name: NOTE_NAMES[root % 12] + suffix, roman };
}

/**
 * Re-voice a chord so it sits close to the previous chord (smooth voice leading),
 * keeping the bass on the root an octave below.
 */
export function voiceLead(notes: number[], prev: number[] | null, center: number): number[] {
  const target = prev && prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : center;
  const upper = notes.map((n) => {
    let best = n;
    for (let o = -2; o <= 2; o++) {
      const c = n + o * 12;
      if (Math.abs(c - target) < Math.abs(best - target)) best = c;
    }
    return best;
  });
  const bass = notes[0] - 12 * Math.ceil((notes[0] - (Math.min(...upper) - 12)) / 12);
  return [...new Set([bass, ...upper])].sort((a, b) => a - b);
}
