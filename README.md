# Cat Audio Decoder (LC-9000)

A web game about a machine whose only real function is to get switched off — by a cat.
Inspired by Claude Shannon's Ultimate Machine (the box that flips its own switch back to OFF).

## Run it

Any static file server works (no build step; ES modules need http://, not file://):

```bash
python -m http.server 8765
```

Then open <http://localhost:8765>. Sound on.

## How to play

1. The cat is sitting on the big green `PLAY / DECODE` lever. Clicking the lever gets your cursor swatted.
2. Grab the cat by the scruff (click-drag) and fling it into the room.
3. Hit `PLAY` before it gets back. It always gets back.
4. Three throws. On the third one, physics — and a cardboard box — take over.

## What's in the box

| File | What it does |
|---|---|
| `index.html` | Page shell, title card, subtitle bar, the post-mortem overlays (static / blue screen) |
| `scene3d.js` | The rooms in real 3D (Three.js): voxel-style furniture, a shadow-casting lamp, the desk, the kitchen. Rendered at 400×225 and nearest-upscaled so it stays pixel art. |
| `sprites.js` | All pixel art drawn in code: 12 cat poses (used as a billboard texture in the 3D scene), cursors, tux |
| `audio.js` | Real cat recordings (Wikimedia Commons, CC0/PD) for meow / hiss / yowl / purr, layered with Web Audio synth SFX (CLACK, war cry, glass, CRUNCH…). The cat's monologue uses the browser's SpeechSynthesis. |
| `game.js` | Intro cutscene, state machine, physics in world units, the three throws, and the scripted Shannon climax |

Fetched from the internet at runtime: Three.js (jsDelivr), the pixel fonts (Google Fonts), and the cat recordings (Wikimedia Commons).
Every visual is generated in code, so there are no binary assets in the repo.

## Ending

There is no retry. After the recording is decoded, the cat destroys the decoder, the tab closes itself,
and if the browser refuses to close a tab it didn't open, the page walks off into a real 404.
