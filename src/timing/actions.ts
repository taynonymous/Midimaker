import { loopBeats, useStore } from "../state/store";
import { GRIDS, humanize, quantize } from "./quantize";
import { NOTE_NAMES } from "../music/theory";
import { SCENES } from "../state/scenes";
import { AI_ENABLED } from "../config";
import type { Note } from "../state/types";

export function quantizeLoop() {
  const s = useStore.getState();
  if (!s.notes.length) return;
  s.replaceNotes(
    quantize(s.notes, {
      grid: GRIDS[s.grid],
      strength: s.strength,
      swing: s.swing,
      quantizeLength: true,
      chordWindow: 0.12,
      loopBeats: loopBeats(s),
    }),
    { ghost: true, toast: `Snapped to ${s.grid}${s.strength < 1 ? ` at ${Math.round(s.strength * 100)}%` : ""}` },
  );
}

export function humanizeLoop() {
  const s = useStore.getState();
  if (!s.notes.length) return;
  s.replaceNotes(humanize(s.notes, 0.015, 0.06, loopBeats(s)), { ghost: true, toast: "Humanized" });
}

export async function aiFixLoop() {
  const s = useStore.getState();
  if (!s.notes.length || s.aiBusy) return;
  s.set({ aiBusy: true, toast: null });
  try {
    const res = await fetch("/api/fix-timing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bpm: s.bpm,
        bars: s.bars,
        feel: s.feel,
        style: s.scene === "custom" ? "custom" : SCENES[s.scene].label,
        key: `${NOTE_NAMES[s.keyRoot]} ${s.scale}`,
        notes: s.notes,
      }),
    });
    const body = (await res.json().catch(() => ({ error: "AI server unreachable" }))) as {
      notes?: Note[];
      summary?: string;
      error?: string;
    };
    if (!res.ok || !body.notes) throw new Error(body.error ?? `HTTP ${res.status}`);
    useStore.getState().replaceNotes(body.notes, { ghost: true, toast: body.summary });
  } catch (err) {
    // Never leave the user stuck: fall back to the offline quantizer.
    quantizeLoop();
    useStore.getState().set({ toast: { text: `${(err as Error).message} — used quick quantize instead.`, error: true } });
  } finally {
    useStore.getState().set({ aiBusy: false });
  }
}

/** The one-tap "make it tight" button: AI when available, smart quantize otherwise. */
export const fixTiming = () => (AI_ENABLED ? aiFixLoop() : quantizeLoop());
