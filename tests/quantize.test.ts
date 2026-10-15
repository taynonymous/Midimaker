import { describe, expect, it } from "vitest";
import { quantize } from "../src/timing/quantize";
import type { Note } from "../src/state/types";

const n = (id: string, start: number, duration = 0.5, track: Note["track"] = "lead", midi = 60): Note => ({
  id, track, midi, start, duration, velocity: 0.8,
});
const opts = { grid: 0.25, strength: 1, swing: 0, quantizeLength: true, chordWindow: 0.12, loopBeats: 16 };

describe("quantize", () => {
  it("snaps starts to the grid", () => {
    const out = quantize([n("a", 1.07), n("b", 2.9)], opts);
    expect(out.map((x) => x.start)).toEqual([1, 3]);
  });
  it("moves a sloppy chord to one start", () => {
    const chord = [n("a", 3.88, 1, "chords", 57), n("b", 3.95, 1, "chords", 60), n("c", 4.02, 1, "chords", 64)];
    const out = quantize(chord, opts);
    expect(new Set(out.map((x) => x.start))).toEqual(new Set([4]));
  });
  it("respects strength", () => {
    expect(quantize([n("a", 1.1)], { ...opts, strength: 0.5 })[0].start).toBeCloseTo(1.05);
  });
  it("wraps notes snapped past the loop end", () => {
    expect(quantize([n("a", 15.95)], opts)[0].start).toBe(0);
  });
  it("applies swing to off-beat 16ths", () => {
    expect(quantize([n("a", 0.26)], { ...opts, swing: 0.5 })[0].start).toBeCloseTo(0.3125);
  });
});
