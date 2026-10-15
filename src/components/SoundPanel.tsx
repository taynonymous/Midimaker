import { useStore } from "../state/store";
import { PRESETS, type PresetName } from "../audio/presets";
import type { TrackId } from "../state/types";
import { Slider } from "./controls";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Synth preset + FX for one track. */
export function SoundPanel({ track }: { track: TrackId }) {
  const t = useStore((s) => s.tracks[track]);
  const setTrack = useStore((s) => s.setTrack);
  const clearTrack = useStore((s) => s.clearTrack);
  const set = (p: Parameters<typeof setTrack>[1]) => setTrack(track, p);

  return (
    <div className="sound">
      <div className="row">
        <select value={t.preset} onChange={(e) => set({ preset: e.target.value as PresetName })}>
          {Object.entries(PRESETS).map(([k, p]) => (
            <option key={k} value={k}>
              {p.label}
            </option>
          ))}
        </select>
        <button className={`chip ${t.armed ? "rec-on" : ""}`} onClick={() => set({ armed: !t.armed })} title="Record-arm">
          ● Arm
        </button>
        <button className={`chip ${t.mute ? "on" : ""}`} onClick={() => set({ mute: !t.mute })}>
          Mute
        </button>
        <button className="chip" onClick={() => clearTrack(track)}>
          Clear
        </button>
      </div>
      <div className="fx-grid">
        <Slider label="Volume" value={t.volume} min={-30} max={6} step={0.5} onChange={(v) => set({ volume: v })} fmt={(v) => `${v} dB`} />
        <Slider
          label="Tone"
          value={Math.log2(t.cutoff / 200) / Math.log2(90)}
          onChange={(v) => set({ cutoff: Math.round(200 * Math.pow(90, v)) })}
          fmt={() => `${(t.cutoff / 1000).toFixed(1)}k`}
        />
        <Slider label="Chorus" value={t.chorus} onChange={(v) => set({ chorus: v })} fmt={pct} />
        <Slider label="Delay" value={t.delay} onChange={(v) => set({ delay: v })} fmt={pct} />
        <Slider label="Reverb" value={t.reverb} onChange={(v) => set({ reverb: v })} fmt={pct} />
        <Slider label="Tape wobble" value={t.wobble} onChange={(v) => set({ wobble: v })} fmt={pct} />
      </div>
    </div>
  );
}
