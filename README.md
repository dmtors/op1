# OP-1

A pocket synth played by Wikipedia articles, drawn after teenage engineering's
OP-1. Four coloured knobs each pick an article, and the article's signals from
the [Wikimedia Attribution API](https://www.mediawiki.org/wiki/Attribution_API)
(beta) shape one part of the sound. The screen shows the four articles round a
pixel Wikipedia globe whose pieces spring apart sideways as notes play, a hair
for a smooth sound and nearly to the edges for a rough one.

Live at **https://dmtors.github.io/op1/**

## How the knobs shape the sound

| Knob      | Sound                       | Article signal            | Low end                     | High end                          |
| --------- | --------------------------- | ------------------------- | --------------------------- | --------------------------------- |
| 🔵 Blue   | Waveform                    | Unique contributors       | under 100 → sine            | 1,500+ → sawtooth                 |
| 🟢 Green  | Filter (brightness)         | References                | none → 250 Hz, muffled      | 400+ → 7 kHz, bright              |
| ⚪ White  | Envelope (how long it rings) | Page views, last 30 days | few → 0.12 s pluck          | many → 2.2 s ring                 |
| 🟠 Orange | Effect (vibrato)            | Days since the last edit  | a year or more → steady     | today → wide, fast wobble         |

Waveform steps: under 100 contributors sine, 100+ triangle, 400+ square,
1,500+ sawtooth. A trending article always shimmers. A note's roughness, which
decides how far the globe splits, is mostly its waveform (55%), then its
brightness (30%), then its wobble (15%).

Each knob's list of articles is in `js/articles.js`, ordered so turning
clockwise goes from one end of its sound to the other. The sound always comes
from live signals, so as articles are read and edited a choice can drift.

## Playing

- Click, tap or drag across the keys, or use the computer keyboard: `A`–`'`
  play, `Z`/`X` change octave. A note rings while its key is held.
- Drag or scroll a knob to turn it; it moves one article per notch.
- The four keys under the speaker switch modes (synth, drum, tape, mixer), as
  do `1`–`4`. `Space` starts and stops the transport.

## Running it

Plain HTML, CSS and JavaScript modules, no build step. Serve the folder:

```bash
python3 -m http.server 5183
```

## Files

- `index.html`, `style.css`: the device
- `js/app.js`: builds the keys and knobs, plays them, runs the screen
- `js/audio.js`: the Web Audio synth, drums and metronome
- `js/wiki.js`: fetches an article's signals and maps them to sound
- `js/articles.js`: each knob's list of articles
- `js/screen.js`, `js/wiki-screen.js`: the screen, one mode each
- `js/font.js`: the screen's 5×7 pixel font
- `js/logo.js`: the globe as a pixel puzzle, split into its pieces
