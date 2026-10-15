import { useStore } from "../state/store";

/** Ableton-style layout: home row = white keys, row above = black keys. */
export const LEAD_KEYS: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7,
  KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16,
};
export const LEAD_KEY_LABELS = Object.fromEntries(
  Object.entries(LEAD_KEYS).map(([code, off]) => [off, code.replace("Key", "").replace("Semicolon", ";")]),
);
export const CHORD_KEYS = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7"];

export function bindComputerKeyboard() {
  const held = new Map<string, () => void>();

  const down = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.repeat || held.has(e.code)) {
      if (e.code in LEAD_KEYS || CHORD_KEYS.includes(e.code) || e.code === "Space") e.preventDefault();
      return;
    }
    const s = useStore.getState();

    if (e.code in LEAD_KEYS) {
      e.preventDefault();
      const midi = s.leadNote((s.leadOctave + 1) * 12 + LEAD_KEYS[e.code]);
      if (s.heldMidi.lead.includes(midi)) return; // scale lock mapped two keys to one note
      s.noteOn("lead", midi, 0.8);
      held.set(e.code, () => useStore.getState().noteOff("lead", midi));
      return;
    }
    const deg = CHORD_KEYS.indexOf(e.code);
    if (deg >= 0) {
      e.preventDefault();
      const notes = s.chordOn(deg);
      held.set(e.code, () => useStore.getState().chordOff(notes));
      return;
    }
    switch (e.code) {
      case "KeyZ":
        s.set({ leadOctave: Math.max(1, s.leadOctave - 1) });
        break;
      case "KeyX":
        s.set({ leadOctave: Math.min(7, s.leadOctave + 1) });
        break;
      case "Space":
        e.preventDefault();
        void s.togglePlay();
        break;
      case "KeyR":
        void s.toggleRecord();
        break;
      case "Escape":
        s.set({ settingsOpen: false });
        break;
      case "KeyM":
        s.set({ metronome: !s.metronome });
        break;
    }
  };

  const up = (e: KeyboardEvent) => {
    held.get(e.code)?.();
    held.delete(e.code);
  };
  const blur = () => {
    held.forEach((release) => release());
    held.clear();
  };

  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
  };
}
