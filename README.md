# Midimaker

Browser instrument for sketching EDM / vaporwave keyboard loops: play a melody and diatonic chords, loop-record them, then tighten the timing with a quantizer or with Claude.

## Run

```bash
npm install
cp .env.example .env        # optional: add ANTHROPIC_API_KEY for "AI fix timing"
export $(cat .env | xargs)
npm run dev                 # web on :5173, API on :8787 (proxied at /api)
```

Production: `npm run build && npm start` (single Node process serves `dist/` + `/api` on `$PORT`), or `docker build -t midimaker . && docker run -p 8787:8787 -e ANTHROPIC_API_KEY midimaker`.

### GitHub Pages (static, no AI)

`npm run build:pages` builds with `VITE_AI=false` (from `.env.pages`) and relative asset paths. The AI button is hidden and no `/api` calls are made. Everything else runs in the browser.

`.github/workflows/pages.yml` runs the tests, then builds and deploys on every push to `master`. One-time setup: **Settings → Pages → Source: GitHub Actions**.

## Controls

The main screen has a scene picker, **Play / Record / Undo**, one **Fix timing** button, a stage area, and the instruments. The stage shows the **tweaks** (Song, Chords, Melody and Timing tabs) by default. Pressing **Record** switches it to the **loop timeline**, which has the MIDI/audio export and Clear buttons. The ⚙/▤ button switches back. **Reset** reverts every tweak to the selected scene's defaults without touching recorded notes. A dot on the scene chip means the settings have been tweaked.

On phones, Chords and Keys are tabs, the keyboard shows one octave with on-screen octave buttons, and In landscape, both instruments fit on one screen.

| Key | Action |
|---|---|
| `A W S E D F T G Y H U J K O L P ;` | Melody keyboard (home row = white keys) |
| `Z` / `X` | Melody octave down / up |
| `1`–`7` | Diatonic chords (I–vii in the current key) |
| `Space` | Play / stop |
| `R` | Record / overdub (loops, arms per track) |
| `M` | Metronome |

A hardware MIDI keyboard works too (Chrome/Edge, Web MIDI). The header toggle routes it to the melody synth or to chord mode, where each key plays the diatonic chord rooted nearest it.

**Scale lock** snaps every melody key into the current key, so there are no wrong notes. Chords are voice-led automatically: each chord is re-voiced close to the previous one, with the root in the bass.

## Sound

- **Scenes** set the tempo, key, voicing, synths, FX and drums in one click: EDM, Vaporwave, Future Bass, Lo-fi Dream.
- **Per track:** synth preset, tone (low-pass), chorus, ping-pong delay, reverb, tape wobble, volume.
- **Master FX:** EQ, then a glue compressor, then a limiter. Toggle it to A/B.
- **Exports:** `.mid` (two tracks, tempo set) and a one-loop audio bounce (`.webm`, includes the reverb tail).

## Timing

- **Quantize:** grid (1/8, 1/16, 1/32 and triplets), strength, swing, and length quantize. Notes played together as a chord are clustered so they land on the same grid line.
- **Humanize:** adds small random timing and velocity variation.
- **AI fix timing** (`POST /api/fix-timing`): sends the loop to `claude-opus-5-5` with structured output. Claude infers the intended grid per phrase, keeping triplets and pushes, removing consistent input latency, aligning chords, fixing legato and lengths, and evening out velocity. The server then enforces that pitches stay fixed, no notes are invented, and every value stays in range. Feel options are `tight`, `natural` and `swing`.
- After every fix, the previous take is shown as dashed **ghost notes**. Undo is 50 levels deep. Click a note in the roll to delete it.

## Layout

```
src/audio      Tone.js engine, synth presets, drum kit, master chain
src/music      scales, diatonic chords, voice leading
src/timing     quantize / humanize (pure, unit-tested)
src/state      zustand store, scenes; bindEngine() syncs store → audio
src/input      computer keyboard + Web MIDI
server         node:http API + static serving, Claude timing fixer
```

`npm test` runs the unit tests and `npm run typecheck` runs the type checker.
