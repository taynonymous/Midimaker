import { useState } from "react";
import { useStore } from "../state/store";
import { engine } from "../audio/engine";
import { DRUM_PATTERNS, type DrumPatternName } from "../audio/drums";
import { NOTE_NAMES, SCALES, VOICINGS, type ScaleName, type VoicingName } from "../music/theory";
import { GRIDS, type GridName } from "../timing/quantize";
import { aiFixLoop, humanizeLoop, quantizeLoop } from "../timing/actions";
import { AI_ENABLED } from "../config";
import { download, exportMidi } from "../export";
import { Field, Seg, Slider } from "./controls";
import { SoundPanel } from "./SoundPanel";
import type { Feel } from "../state/types";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const TABS = [
  { value: "song", label: "Song" },
  { value: "chords", label: "Chords" },
  { value: "lead", label: "Melody" },
  { value: "timing", label: "Timing" },
] as const;
type Tab = (typeof TABS)[number]["value"];

/** Everything that isn't needed while playing lives here. Bottom sheet on phones, drawer on desktop. */
export function Settings() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>("song");
  const [bouncing, setBouncing] = useState(false);
  if (!s.settingsOpen) return null;
  const close = () => s.set({ settingsOpen: false });

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
    <div className="sheet-backdrop" onClick={close}>
      <aside className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <header className="sheet-head">
          <Seg options={TABS} value={tab} onChange={setTab} />
          <button className="icon-btn" onClick={close} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="sheet-body">
          {tab === "song" && (
            <>
              <div className="grid2">
                <Field label="Key">
                  <select value={s.keyRoot} onChange={(e) => s.set({ keyRoot: Number(e.target.value) })}>
                    {NOTE_NAMES.map((n, i) => (
                      <option key={n} value={i}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Scale">
                  <select value={s.scale} onChange={(e) => s.set({ scale: e.target.value as ScaleName })}>
                    {Object.keys(SCALES).map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Tempo (BPM)">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={50}
                    max={200}
                    value={s.bpm}
                    onChange={(e) => s.set({ bpm: Math.min(200, Math.max(50, Number(e.target.value) || 120)) })}
                  />
                </Field>
                <Field label="Loop length">
                  <select value={s.bars} onChange={(e) => s.set({ bars: Number(e.target.value) })}>
                    {[1, 2, 4, 8].map((b) => (
                      <option key={b} value={b}>
                        {b} bar{b > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Drums">
                  <select value={s.drums} onChange={(e) => s.set({ drums: e.target.value as DrumPatternName })}>
                    {Object.entries(DRUM_PATTERNS).map(([k, p]) => (
                      <option key={k} value={k}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Slider label="Drum level" value={s.drumVolume} min={-30} max={3} step={0.5} onChange={(v) => s.set({ drumVolume: v })} fmt={(v) => `${v} dB`} />
              </div>
              <div className="toggles">
                <Toggle on={s.metronome} onClick={() => s.set({ metronome: !s.metronome })} label="Metronome" />
                <Toggle on={s.mastering} onClick={() => s.set({ mastering: !s.mastering })} label="Master FX (EQ, comp, limiter)" />
              </div>
              <h3>Export</h3>
              <div className="row">
                <button className="btn" disabled={!s.notes.length} onClick={() => exportMidi(s.notes, s.bpm, { lead: s.tracks.lead.preset, chords: s.tracks.chords.preset })}>
                  ⇩ MIDI file
                </button>
                <button className="btn" disabled={!s.notes.length || bouncing} onClick={bounce}>
                  {bouncing ? "Recording loop…" : "⇩ Audio"}
                </button>
                <button className="btn danger" disabled={!s.notes.length} onClick={() => s.clearTrack("all")}>
                  Clear all
                </button>
              </div>
            </>
          )}

          {tab === "chords" && (
            <>
              <div className="grid2">
                <Field label="Chord type">
                  <select value={s.voicing} onChange={(e) => s.set({ voicing: e.target.value as VoicingName })}>
                    {Object.entries(VOICINGS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Octave">
                  <select value={s.chordOctave} onChange={(e) => s.set({ chordOctave: Number(e.target.value) })}>
                    {[2, 3, 4, 5].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </Field>
                <Slider label="Strum" value={s.strum} max={0.08} step={0.005} onChange={(v) => s.set({ strum: v })} fmt={(v) => `${Math.round(v * 1000)} ms`} />
              </div>
              <SoundPanel track="chords" />
            </>
          )}

          {tab === "lead" && (
            <>
              <div className="toggles">
                <Toggle on={s.scaleLock} onClick={() => s.set({ scaleLock: !s.scaleLock })} label="Scale lock (no wrong notes)" />
              </div>
              <MidiTarget />
              <SoundPanel track="lead" />
            </>
          )}

          {tab === "timing" && (
            <>
              <p className="hint">
                {AI_ENABLED
                  ? "Fix timing uses AI to tighten your loop. Quantize below is the instant, offline version."
                  : "Fix timing snaps notes to the grid below. Chords played together stay together."}
              </p>
              <div className="grid2">
                <Field label="Grid">
                  <select value={s.grid} onChange={(e) => s.set({ grid: e.target.value as GridName })}>
                    {Object.keys(GRIDS).map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </Field>
                <Slider label="Strength" value={s.strength} onChange={(v) => s.set({ strength: v })} fmt={pct} />
                <Slider label="Swing" value={s.swing} onChange={(v) => s.set({ swing: v })} fmt={pct} />
              </div>
              {AI_ENABLED && (
                <Field label="AI feel">
                  <Seg
                    options={(["tight", "natural", "swing"] as Feel[]).map((f) => ({ value: f, label: f }))}
                    value={s.feel}
                    onChange={(f) => s.set({ feel: f })}
                  />
                </Field>
              )}
              <div className="row">
                <button className="btn" disabled={!s.notes.length} onClick={quantizeLoop}>
                  Quantize
                </button>
                <button className="btn" disabled={!s.notes.length} onClick={humanizeLoop}>
                  Humanize
                </button>
                {AI_ENABLED && (
                  <button className="btn ai" disabled={!s.notes.length || s.aiBusy} onClick={aiFixLoop}>
                    ✦ AI fix
                  </button>
                )}
                <button className="btn" disabled={!s.ghost} onClick={() => s.set({ ghost: null })}>
                  Hide ghost
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button className={`toggle ${on ? "on" : ""}`} onClick={onClick} role="switch" aria-checked={on}>
      <span className="knob" />
      {label}
    </button>
  );
}

function MidiTarget() {
  const midiTarget = useStore((s) => s.midiTarget);
  const set = useStore((s) => s.set);
  return (
    <Field label="MIDI keyboard plays">
      <Seg
        options={[
          { value: "lead", label: "Melody" },
          { value: "chords", label: "Chords" },
        ]}
        value={midiTarget}
        onChange={(v) => set({ midiTarget: v })}
      />
    </Field>
  );
}
