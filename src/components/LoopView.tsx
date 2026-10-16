import { useState } from "react";
import { useStore } from "../state/store";
import { engine } from "../audio/engine";
import { download, exportMidi } from "../export";
import { PianoRoll } from "./PianoRoll";

/** The loop timeline plus the actions that only make sense once something is recorded. */
export function LoopView() {
  const s = useStore();
  const [bouncing, setBouncing] = useState(false);
  const empty = !s.notes.length;

  const bounce = async () => {
    await engine.start();
    setBouncing(true);
    s.set({ playing: false, recording: false });
    try {
      download(await engine.bounce(s.bars), `midimaker-${s.bpm}bpm.webm`);
    } finally {
      setBouncing(false);
    }
  };

  return (
    <div className="loop-view">
      <div className="loop-head">
        <span className="hint">
          {s.recording ? "Recording…" : `${s.notes.length} notes · ${s.bars} bars`}
          {s.ghost && " · dashed = before fix"}
        </span>
        <div className="row">
          {s.ghost && (
            <button className="chip" onClick={() => s.set({ ghost: null })}>
              Hide ghost
            </button>
          )}
          <button className="chip" disabled={empty} onClick={() => exportMidi(s.notes, s.bpm, { lead: s.tracks.lead.preset, chords: s.tracks.chords.preset })}>
            ⇩ MIDI
          </button>
          <button className="chip" disabled={empty || bouncing} onClick={bounce}>
            {bouncing ? "Recording…" : "⇩ Audio"}
          </button>
          <button className="chip danger" disabled={empty} onClick={() => s.clearTrack("all")}>
            Clear
          </button>
        </div>
      </div>
      <PianoRoll />
    </div>
  );
}
