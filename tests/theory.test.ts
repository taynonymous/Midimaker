import { describe, expect, it } from "vitest";
import { diatonicChord, snapToScale, voiceLead } from "../src/music/theory";

describe("diatonicChord", () => {
  it("names C major triads", () => {
    expect([0, 1, 4, 6].map((d) => diatonicChord(d, 0, "major", "triad", 4).name)).toEqual(["C", "Dm", "G", "Bdim"]);
  });
  it("names 7ths and romans in A minor", () => {
    const c = [0, 2, 4].map((d) => diatonicChord(d, 9, "minor", "seventh", 3));
    expect(c.map((x) => x.name)).toEqual(["Am7", "Cmaj7", "Em7"]);
    expect(c.map((x) => x.roman)).toEqual(["i", "III", "v"]);
  });
  it("builds vaporwave maj9 voicing (root, 3rd, 7th, 9th)", () => {
    const c = diatonicChord(0, 3, "major", "vapor", 3); // Eb
    expect(c.name).toBe("Ebmaj9");
    expect(c.notes.map((n) => n - c.notes[0])).toEqual([0, 4, 11, 14]);
  });
});

describe("snapToScale", () => {
  it("leaves scale tones alone and snaps others", () => {
    expect(snapToScale(60, 0, "major")).toBe(60);
    expect(snapToScale(61, 0, "major")).toBe(60);
    expect(snapToScale(66, 0, "major")).toBe(65);
  });
});

describe("voiceLead", () => {
  it("keeps upper voices near the previous chord and puts the root in the bass", () => {
    const f = diatonicChord(3, 0, "major", "triad", 4).notes; // F A C
    const out = voiceLead(f, [60, 64, 67], 64);
    expect(out[0] % 12).toBe(5);
    expect(Math.max(...out.slice(1)) - Math.min(...out.slice(1))).toBeLessThanOrEqual(12);
    expect(new Set(out).size).toBe(out.length);
  });
});
