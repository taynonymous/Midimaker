import { useState } from "react";
import { loopBeats, useStore } from "../state/store";
import { GRIDS, humanize, quantize, type GridName } from "../timing/quantize";
import { NOTE_NAMES } from "../music/theory";
import { SCENES } from "../state/scenes";
import type { Feel, Note } from "../state/types";
import { AI_ENABLED } from "../config";

export function TimingPanel() {
  const s = useStore();
  const [grid, setGrid] = useState<GridName>("1/16");
  const [strength, setStrength] = useState(1);
  const [swing, setSwing] = useState(0);
  const [feel, setFeel] = useState<Feel>("tight");
  const [error, setError] = useState<string | null>(null);
  const lb = loopBeats(s);
  const empty = s.notes.length === 0;

  const doQuantize = () => {
    s.replaceNotes(
      quantize(s.notes, { grid: GRIDS[grid], strength, swing, quantizeLength: true, chordWindow: 0.12, loopBeats: lb }),
      { ghost: true, summary: `Quantized to ${grid} at ${Math.round(strength * 100)}% strength.` },
    );
  };

  const doAi = async () => {
    setError(null);
    s.set({ aiBusy: true });
    try {
      const res = await fetch("/api/fix-timing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bpm: s.bpm,
          bars: s.bars,
          feel,
          style: s.scene === "custom" ? "custom" : SCENES[s.scene].label,
          key: `${NOTE_NAMES[s.keyRoot]} ${s.scale}`,
          notes: s.notes,
        }),
      });
      const body = (await res.json()) as { notes?: Note[]; summary?: string; error?: string };
      if (!res.ok || !body.notes) throw new Error(body.error ?? `HTTP ${res.status}`);
      s.replaceNotes(body.notes, { ghost: true, summary: body.summary });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      useStore.getState().set({ aiBusy: false });
    }
  };

  return (
    <section className="panel timing">
      <header>
        <h2>Timing</h2>
        <span className="hint">{s.notes.length} notes</span>
      </header>

      {AI_ENABLED && (
        <div className="ai-row">
          <div className="seg">
            {(["tight", "natural", "swing"] as Feel[]).map((f) => (
              <button key={f} className={feel === f ? "on" : ""} onClick={() => setFeel(f)}>
                {f}
              </button>
            ))}
          </div>
          <button className="btn ai" disabled={empty || s.aiBusy} onClick={doAi}>
            {s.aiBusy ? <span className="spinner" /> : "✦"} AI fix timing
          </button>
        </div>
      )}

      <div className="row">
        <label>
          Grid
          <select value={grid} onChange={(e) => setGrid(e.target.value as GridName)}>
            {Object.keys(GRIDS).map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <Slider label="Strength" value={strength} onChange={setStrength} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Swing" value={swing} onChange={setSwing} fmt={(v) => `${Math.round(v * 100)}%`} />
      </div>
      <div className="row buttons">
        <button className="btn" disabled={empty} onClick={doQuantize}>
          Quantize
        </button>
        <button className="btn" disabled={empty} onClick={() => s.replaceNotes(humanize(s.notes, 0.015, 0.06, lb))}>
          Humanize
        </button>
        <button className="btn" disabled={!s.history.length} onClick={s.undo}>
          Undo
        </button>
        <button className="btn" disabled={!s.ghost} onClick={() => s.set({ ghost: null })}>
          Hide ghost
        </button>
      </div>

      {error && <p className="msg error">{error}</p>}
      {s.aiSummary && !error && <p className="msg">{s.aiSummary}</p>}
    </section>
  );
}

export function Slider(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  fmt?: (v: number) => string;
}) {
  const { label, value, onChange, min = 0, max = 1, step = 0.01, fmt } = props;
  return (
    <label className="slider">
      <span>
        {label} <b>{fmt ? fmt(value) : value}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
