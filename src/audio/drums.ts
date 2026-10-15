import * as Tone from "tone";

export const DRUM_PATTERNS = {
  off: { label: "Off", steps: { kick: "", snare: "", hat: "" } },
  fourOnFloor: {
    label: "Four on the floor",
    steps: {
      kick: "x...x...x...x...",
      snare: "....x.......x...",
      hat: "..x...x...x...x.",
    },
  },
  halfTime: {
    label: "Vapor half-time",
    steps: {
      kick: "x.........x.....",
      snare: "........x.......",
      hat: "x.x.x.x.x.x.x.xx",
    },
  },
  breakbeat: {
    label: "Breakbeat",
    steps: {
      kick: "x.....x...x.....",
      snare: "....x.......x..x",
      hat: "x.x.x.x.x.x.x.x.",
    },
  },
} as const;
export type DrumPatternName = keyof typeof DRUM_PATTERNS;

/** Synthesized kit — no samples to host. */
export class DrumKit {
  readonly out = new Tone.Gain(0.9);
  private kick = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.38, sustain: 0, release: 0.1 },
  }).connect(this.out);
  private snareFilter = new Tone.Filter(1800, "bandpass").connect(this.out);
  private snare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    volume: -6,
  }).connect(this.snareFilter);
  private hatFilter = new Tone.Filter(8000, "highpass").connect(this.out);
  private hat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.045, sustain: 0 },
    volume: -14,
  }).connect(this.hatFilter);
  private seq: Tone.Sequence<number> | null = null;

  setPattern(name: DrumPatternName) {
    this.seq?.dispose();
    this.seq = null;
    const p = DRUM_PATTERNS[name].steps;
    if (!p.kick && !p.snare && !p.hat) return;
    const steps = Array.from({ length: 16 }, (_, i) => i);
    this.seq = new Tone.Sequence(
      (time, i) => {
        if (p.kick[i] === "x") this.kick.triggerAttackRelease("C1", "8n", time);
        if (p.snare[i] === "x") this.snare.triggerAttackRelease("16n", time);
        if (p.hat[i] === "x") this.hat.triggerAttackRelease("32n", time, i % 4 === 2 ? 1 : 0.6);
      },
      steps,
      "16n",
    ).start(0);
  }
}
