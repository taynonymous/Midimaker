import type { DrumPatternName } from "../audio/drums";
import type { ScaleName, VoicingName } from "../music/theory";
import type { TrackId, TrackSettings } from "./types";

interface SceneState {
  bpm: number;
  keyRoot: number;
  scale: ScaleName;
  voicing: VoicingName;
  strum: number;
  drums: DrumPatternName;
  drumVolume: number;
  tracks: Record<TrackId, TrackSettings>;
}

const track = (p: Partial<TrackSettings> & Pick<TrackSettings, "preset">): TrackSettings => ({
  volume: 0,
  cutoff: 16000,
  chorus: 0,
  delay: 0.15,
  reverb: 0.25,
  wobble: 0,
  mute: false,
  armed: true,
  ...p,
});

export const SCENES: Record<string, { label: string; state: SceneState }> = {
  edm: {
    label: "EDM",
    state: {
      bpm: 126,
      keyRoot: 9, // A minor
      scale: "minor",
      voicing: "triad",
      strum: 0,
      drums: "fourOnFloor",
      drumVolume: -4,
      tracks: {
        lead: track({ preset: "supersaw", delay: 0.25, reverb: 0.3, cutoff: 9000 }),
        chords: track({ preset: "edmStab", reverb: 0.25, delay: 0.1, cutoff: 6000, volume: -3 }),
      },
    },
  },
  vaporwave: {
    label: "Vaporwave",
    state: {
      bpm: 84,
      keyRoot: 3, // Eb major — classic mall-soft key
      scale: "major",
      voicing: "vapor",
      strum: 0.025,
      drums: "halfTime",
      drumVolume: -8,
      tracks: {
        lead: track({ preset: "vaporEP", chorus: 0.55, reverb: 0.5, delay: 0.2, wobble: 0.35, cutoff: 5000 }),
        chords: track({ preset: "dreamPad", chorus: 0.7, reverb: 0.65, delay: 0.05, wobble: 0.4, cutoff: 3500, volume: -2 }),
      },
    },
  },
  futureBass: {
    label: "Future Bass",
    state: {
      bpm: 150,
      keyRoot: 2, // D major
      scale: "major",
      voicing: "ninth",
      strum: 0.01,
      drums: "breakbeat",
      drumVolume: -5,
      tracks: {
        lead: track({ preset: "pluck", delay: 0.35, reverb: 0.3 }),
        chords: track({ preset: "supersaw", chorus: 0.3, reverb: 0.35, cutoff: 7000, wobble: 0.1, volume: -4 }),
      },
    },
  },
  dreamy: {
    label: "Lo-fi Dream",
    state: {
      bpm: 72,
      keyRoot: 5, // F lydian
      scale: "lydian",
      voicing: "seventh",
      strum: 0.04,
      drums: "halfTime",
      drumVolume: -10,
      tracks: {
        lead: track({ preset: "glassBell", reverb: 0.6, delay: 0.3, wobble: 0.2, cutoff: 7000 }),
        chords: track({ preset: "vaporEP", chorus: 0.5, reverb: 0.45, wobble: 0.3, cutoff: 3000 }),
      },
    },
  },
};
export type SceneName = keyof typeof SCENES;
