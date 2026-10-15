import { useEffect, useState } from "react";
import { bindEngine, useStore } from "./state/store";
import { bindComputerKeyboard } from "./input/keyboard";
import { bindMidi, type MidiStatus } from "./input/midi";
import { engine } from "./audio/engine";
import { DRUM_PATTERNS, type DrumPatternName } from "./audio/drums";
import { NOTE_NAMES, SCALES, VOICINGS, type ScaleName, type VoicingName } from "./music/theory";
import { SCENES, type SceneName } from "./state/scenes";
import { download, exportMidi } from "./export";
import { Piano } from "./components/Piano";
import { ChordPad } from "./components/ChordPad";
import { PianoRoll } from "./components/PianoRoll";
import { TimingPanel, Slider } from "./components/TimingPanel";
import { SoundPanel } from "./components/SoundPanel";

export default function App() {
  const s = useStore();
  const [midi, setMidi] = useState<MidiStatus | null>(null);
  const [bouncing, setBouncing] = useState(false);

  useEffect(() => bindEngine(), []);
  useEffect(() => bindComputerKeyboard(), []);
  useEffect(() => {
    let off = () => {};
    void bindMidi(setMidi).then((f) => (off = f));
    return () => off();
  }, []);

  const bounce = async () => {
    await engine.start();
    setBouncing(true);
    s.set({ playing: false, recording: false });
    try {
      const blob = await engine.bounce(s.bars);
      download(blob, `midimaker-${s.bpm}bpm.webm`);
    } finally {
      setBouncing(false);
    }
  };

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
            </button>
          ))}
        </nav>
        <div className="midi-status" title={midi?.inputs.join(", ")}>
          {midi?.supported === false
            ? "Web MIDI unsupported"
            : midi?.inputs.length
              ? `MIDI: ${midi.inputs[0]}${midi.inputs.length > 1 ? ` +${midi.inputs.length - 1}` : ""}`
              : "No MIDI device"}
          {midi?.inputs.length ? (
            <select value={s.midiTarget} onChange={(e) => s.set({ midiTarget: e.target.value as "lead" | "chords" })}>
              <option value="lead">→ melody</option>
              <option value="chords">→ chords</option>
            </select>
          ) : null}
        </div>
      </header>

      <section className="transport">
        <button className={`tbtn play ${s.playing ? "on" : ""}`} onClick={() => void s.togglePlay()} title="Play / stop (Space)">
          {s.playing ? "■" : "▶"}
        </button>
        <button className={`tbtn rec ${s.recording ? "on" : ""}`} onClick={() => void s.toggleRecord()} title="Record / overdub (R)">
          ●
        </button>
        <button className={`chip ${s.metronome ? "on" : ""}`} onClick={() => s.set({ metronome: !s.metronome })} title="Metronome (M)">
          Click
        </button>
        <label>
          BPM
          <input
            type="number"
            min={50}
            max={200}
            value={s.bpm}
            onChange={(e) => s.set({ bpm: Math.min(200, Math.max(50, Number(e.target.value) || 120)) })}
          />
        </label>
        <label>
          Bars
          <select value={s.bars} onChange={(e) => s.set({ bars: Number(e.target.value) })}>
            {[1, 2, 4, 8].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label>
          Key
          <select value={s.keyRoot} onChange={(e) => s.set({ keyRoot: Number(e.target.value) })}>
            {NOTE_NAMES.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
          <select value={s.scale} onChange={(e) => s.set({ scale: e.target.value as ScaleName })}>
            {Object.keys(SCALES).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Drums
          <select value={s.drums} onChange={(e) => s.set({ drums: e.target.value as DrumPatternName })}>
            {Object.entries(DRUM_PATTERNS).map(([k, p]) => (
              <option key={k} value={k}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="spacer" />
        <button className={`chip ${s.mastering ? "on" : ""}`} onClick={() => s.set({ mastering: !s.mastering })} title="EQ → glue compressor → limiter on the master bus">
          Master FX
        </button>
        <button className="chip" disabled={!s.notes.length} onClick={() => exportMidi(s.notes, s.bpm, { lead: s.tracks.lead.preset, chords: s.tracks.chords.preset })}>
          ⇩ MIDI
        </button>
        <button className="chip" disabled={!s.notes.length || bouncing} onClick={bounce}>
          {bouncing ? "Bouncing…" : "⇩ Audio"}
        </button>
      </section>

      <PianoRoll />

      <div className="columns">
        <section className="panel chords">
          <header>
            <h2>Chords</h2>
            <span className="hint">keys 1–7</span>
          </header>
          <ChordPad />
          <div className="row">
            <label>
              Voicing
              <select value={s.voicing} onChange={(e) => s.set({ voicing: e.target.value as VoicingName })}>
                {Object.entries(VOICINGS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Octave
              <select value={s.chordOctave} onChange={(e) => s.set({ chordOctave: Number(e.target.value) })}>
                {[2, 3, 4, 5].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <Slider label="Strum" value={s.strum} max={0.08} step={0.005} onChange={(v) => s.set({ strum: v })} fmt={(v) => `${Math.round(v * 1000)} ms`} />
          </div>
          <SoundPanel track="chords" />
        </section>

        <TimingPanel />

        <section className="panel lead">
          <header>
            <h2>Melody</h2>
            <span className="hint">
              keys A–; · <kbd>Z</kbd>/<kbd>X</kbd> octave ({s.leadOctave})
            </span>
          </header>
          <Piano />
          <div className="row">
            <button className={`chip ${s.scaleLock ? "on" : ""}`} onClick={() => s.set({ scaleLock: !s.scaleLock })} title="Snap every key to the current scale — no wrong notes">
              Scale lock
            </button>
            <Slider label="Drum level" value={s.drumVolume} min={-30} max={3} step={0.5} onChange={(v) => s.set({ drumVolume: v })} fmt={(v) => `${v} dB`} />
          </div>
          <SoundPanel track="lead" />
        </section>
      </div>
    </div>
  );
}
