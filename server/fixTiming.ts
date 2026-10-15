import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const FixRequest = z.object({
  bpm: z.number().min(30).max(300),
  bars: z.number().int().min(1).max(32),
  feel: z.enum(["tight", "natural", "swing"]),
  style: z.string().max(40),
  key: z.string().max(20),
  notes: z
    .array(
      z.object({
        id: z.string().max(32),
        track: z.enum(["lead", "chords"]),
        midi: z.number().int().min(0).max(127),
        start: z.number(),
        duration: z.number(),
        velocity: z.number(),
      }),
    )
    .min(1)
    .max(1500),
});
export type FixRequest = z.infer<typeof FixRequest>;

const FixResult = z.object({
  summary: z.string().describe("2-4 short sentences for the musician: what you changed and why."),
  notes: z.array(
    z.object({
      id: z.string(),
      start: z.number().describe("Corrected start, in beats from loop start"),
      duration: z.number().describe("Corrected length, in beats"),
      velocity: z.number().describe("0..1"),
      keep: z.boolean().describe("false to drop an accidental/ghost note"),
    }),
  ),
});

const SYSTEM = `You are a seasoned electronic-music producer editing a MIDI loop that a musician just played live on a keyboard. Your job is to fix the *timing* (and lightly the dynamics) so the loop sounds tight and professional while keeping the musician's intent.

Units: all positions/lengths are in beats (quarter notes). The loop is \`bars * 4\` beats long and wraps; a start must be in [0, loopBeats).

How to edit:
- Infer the intended rhythmic grid per phrase. Don't blindly snap everything to 1/16: recognise triplets, dotted rhythms, and deliberate syncopation (pushes just before the downbeat are common in EDM leads).
- Notes on the "chords" track that were played as one chord should share a start (unless the style calls for a deliberate strum — then keep the strum order with even, small spacing).
- Late-by-a-few-ms notes are almost always sloppiness: put them on the grid. Live recordings also have consistent input latency — if nearly every note is late by a similar amount, shift them all back.
- Fix lengths: make chord notes end together, close tiny unintended gaps in legato lead lines, remove overlaps of the same pitch, and snap ends to the grid.
- Even out unintended velocity spikes but keep accents and phrasing. Chord notes in one chord should have similar velocity.
- Only set keep=false for obvious accidents: extremely short (< 1/32 beat) or very quiet stray notes, or exact duplicates.
- Feel: "tight" = fully on grid; "natural" = on grid but keep up to ~10 ms of human push/pull; "swing" = apply a shuffle to off-beat 16ths/8ths.
- Never change pitches. Return every input id exactly once.`;

export class AiUnavailableError extends Error {}

// Lazy so the app (and local quantize) still runs without credentials.
let client: Anthropic | null = null;

export async function fixTiming(req: FixRequest) {
  const loopBeats = req.bars * 4;
  const round = (x: number) => Math.round(x * 1000) / 1000;
  const compact = req.notes.map((n) => ({
    id: n.id,
    track: n.track,
    midi: n.midi,
    start: round(n.start),
    duration: round(n.duration),
    velocity: round(n.velocity),
  }));

  client ??= new Anthropic();
  const response = await client.messages
    .parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(FixResult) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            style: req.style,
            key: req.key,
            bpm: req.bpm,
            bars: req.bars,
            loopBeats,
            feel: req.feel,
            notes: compact,
          }),
        },
      ],
    })
    .catch((err: unknown) => {
      // The SDK throws a plain Error when no credentials are configured at all.
      if (err instanceof Anthropic.AnthropicError) throw err;
      throw new AiUnavailableError("AI unavailable: set ANTHROPIC_API_KEY on the server.");
    });

  if (response.stop_reason === "refusal") throw new Error("The model declined this request.");
  if (response.stop_reason === "max_tokens") throw new Error("Loop too long for one AI pass — try fewer bars.");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("AI returned an unparseable result.");

  // Trust but verify: never let the model invent notes, change pitch, or produce out-of-range values.
  const byId = new Map(parsed.notes.map((n) => [n.id, n]));
  const notes = req.notes.flatMap((orig) => {
    const fix = byId.get(orig.id);
    if (!fix) return [orig];
    if (!fix.keep) return [];
    const ok = Number.isFinite(fix.start) && Number.isFinite(fix.duration) && Number.isFinite(fix.velocity);
    if (!ok) return [orig];
    return [
      {
        ...orig,
        start: ((fix.start % loopBeats) + loopBeats) % loopBeats,
        duration: Math.min(loopBeats, Math.max(1 / 32, fix.duration)),
        velocity: Math.min(1, Math.max(0.05, fix.velocity)),
      },
    ];
  });

  return { summary: parsed.summary, notes, usage: response.usage };
}
