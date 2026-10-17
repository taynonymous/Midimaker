import { useRef } from "react";
import { useStore } from "../state/store";
import { isInScale, midiToName } from "../music/theory";
import { LEAD_KEY_LABELS } from "../input/keyboard";
import { useMedia } from "../useMedia";

const BLACK = new Set([1, 3, 6, 8, 10]);

/** On-screen keyboard for the lead track: two octaves on desktop, one on phones. */
export function Piano() {
  const leadOctave = useStore((s) => s.leadOctave);
  const keyRoot = useStore((s) => s.keyRoot);
  const scale = useStore((s) => s.scale);
  const scaleLock = useStore((s) => s.scaleLock);
  const held = useStore((s) => s.heldMidi.lead);
  const active = useRef(new Map<number, number>()); // pointerId → midi
  const narrow = useMedia("(max-width: 640px)");

  const base = (leadOctave + 1) * 12;
  const keys = Array.from({ length: narrow ? 13 : 25 }, (_, i) => base + i);
  const whites = keys.filter((m) => !BLACK.has(m % 12));

  const press = (pointerId: number, raw: number) => {
    const s = useStore.getState();
    const midi = s.leadNote(raw);
    const prev = active.current.get(pointerId);
    if (prev === midi) return;
    if (prev !== undefined) s.noteOff("lead", prev);
    active.current.set(pointerId, midi);
    s.noteOn("lead", midi, 0.8);
  };
  const release = (pointerId: number) => {
    const prev = active.current.get(pointerId);
    if (prev === undefined) return;
    active.current.delete(pointerId);
    useStore.getState().noteOff("lead", prev);
  };

  const keyProps = (m: number) => ({
    "data-midi": m,
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      press(e.pointerId, m);
    },
    onPointerEnter: (e: React.PointerEvent) => e.buttons && press(e.pointerId, m),
    onPointerUp: (e: React.PointerEvent) => release(e.pointerId),
    onPointerCancel: (e: React.PointerEvent) => release(e.pointerId),
    onPointerLeave: (e: React.PointerEvent) => e.buttons && release(e.pointerId),
  });

  const cls = (m: number, black: boolean) =>
    [
      black ? "key black" : "key white",
      held.includes(m) && "down",
      isInScale(m, keyRoot, scale) ? "in-scale" : scaleLock && "dim",
      m % 12 === keyRoot && "tonic",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="piano" onContextMenu={(e) => e.preventDefault()}>
      {whites.map((m, wi) => {
        const blackNext = BLACK.has((m + 1) % 12) && m + 1 <= keys[keys.length - 1];
        return (
          <div key={m} className="white-slot">
            <div className={cls(m, false)} {...keyProps(m)}>
              <span className="key-label">{LEAD_KEY_LABELS[m - base] ?? ""}</span>
              {m % 12 === 0 && <span className="key-name">{midiToName(m)}</span>}
            </div>
            {blackNext && (
              <div className={cls(m + 1, true)} {...keyProps(m + 1)} style={{ zIndex: 2 + wi }}>
                <span className="key-label">{LEAD_KEY_LABELS[m + 1 - base] ?? ""}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
