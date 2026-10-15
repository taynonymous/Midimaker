import { useEffect, useMemo, useRef } from "react";
import { loopBeats, useStore } from "../state/store";
import { engine } from "../audio/engine";
import { midiToName } from "../music/theory";
import type { Note } from "../state/types";

const ROW = 7;
const BLACK = new Set([1, 3, 6, 8, 10]);

/** Read-mostly loop view. Click a note to delete it. Ghosts show pre-fix timing. */
export function PianoRoll() {
  const notes = useStore((s) => s.notes);
  const ghost = useStore((s) => s.ghost);
  const bars = useStore((s) => s.bars);
  const playing = useStore((s) => s.playing);
  const deleteNote = useStore((s) => s.deleteNote);
  const headRef = useRef<SVGLineElement>(null);

  const lb = loopBeats({ bars });
  const W = 1000;
  const all = ghost ? [...notes, ...ghost] : notes;
  const [lo, hi] = useMemo(() => {
    if (!all.length) return [48, 84];
    const ms = all.map((n) => n.midi);
    const lo = Math.min(...ms) - 2;
    const hi = Math.max(...ms) + 2;
    return hi - lo < 24 ? [lo - Math.floor((24 - (hi - lo)) / 2), lo - Math.floor((24 - (hi - lo)) / 2) + 24] : [lo, hi];
  }, [all]);
  const rows = hi - lo + 1;
  const H = rows * ROW;
  const x = (beat: number) => (beat / lb) * W;
  const y = (midi: number) => (hi - midi) * ROW;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const b = engine.positionBeats(lb);
      headRef.current?.setAttribute("x1", String(x(b)));
      headRef.current?.setAttribute("x2", String(x(b)));
      raf = requestAnimationFrame(tick);
    };
    if (playing) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, lb]);

  const rect = (n: Note, cls: string, onClick?: () => void) => {
    // Notes that wrap past the loop end are drawn in two pieces.
    const end = n.start + n.duration;
    const pieces: [number, number][] = end > lb ? [[n.start, lb], [0, end - lb]] : [[n.start, end]];
    return pieces.map(([a, b], i) => (
      <rect
        key={`${n.id}-${cls}-${i}`}
        className={`${cls} ${n.track}`}
        x={x(a)}
        y={y(n.midi) + 0.5}
        width={Math.max(2, x(b) - x(a) - 0.5)}
        height={ROW - 1}
        rx={1.5}
        style={{ opacity: cls === "note" ? 0.45 + n.velocity * 0.55 : undefined }}
        onClick={onClick}
      >
        <title>{`${midiToName(n.midi)} · ${n.track} · beat ${n.start.toFixed(2)} · vel ${Math.round(n.velocity * 127)}`}</title>
      </rect>
    ));
  };

  return (
    <div className="roll-wrap">
      <svg className="roll" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: Math.min(340, Math.max(170, H)) }}>
        {Array.from({ length: rows }, (_, i) => hi - i)
          .filter((m) => BLACK.has(m % 12))
          .map((m) => (
            <rect key={m} className="lane-black" x={0} y={y(m)} width={W} height={ROW} />
          ))}
        {Array.from({ length: lb * 4 + 1 }, (_, i) => (
          <line
            key={i}
            className={i % 16 === 0 ? "grid-bar" : i % 4 === 0 ? "grid-beat" : "grid-16"}
            x1={x(i / 4)}
            x2={x(i / 4)}
            y1={0}
            y2={H}
          />
        ))}
        {ghost?.flatMap((n) => rect(n, "ghost"))}
        {notes.flatMap((n) => rect(n, "note", () => deleteNote(n.id)))}
        <line ref={headRef} className="playhead" x1={0} x2={0} y1={0} y2={H} />
      </svg>
      {!notes.length && (
        <div className="roll-empty">
          Press <kbd>R</kbd> to record, then play keys <kbd>A</kbd>–<kbd>;</kbd> for melody and <kbd>1</kbd>–<kbd>7</kbd> for chords.
        </div>
      )}
    </div>
  );
}
