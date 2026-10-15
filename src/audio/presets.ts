import * as Tone from "tone";

export interface Preset {
  label: string;
  create: () => Tone.PolySynth<any>;
  /** dB trim so presets sit at similar loudness. */
  volume: number;
}

export const PRESETS = {
  supersaw: {
    label: "Supersaw Lead",
    volume: -16,
    create: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 5, spread: 38 },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.35 },
      }),
  },
  pluck: {
    label: "Future Pluck",
    volume: -10,
    create: () =>
      new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: "fatsquare", count: 2, spread: 18 } as any,
        filter: { Q: 2, type: "lowpass", rolloff: -24 },
        envelope: { attack: 0.002, decay: 0.25, sustain: 0.05, release: 0.25 },
        filterEnvelope: { attack: 0.001, decay: 0.18, sustain: 0.1, release: 0.2, baseFrequency: 300, octaves: 4.5 },
      }),
  },
  vaporEP: {
    label: "Vapor E.Piano",
    volume: -9,
    create: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 11,
        oscillator: { type: "sine" },
        envelope: { attack: 0.005, decay: 1.4, sustain: 0.25, release: 1.2 },
        modulation: { type: "sine" },
        modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0.05, release: 0.5 },
      }),
  },
  dreamPad: {
    label: "Dream Pad",
    volume: -15,
    create: () =>
      new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 2,
        oscillator: { type: "fatsine", count: 3, spread: 22 } as any,
        envelope: { attack: 0.6, decay: 0.4, sustain: 0.85, release: 2.5 },
        modulation: { type: "triangle" },
        modulationEnvelope: { attack: 0.8, decay: 0.2, sustain: 1, release: 2 },
      }),
  },
  glassBell: {
    label: "Glass Bell",
    volume: -12,
    create: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 5.07,
        modulationIndex: 6,
        envelope: { attack: 0.001, decay: 2, sustain: 0, release: 2 },
        modulationEnvelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.5 },
      }),
  },
  edmStab: {
    label: "House Stab",
    volume: -14,
    create: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 3, spread: 25 },
        envelope: { attack: 0.003, decay: 0.18, sustain: 0.15, release: 0.15 },
      }),
  },
} satisfies Record<string, Preset>;

export type PresetName = keyof typeof PRESETS;
