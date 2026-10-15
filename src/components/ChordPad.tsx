import { useRef } from "react";
import { useStore } from "../state/store";
import { diatonicChord } from "../music/theory";

/** Seven diatonic chord pads for the current key — every pad sounds good together. */
export function ChordPad() {
  const { keyRoot, scale, voicing, chordOctave, activeChord } = useStore();
  const held = useRef(new Map<number, number[]>()); // pointerId → notes

  const down = (e: React.PointerEvent, degree: number) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    const notes = useStore.getState().chordOn(degree);
    held.current.set(e.pointerId, notes);
  };
  const up = (e: React.PointerEvent) => {
    const notes = held.current.get(e.pointerId);
    if (!notes) return;
    held.current.delete(e.pointerId);
    useStore.getState().chordOff(notes);
  };

  return (
    <div className="chord-pads" onContextMenu={(e) => e.preventDefault()}>
      {Array.from({ length: 7 }, (_, d) => {
        const c = diatonicChord(d, keyRoot, scale, voicing, chordOctave);
        return (
          <button
            key={d}
            className={`pad ${activeChord === d ? "down" : ""} ${d === 0 ? "home" : ""}`}
            onPointerDown={(e) => down(e, d)}
            onPointerUp={up}
            onPointerLeave={up}
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
