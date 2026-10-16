import { useEffect, useState } from "react";
import { bindEngine, useStore } from "./state/store";
import { bindComputerKeyboard } from "./input/keyboard";
import { bindMidi, type MidiStatus } from "./input/midi";
import { SCENES, type SceneName } from "./state/scenes";
import { fixTiming } from "./timing/actions";
import { AI_ENABLED } from "./config";
import { Piano } from "./components/Piano";
import { ChordPad } from "./components/ChordPad";
import { Tweaks } from "./components/Tweaks";
import { LoopView } from "./components/LoopView";
import type { TrackId } from "./state/types";

export default function App() {
  const s = useStore();
  const [midi, setMidi] = useState<MidiStatus | null>(null);

  useEffect(() => bindEngine(), []);
  useEffect(() => bindComputerKeyboard(), []);
  useEffect(() => {
    let off = () => {};
    void bindMidi(setMidi).then((f) => (off = f));
    return () => off();
  }, []);

  const tab = (t: TrackId, label: string) => (
    <button className={s.mobileTab === t ? "on" : ""} onClick={() => s.set({ mobileTab: t })}>
      {label}
    </button>
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          MIDI<span>MAKER</span>
        </div>
        <nav className="scenes">
          {Object.entries(SCENES).map(([k, sc]) => (
            <button key={k} className={`chip ${s.scene === k ? "on" : ""}`} onClick={() => s.loadScene(k as SceneName)}>
              {sc.label}
              {s.scene === k && s.modified && <span className="mod-dot" title="Tweaked — Reset restores defaults" />}
            </button>
          ))}
        </nav>
      </header>

      <section className="transport">
        <button className={`tbtn play ${s.playing ? "on" : ""}`} onClick={() => void s.togglePlay()} aria-label="Play / stop" title="Play / stop (Space)">
          {s.playing ? "■" : "▶"}
        </button>
        <button className={`tbtn rec ${s.recording ? "on" : ""}`} onClick={() => void s.toggleRecord()} aria-label="Record" title="Record / overdub (R)">
          ●
        </button>
        <button className="tbtn" disabled={!s.history.length} onClick={() => {
            s.set({ view: "loop" });
            s.undo();
          }} aria-label="Undo" title="Undo">
          ↶
        </button>
        <button className="btn fix" disabled={!s.notes.length || s.aiBusy} onClick={() => void fixTiming()}>
          {s.aiBusy ? <span className="spinner" /> : "✦"} Fix timing
          {AI_ENABLED && <span className="badge">AI</span>}
        </button>
        {midi?.inputs.length ? <span className="midi-dot" title={`MIDI: ${midi.inputs.join(", ")}`} /> : null}
        <button
          className="view-toggle"
          onClick={() => s.set({ view: s.view === "loop" ? "tweaks" : "loop" })}
          title={s.view === "loop" ? "Show sound tweaks" : "Show loop timeline"}
        >
          {s.view === "loop" ? "⚙" : "▤"}
          <span>{s.view === "loop" ? "Tweaks" : "Loop"}</span>
        </button>
      </section>

      <section className="stage">{s.view === "loop" ? <LoopView /> : <Tweaks />}</section>
      <Toast />

      <div className="tabs">
        {tab("chords", "Chords")}
        {tab("lead", "Keys")}
      </div>

      <div className="instruments" data-tab={s.mobileTab}>
        <section className="panel chords">
          <header>
            <h2>Chords</h2>
            <span className="hint desktop-only">
              keys <kbd>1</kbd>–<kbd>7</kbd>
            </span>
          </header>
          <ChordPad />
        </section>

        <section className="panel lead">
          <header>
            <h2>Melody</h2>
            <div className="octave">
              <button className="icon-btn" onClick={() => s.set({ leadOctave: Math.max(1, s.leadOctave - 1) })} aria-label="Octave down">
                −
              </button>
              <span>Oct {s.leadOctave}</span>
              <button className="icon-btn" onClick={() => s.set({ leadOctave: Math.min(7, s.leadOctave + 1) })} aria-label="Octave up">
                +
              </button>
            </div>
          </header>
          <Piano />
        </section>
      </div>

      <p className="footer-hint desktop-only">
        <kbd>Space</kbd> play · <kbd>R</kbd> record · <kbd>A</kbd>–<kbd>;</kbd> melody · <kbd>Z</kbd>/<kbd>X</kbd> octave · <kbd>1</kbd>–<kbd>7</kbd> chords
        · <kbd>M</kbd> metronome
      </p>
    </div>
  );
}

function Toast() {
  const toast = useStore((s) => s.toast);
  const set = useStore((s) => s.set);
  useEffect(() => {
    if (!toast || toast.error) return;
    const t = setTimeout(() => set({ toast: null }), 6000);
    return () => clearTimeout(t);
  }, [toast, set]);
  if (!toast) return null;
  return (
    <div className={`toast ${toast.error ? "error" : ""}`} onClick={() => set({ toast: null })}>
      {toast.text}
    </div>
  );
}
