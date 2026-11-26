// Meridian Ring Run — the game loop and the screens. Title, flying,
// paused, landed and crashed: one fixed-step simulation, one canvas,
// and a ?shot= mode that stages a frozen frame for the screenshots.
import { STEP } from './config.js';
import { createAudio } from './audio.js';
import { createInput, readFlightInput } from './input.js';
import {
  EVENT_CRASHED, EVENT_LANDED, EVENT_RING, PHASE_CRASHED, PHASE_FLYING,
  PHASE_LANDED, PHASE_TITLE, createWorld, resetWorld, stepWorld,
} from './physics.js';
import { drawWorld } from './render.js';
import { drawEnd, drawHud, drawPaused, drawTitle } from './hud.js';
import { SHOT_NAMES, stageShot } from './shots.js';

const BEST_KEY = 'meridian-ring-run-best';

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Best score is a nicety; the game plays without it.
  }
}

function fitCanvas(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  return { w, h, dpr };
}

export function startGame(canvas, statusEl) {
  const ctx = canvas.getContext('2d');
  const world = createWorld();
  world.best = loadBest();
  const input = createInput(canvas);
  const audio = createAudio();
  let paused = false;
  let throttle = 0;
  let shot = null;

  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  if (shotName && SHOT_NAMES.includes(shotName)) {
    shot = stageShot(shotName, world);
    // Deliberately no phase reset here: if staging crashed the plane,
    // the screenshot must show the crash, not hide it.
  }

  function setStatus() {
    if (!statusEl) return;
    const lines = {
      [PHASE_TITLE]: 'Meridian Ring Run: on the runway, ready to fly.',
      [PHASE_FLYING]: `Flying: ${world.ringsPassed} of ${world.rings.length} rings, score ${world.score}.`,
      [PHASE_LANDED]: `Landed! Final score ${world.score}.`,
      [PHASE_CRASHED]: `Crashed: ${world.crashReason}`,
    };
    statusEl.textContent = lines[world.phase] ?? '';
  }

  function startFlying() {
    audio.ensure();
    if (world.phase === PHASE_TITLE) {
      world.phase = PHASE_FLYING;
      world.throttle = 0.7;
      throttle = 0.7;
    }
    setStatus();
  }

  function restart() {
    resetWorld(world);
    world.best = loadBest();
    throttle = 0;
    paused = false;
    startFlying();
  }

  canvas.addEventListener('pointerdown', () => {
    if (world.phase === PHASE_TITLE) startFlying();
  });

  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    const size = fitCanvas(canvas);
    const { w, h, dpr } = size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;

    if (!world.frozen) {
      // One-shot keys.
      if (input.wasPressed('Enter') || input.wasPressed('Space')) {
        if (world.phase === PHASE_TITLE) startFlying();
        else if (world.phase === PHASE_LANDED || world.phase === PHASE_CRASHED) restart();
      }
      if (input.wasPressed('KeyR') && world.phase !== PHASE_TITLE) restart();
      if (input.wasPressed('KeyP') && world.phase === PHASE_FLYING) paused = !paused;
      if (input.wasPressed('KeyM')) audio.toggleMute();
      if (input.wasPressed('Escape')) paused = false;

      if (world.phase === PHASE_FLYING && !paused) {
        accumulator += elapsed;
        while (accumulator >= STEP) {
          accumulator -= STEP;
          const flight = readFlightInput(input, canvas, throttle, STEP);
          throttle = flight.throttle;
          const events = stepWorld(world, flight, STEP);
          if (events & EVENT_RING) audio.ring();
          if (events & EVENT_LANDED) {
            audio.fanfare();
            if (world.score > world.best) {
              world.best = world.score;
              saveBest(world.best);
            }
            setStatus();
          }
          if (events & EVENT_CRASHED) {
            audio.thud();
            if (world.score > world.best) {
              world.best = world.score;
              saveBest(world.best);
            }
            setStatus();
          }
        }
      }
      audio.update(world.throttle, world.speed, world.phase === PHASE_FLYING && !paused);
    }

    const { project } = drawWorld(ctx, world, w, h, now / 1000);
    if (world.phase !== PHASE_TITLE || shot) drawHud(ctx, world, w, h, now / 1000, project);
    if (world.phase === PHASE_TITLE && !shot) drawTitle(ctx, world, w, h, now / 1000);
    if (paused && world.phase === PHASE_FLYING) drawPaused(ctx, w, h);
    if (world.phase === PHASE_LANDED || world.phase === PHASE_CRASHED) {
      drawEnd(ctx, world, w, h);
    }
    input.endFrame();
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => fitCanvas(canvas));
  setStatus();
  requestAnimationFrame(frame);

  // For the screenshot tool: a live read-out of the flight state.
  window.__flight = {
    state() {
      return {
        phase: world.phase,
        time: Math.round(world.time * 10) / 10,
        x: Math.round(world.x),
        y: Math.round(world.y),
        z: Math.round(world.z),
        speed: Math.round(world.speed),
        rings: world.ringsPassed,
        score: world.score,
        frozen: world.frozen,
        shot,
      };
    },
  };
  return world;
}

// Boot when the page loads.
const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
if (canvas) startGame(canvas, statusEl);
