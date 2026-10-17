import * as Tone from "tone";
import { PRESETS, type PresetName } from "./presets";
import { DrumKit, type DrumPatternName } from "./drums";
import type { Note, TrackId, TrackSettings } from "../state/types";

class TrackChain {
  synth: Tone.PolySynth<any>;
  private presetName: PresetName;
  readonly filter = new Tone.Filter(18000, "lowpass", -12);
  readonly wobble = new Tone.Vibrato(0.6, 0);
  readonly chorus = new Tone.Chorus(1.5, 3.5, 0.6).start();
  readonly delay = new Tone.PingPongDelay("8n.", 0.35);
  readonly reverb = new Tone.Reverb({ decay: 4.5, preDelay: 0.02 });
  readonly channel = new Tone.Channel();
  part: Tone.Part<Note & { time: string }> | null = null;

  constructor(preset: PresetName, out: Tone.InputNode) {
    this.presetName = preset;
    this.synth = this.makeSynth(preset);
    this.filter.chain(this.wobble, this.chorus, this.delay, this.reverb, this.channel, out);
  }

  private makeSynth(name: PresetName) {
    const p = PRESETS[name];
    const s = p.create();
    s.maxPolyphony = 24;
    s.volume.value = p.volume;
    s.connect(this.filter);
    return s;
  }

  apply(t: TrackSettings) {
    if (t.preset !== this.presetName) {
      this.synth.releaseAll();
      const old = this.synth;
      setTimeout(() => old.dispose(), 3000);
      this.synth = this.makeSynth(t.preset);
      this.presetName = t.preset;
    }
    this.channel.volume.rampTo(t.volume, 0.05);
    this.channel.mute = t.mute;
    this.filter.frequency.rampTo(t.cutoff, 0.05);
    this.chorus.wet.value = t.chorus;
    this.delay.wet.value = t.delay;
    this.reverb.wet.value = t.reverb;
    this.wobble.depth.value = t.wobble * 0.35;
    this.wobble.frequency.value = 0.4 + t.wobble * 4;
  }
}

/** Audio graph: tracks → master (EQ → glue comp → limiter) → speakers. */
class Engine {
  private started = false;
  private masterIn = new Tone.Gain(1);
  private eq = new Tone.EQ3({ low: 1.5, mid: -1, high: 2, lowFrequency: 180, highFrequency: 4200 });
  private comp = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.02, release: 0.2, knee: 8 });
  private limiter = new Tone.Limiter(-0.8);
  private makeup = new Tone.Gain(Tone.dbToGain(3));
  private recorder = new Tone.Recorder();
  private drums = new DrumKit();
  private click = new Tone.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
    volume: -14,
  });
  private clickLoop: Tone.Loop | null = null;
  private mastering = true;
  readonly tracks: Record<TrackId, TrackChain>;

  constructor() {
    this.tracks = {
      lead: new TrackChain("supersaw", this.masterIn),
      chords: new TrackChain("edmStab", this.masterIn),
    };
    this.drums.out.connect(this.masterIn);
    this.click.toDestination();
    this.limiter.connect(Tone.getDestination());
    this.limiter.connect(this.recorder);
    this.setMastering(true);
  }

  /**
   * Must be called from a user gesture. Also re-resumes after the browser suspends audio
   * (backgrounded tab, app switch, iOS interruption) — not just the first time.
   */
  async start() {
    if (Tone.getContext().state !== "running") await Tone.start();
    if (this.started) return;
    Tone.getContext().lookAhead = 0.03; // lower latency for live playing
    this.started = true;
  }


  setMastering(on: boolean) {
    this.mastering = on;
    this.masterIn.disconnect();
    if (on) this.masterIn.chain(this.eq, this.comp, this.makeup, this.limiter);
    else this.masterIn.connect(this.limiter);
  }
  get masteringOn() {
    return this.mastering;
  }

  // Live notes are always triggered "now" (see the voice handling in the store).
  noteOn(track: TrackId, midi: number, velocity: number) {
    this.tracks[track].synth.triggerAttack(Tone.Frequency(midi, "midi").toFrequency(), Tone.now(), velocity);
  }

  noteOff(track: TrackId, midi: number) {
    this.tracks[track].synth.triggerRelease(Tone.Frequency(midi, "midi").toFrequency(), Tone.now());
  }

  allOff() {
    for (const t of Object.values(this.tracks)) t.synth.releaseAll();
  }

  // ---- transport ----
  setTempo(bpm: number) {
    Tone.getTransport().bpm.value = bpm;
  }

  setLoop(bars: number) {
    const tr = Tone.getTransport();
    tr.loop = true;
    tr.loopStart = 0;
    tr.loopEnd = `${bars}m`;
  }

  play() {
    Tone.getTransport().start("+0.05");
  }

  stop() {
    Tone.getTransport().stop();
    this.allOff();
  }

  get playing() {
    return Tone.getTransport().state === "started";
  }

  /** Current position in beats, wrapped into the loop. */
  positionBeats(loopBeats: number) {
    const tr = Tone.getTransport();
    const beats = tr.ticks / tr.PPQ;
    return ((beats % loopBeats) + loopBeats) % loopBeats;
  }

  setMetronome(on: boolean) {
    this.clickLoop?.dispose();
    this.clickLoop = null;
    if (!on) return;
    this.clickLoop = new Tone.Loop((time) => {
      const tr = Tone.getTransport();
      const beat = Math.round(tr.getTicksAtTime(time) / tr.PPQ) % 4;
      this.click.triggerAttackRelease(beat === 0 ? "C6" : "C5", "32n", time);
    }, "4n").start(0);
  }

  setDrums(p: DrumPatternName) {
    this.drums.setPattern(p);
  }

  setDrumVolume(db: number) {
    this.drums.out.gain.rampTo(Tone.dbToGain(db), 0.05);
  }

  /** Rebuild the scheduled playback for a track from its note list. */
  setNotes(track: TrackId, notes: Note[]) {
    const chain = this.tracks[track];
    chain.part?.dispose();
    const ppq = Tone.getTransport().PPQ;
    const events = notes.map((n) => ({ ...n, time: `${Math.round(n.start * ppq)}i` }));
    chain.part = new Tone.Part((time, ev) => {
      const freq = Tone.Frequency(ev.midi, "midi").toFrequency();
      chain.synth.triggerAttackRelease(freq, `${Math.max(1, Math.round(ev.duration * ppq))}i`, time, ev.velocity);
    }, events).start(0);
  }

  /** Record exactly one pass of the loop (plus reverb tail) to an audio blob. */
  async bounce(bars: number): Promise<Blob> {
    const tr = Tone.getTransport();
    tr.stop();
    this.allOff();
    const seconds = Tone.Time(`${bars}m`).toSeconds();
    await this.recorder.start();
    tr.start("+0.05", 0);
    await new Promise((r) => setTimeout(r, (seconds + 0.05) * 1000));
    tr.stop();
    await new Promise((r) => setTimeout(r, 2500));
    return this.recorder.stop();
  }
}

export const engine = new Engine();
