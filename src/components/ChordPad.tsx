import { useRef } from "react";
import { useStore } from "../state/store";
import { diatonicChord } from "../music/theory";

/** Seven diatonic chord pads for the current key — every pad sounds good together. */
export function ChordPad() {
  const { keyRoot, scale, voicing, chordOctave, activeChords } = useStore();
  const held = useRef(new Map<number, { notes: number[]; degree: number }>()); // pointerId → chord

  // Each pad captures its pointer, so a chord holds until the finger lifts no matter
  // how it drifts (unlike the piano, which releases capture to allow glissando).
  const down = (e: React.PointerEvent, degree: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    held.current.get(e.pointerId) && up(e); // defensive: never orphan a chord
    const notes = useStore.getState().chordOn(degree);
    held.current.set(e.pointerId, { notes, degree });
  };
  const up = (e: React.PointerEvent) => {
    const h = held.current.get(e.pointerId);
    if (!h) return;
    held.current.delete(e.pointerId);
    useStore.getState().chordOff(h.notes, h.degree);
  };

  return (
    <div className="chord-pads" onContextMenu={(e) => e.preventDefault()}>
      {Array.from({ length: 7 }, (_, d) => {
        const c = diatonicChord(d, keyRoot, scale, voicing, chordOctave);
        return (
          <button
            key={d}
            className={`pad ${activeChords.includes(d) ? "down" : ""} ${d === 0 ? "home" : ""}`}
            onPointerDown={(e) => down(e, d)}
            onPointerUp={up}
            onPointerCancel={up}
            onLostPointerCapture={up}
          >
            <span className="pad-roman">{c.roman}</span>
            <span className="pad-name">{c.name}</span>
            <span className="pad-key">{d + 1}</span>
          </button>
        );
      })}
    </div>
  );
}
