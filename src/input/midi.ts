import { useStore } from "../state/store";
import { SCALES } from "../music/theory";

export type MidiStatus = { supported: boolean; inputs: string[]; error?: string };

/**
 * Hardware MIDI input. In "lead" mode notes play the lead synth; in "chords"
 * mode each key plays the diatonic chord whose root is nearest that key.
 */
export async function bindMidi(onStatus: (s: MidiStatus) => void): Promise<() => void> {
  if (!navigator.requestMIDIAccess) {
    onStatus({ supported: false, inputs: [] });
    return () => {};
  }
  let access: MIDIAccess;
  try {
    access = await navigator.requestMIDIAccess();
  } catch (err) {
    onStatus({ supported: true, inputs: [], error: String(err) });
    return () => {};
  }

  // input note → release callback
  const held = new Map<number, () => void>();

  const onMessage = (e: MIDIMessageEvent) => {
    if (!e.data) return;
    const [status, note, vel] = e.data;
    const cmd = status & 0xf0;
    const s = useStore.getState();
    if (cmd === 0x90 && vel > 0) {
      held.get(note)?.();
      const velocity = Math.max(0.1, vel / 127);
      if (s.midiTarget === "lead") {
        const midi = s.leadNote(note);
        s.noteOn("lead", midi, velocity);
        held.set(note, () => useStore.getState().noteOff("lead", midi));
      } else {
        const steps = SCALES[s.scale] as readonly number[];
        const rel = (((note - s.keyRoot) % 12) + 12) % 12;
        let degree = 0;
        steps.forEach((st, i) => {
          if (Math.abs(st - rel) < Math.abs(steps[degree] - rel)) degree = i;
        });
        const notes = s.chordOn(degree, velocity);
        held.set(note, () => useStore.getState().chordOff(notes, degree));
      }
    } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
      held.get(note)?.();
      held.delete(note);
    }
  };

  const attach = () => {
    const names: string[] = [];
    access.inputs.forEach((input) => {
      input.onmidimessage = onMessage;
      names.push(input.name ?? input.id);
    });
    onStatus({ supported: true, inputs: names });
  };
  attach();
  access.onstatechange = attach;

  return () => {
    access.onstatechange = null;
    access.inputs.forEach((input) => (input.onmidimessage = null));
  };
}
