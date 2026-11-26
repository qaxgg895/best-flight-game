# best-flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/qaxgg895/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/qaxgg895/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Meridian Ring Run** — a golden-hour flight game. Take the little stunt plane "Kestrel" off the runway, thread ten glowing rings over a river valley, and bring her home to land on the far runway. A chase view over patchwork fields, a winding river, snow-capped peaks and drifting balloons, with a full instrument panel: compass tape, airspeed and altitude tapes, artificial horizon, throttle, score and a guidance arrow to the next ring.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network request — `game/` is plain static files.

## How to fly

- **← →** or **A/D** — bank and turn
- **↑ ↓** — pitch (climb / dive)
- **W / S** — throttle up / down (Shift boosts, Ctrl cuts)
- **Mouse drag** — steer toward the pointer
- **P** — pause, **M** — mute, **R** — fly again

Fly through every gold ring (closer to the centre scores more), watch your speed — below stall speed the wing stops flying — and land gently on the home runway for the touchdown bonus and a time bonus against the 2:30 par.

## How it is built

- `game/index.html` — the page; everything is drawn on one canvas.
- `game/src/config.js` — all tuning constants in one place.
- `game/src/random.js` — seeded PRNG and value noise; the valley is deterministic.
- `game/src/terrain.js` — the heightfield, river, runways, ring course, peaks, clouds, balloons.
- `game/src/physics.js` — the arcade flight model: bank to turn, pitch, throttle, stall, ring crossings, takeoff roll and landings.
- `game/src/render.js` — the hand-rolled 3D projector and the chase view: sky, sun, peaks, terrain, rings, clouds, balloons and the plane.
- `game/src/hud.js` — the instruments, guidance, messages and the title/end screens.
- `game/src/audio.js` — synthesised WebAudio sound: engine hum, wind, ring chime, landing fanfare.
- `game/src/input.js` — keyboard and mouse.
- `game/src/shots.js` — the autopilot that stages the screenshots in `screenshots/` (`?shot=takeoff|ring|valley|landing`).
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the kit's `vendor/makefun-game.ts`.

All art, sound and names are original, drawn and synthesised by this entry's own code.

---

<sub>Entered on [make.fun](https://make.fun/?ref=s9sfjdj8&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
