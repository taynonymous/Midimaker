import { Midi } from "@tonejs/midi";
import type { Note } from "./state/types";
import { PRESETS, type PresetName } from "./audio/presets";

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function exportMidi(notes: Note[], bpm: number, presets: Record<string, PresetName>) {
  const midi = new Midi();
  midi.header.setTempo(bpm);
  const sec = (beats: number) => (beats * 60) / bpm;
  for (const track of ["lead", "chords"] as const) {
    const t = midi.addTrack();
    t.name = `${track} (${PRESETS[presets[track]].label})`;
    for (const n of notes.filter((n) => n.track === track)) {
      t.addNote({ midi: n.midi, time: sec(n.start), duration: sec(n.duration), velocity: n.velocity });
    }
  }
  download(new Blob([midi.toArray() as BlobPart], { type: "audio/midi" }), `midimaker-${bpm}bpm.mid`);
}
