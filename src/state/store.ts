import { create } from "zustand";
import { engine } from "../audio/engine";
import type { DrumPatternName } from "../audio/drums";
import { diatonicChord, snapToScale, voiceLead, type ScaleName, type VoicingName } from "../music/theory";
import type { Feel, Note, TrackId, TrackSettings } from "./types";
import type { GridName } from "../timing/quantize";
import { SCENES, type SceneName } from "./scenes";

let nextId = 1;
const newId = () => `n${(nextId++).toString(36)}`;

interface State {
  /** Selected scene preset; `modified` is set once any tweak diverges from it. */
  scene: SceneName;
  modified: boolean;
  bpm: number;
  bars: number;
  keyRoot: number; // pitch class 0-11
  scale: ScaleName;
  voicing: VoicingName;
  chordOctave: number;
  leadOctave: number;
  scaleLock: boolean;
  strum: number; // seconds between chord notes
  drums: DrumPatternName;
  drumVolume: number;
  metronome: boolean;
  mastering: boolean;
  midiTarget: TrackId;
  tracks: Record<TrackId, TrackSettings>;

  notes: Note[];
  history: Note[][];
  /** Snapshot shown as ghost notes after a timing fix, for A/B. */
  ghost: Note[] | null;
  playing: boolean;
  recording: boolean;
  aiBusy: boolean;
  toast: { text: string; error?: boolean } | null;
  // timing-fix options
  grid: GridName;
  strength: number;
  swing: number;
  feel: Feel;
  // UI
  /** Main stage shows the sound tweaks, or the loop timeline (auto-switches on record). */
  view: "tweaks" | "loop";
  mobileTab: TrackId;
  activeChord: number | null;
  heldMidi: Record<TrackId, number[]>;
}

interface Actions {
  set: (p: Partial<State>) => void;
  setTrack: (t: TrackId, p: Partial<TrackSettings>) => void;
  /** Load a scene's preset, resetting every tweak to that scene's defaults. */
  loadScene: (s: SceneName) => void;
  resetTweaks: () => void;
  togglePlay: () => Promise<void>;
  toggleRecord: () => Promise<void>;
  noteOn: (track: TrackId, midi: number, velocity?: number, delaySec?: number) => void;
  noteOff: (track: TrackId, midi: number) => void;
  /** Play a diatonic chord; returns the midi notes so the caller can release them. */
  chordOn: (degree: number, velocity?: number) => number[];
  chordOff: (notes: number[]) => void;
  /** Snap a raw lead note to the key when scale lock is on. */
  leadNote: (midi: number) => number;
  replaceNotes: (notes: Note[], opts?: { ghost?: boolean; toast?: string | null }) => void;
  deleteNote: (id: string) => void;
  clearTrack: (t: TrackId | "all") => void;
  undo: () => void;
}

export const loopBeats = (s: Pick<State, "bars">) => s.bars * 4;

/** Every user-tweakable setting, at its default for a given scene. Notes are not included. */
function defaults(scene: SceneName) {
  const sc = SCENES[scene].state;
  return {
    ...sc,
    tracks: structuredClone(sc.tracks),
    scene,
    modified: false,
    bars: 4,
    chordOctave: 3,
    leadOctave: 5,
    scaleLock: true,
    metronome: false,
    mastering: true,
    midiTarget: "lead" as TrackId,
    grid: "1/16" as GridName,
    strength: 1,
    swing: 0,
    feel: "tight" as Feel,
  };
}
const TWEAK_KEYS = new Set(Object.keys(defaults("edm")).filter((k) => k !== "scene" && k !== "modified"));

// Notes currently held while recording, keyed by track:midi.
const pending = new Map<string, { start: number; velocity: number; id: string }>();
let lastChord: number[] | null = null;

export const useStore = create<State & Actions>((set, get) => ({
  ...defaults("edm"),
  notes: [],
  history: [],
  ghost: null,
  playing: false,
  recording: false,
  aiBusy: false,
  toast: null,
  view: "tweaks",
  mobileTab: "chords",
  activeChord: null,
  heldMidi: { lead: [], chords: [] },

  set: (p) => set(Object.keys(p).some((k) => TWEAK_KEYS.has(k)) ? { ...p, modified: true } : p),

  setTrack: (t, p) => set((s) => ({ tracks: { ...s.tracks, [t]: { ...s.tracks[t], ...p } }, modified: true })),

  loadScene: (name) => set(defaults(name)),

  resetTweaks: () => {
    set({ ...defaults(get().scene), toast: { text: `Reset to ${SCENES[get().scene].label} defaults` } });
  },

  togglePlay: async () => {
    await engine.start();
    if (get().playing) {
      engine.stop();
      finishRecording();
      set({ playing: false, recording: false });
    } else {
      engine.play();
      set({ playing: true });
    }
  },

  toggleRecord: async () => {
    await engine.start();
    const s = get();
    if (s.recording) {
      finishRecording();
      set({ recording: false });
      return;
    }
    set({ history: [...s.history, s.notes].slice(-50), recording: true, ghost: null, view: "loop" });
    if (!s.playing) {
      engine.play();
      set({ playing: true });
    }
  },

  noteOn: (track, midi, velocity = 0.8, delaySec = 0) => {
    void engine.start();
    engine.noteOn(track, midi, velocity, delaySec);
    const s = get();
    set({ heldMidi: { ...s.heldMidi, [track]: [...s.heldMidi[track], midi] } });
    // No engine.playing check: notes hit in the ~50ms before the transport starts land at beat 0.
    if (s.recording && s.tracks[track].armed) {
      const lb = loopBeats(s);
      const delayBeats = (delaySec * s.bpm) / 60;
      pending.set(`${track}:${midi}`, {
        start: (engine.positionBeats(lb) + delayBeats) % lb,
        velocity,
        id: newId(),
      });
    }
  },

  noteOff: (track, midi) => {
    engine.noteOff(track, midi);
    const s = get();
    set({ heldMidi: { ...s.heldMidi, [track]: s.heldMidi[track].filter((m) => m !== midi) } });
    const key = `${track}:${midi}`;
    const p = pending.get(key);
    if (!p) return;
    pending.delete(key);
    const lb = loopBeats(s);
    const end = engine.positionBeats(lb);
    const duration = Math.max(0.0625, (end - p.start + lb) % lb || lb);
    set({ notes: [...get().notes, { id: p.id, track, midi, start: p.start, duration, velocity: p.velocity }] });
  },

  chordOn: (degree, velocity = 0.75) => {
    const s = get();
    const chord = diatonicChord(degree, s.keyRoot, s.scale, s.voicing, s.chordOctave);
    const center = s.keyRoot + (s.chordOctave + 1) * 12 + 7;
    const notes = voiceLead(chord.notes, lastChord, center);
    lastChord = notes.slice(1);
    notes.forEach((m, i) => get().noteOn("chords", m, i === 0 ? velocity * 0.9 : velocity, i * s.strum));
    set({ activeChord: degree });
    return notes;
  },

  chordOff: (notes) => {
    notes.forEach((m) => get().noteOff("chords", m));
    if (get().heldMidi.chords.length === 0) set({ activeChord: null });
  },

  leadNote: (midi) => {
    const s = get();
    return s.scaleLock ? snapToScale(midi, s.keyRoot, s.scale) : midi;
  },

  replaceNotes: (notes, opts = {}) => {
    const s = get();
    set({
      history: [...s.history, s.notes].slice(-50),
      notes,
      ghost: opts.ghost ? s.notes : null,
      toast: opts.toast ? { text: opts.toast } : null,
    });
  },

  deleteNote: (id) => {
    const s = get();
    set({ history: [...s.history, s.notes].slice(-50), notes: s.notes.filter((n) => n.id !== id) });
  },

  clearTrack: (t) => {
    const s = get();
    set({
      history: [...s.history, s.notes].slice(-50),
      notes: t === "all" ? [] : s.notes.filter((n) => n.track !== t),
      ghost: null,
      toast: null,
    });
  },

  undo: () => {
    const s = get();
    if (!s.history.length) return;
    set({ notes: s.history[s.history.length - 1], history: s.history.slice(0, -1), ghost: null, toast: { text: "Undone" } });
  },
}));

/** Close any notes still held when recording stops so nothing hangs. */
function finishRecording() {
  for (const key of [...pending.keys()]) {
    const [track, midi] = key.split(":");
    useStore.getState().noteOff(track as TrackId, Number(midi));
  }
}

/** Push store changes into the audio engine. */
export function bindEngine() {
  const apply = (s: State, prev?: State) => {
    if (!prev || s.bpm !== prev.bpm) engine.setTempo(s.bpm);
    if (!prev || s.bars !== prev.bars) engine.setLoop(s.bars);
    if (!prev || s.drums !== prev.drums) engine.setDrums(s.drums);
    if (!prev || s.drumVolume !== prev.drumVolume) engine.setDrumVolume(s.drumVolume);
    if (!prev || s.metronome !== prev.metronome) engine.setMetronome(s.metronome);
    if (!prev || s.mastering !== prev.mastering) engine.setMastering(s.mastering);
    for (const t of ["lead", "chords"] as TrackId[]) {
      if (!prev || s.tracks[t] !== prev.tracks[t]) engine.tracks[t].apply(s.tracks[t]);
      if (!prev || s.notes !== prev.notes) engine.setNotes(t, s.notes.filter((n) => n.track === t));
    }
  };
  apply(useStore.getState());
  return useStore.subscribe((s, prev) => apply(s, prev));
}

export type { State };
