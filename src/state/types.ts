import type { PresetName } from "../audio/presets";

export type TrackId = "lead" | "chords";
export const TRACKS: TrackId[] = ["lead", "chords"];

/** Positions and lengths are in beats (quarter notes) from loop start. */
export interface Note {
  id: string;
  track: TrackId;
  midi: number;
  start: number;
  duration: number;
  velocity: number; // 0..1
}

export interface TrackSettings {
  preset: PresetName;
  volume: number; // dB
  cutoff: number; // Hz
  chorus: number; // 0..1 wet
  delay: number; // 0..1 wet
  reverb: number; // 0..1 wet
  wobble: number; // 0..1 tape wow/flutter
  mute: boolean;
  armed: boolean;
}

export type Feel = "tight" | "natural" | "swing";
