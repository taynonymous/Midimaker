import type { Note } from "../state/types";

export const GRIDS = {
  "1/8": 0.5,
  "1/16": 0.25,
  "1/32": 0.125,
  "1/8T": 1 / 3,
  "1/16T": 1 / 6,
} as const;
export type GridName = keyof typeof GRIDS;

export interface QuantizeOptions {
  grid: number; // beats
  strength: number; // 0..1
  swing: number; // 0..1 (0.66 ≈ triplet shuffle)
  quantizeLength: boolean;
  /** Notes whose starts are within this many beats are treated as one chord. */
  chordWindow: number;
  loopBeats: number;
}

const wrap = (x: number, len: number) => ((x % len) + len) % len;

function snap(beat: number, grid: number, swing: number) {
  const idx = Math.round(beat / grid);
  // Swing pushes every odd grid line late by up to half a grid step.
  return idx * grid + (idx % 2 === 1 ? swing * grid * 0.5 : 0);
}

/**
 * Classic DAW-style quantize, plus chord clustering so strummed/sloppy chords
 * land together instead of being split across adjacent grid lines.
 */
export function quantize(notes: Note[], o: QuantizeOptions): Note[] {
  const sorted = [...notes].sort((a, b) => a.track.localeCompare(b.track) || a.start - b.start);
  const out: Note[] = [];
  let i = 0;
  while (i < sorted.length) {
    const cluster = [sorted[i]];
    while (
      i + cluster.length < sorted.length &&
      sorted[i + cluster.length].track === sorted[i].track &&
      sorted[i + cluster.length].start - sorted[i].start <= o.chordWindow
    ) {
      cluster.push(sorted[i + cluster.length]);
    }
    const anchor = cluster.reduce((s, n) => s + n.start, 0) / cluster.length;
    const target = snap(anchor, o.grid, o.swing);
    for (const n of cluster) {
      const start = n.start + (target - n.start) * o.strength;
      let duration = n.duration;
      if (o.quantizeLength) {
        const end = n.start + n.duration;
        const qEnd = Math.max(target + o.grid, Math.round(end / o.grid) * o.grid);
        duration = n.duration + (qEnd - target - n.duration) * o.strength;
      }
      out.push({ ...n, start: wrap(start, o.loopBeats), duration: Math.max(o.grid / 2, duration) });
    }
    i += cluster.length;
  }
  return out;
}

/** Small random timing/velocity variation so quantized parts don't sound robotic. */
export function humanize(notes: Note[], amountBeats: number, velAmount: number, loopBeats: number): Note[] {
  return notes.map((n) => ({
    ...n,
    start: wrap(n.start + (Math.random() * 2 - 1) * amountBeats, loopBeats),
    velocity: Math.min(1, Math.max(0.05, n.velocity + (Math.random() * 2 - 1) * velAmount)),
  }));
}
