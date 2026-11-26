// Meridian Ring Run — the valley: terrain height, the river, the two
// runways, the ring course and the clouds. All of it is a pure function
// of the seed, so the flight model, the renderer and the screenshot
// autopilot always agree about the world.
import { WORLD } from './config.js';
import { makeNoise2D, makeRng } from './random.js';

const noise = makeNoise2D(WORLD.seed);
const noiseFar = makeNoise2D(WORLD.seed + 77);

/** Rolling hills that rise toward the valley walls. Metres above datum. */
export function terrainHeight(x, z) {
  const wall = Math.min(1, Math.abs(x) / 900);
  let hills = noise(x * 0.004, z * 0.004) * 46
    + noise(x * 0.013 + 40, z * 0.013) * 16
    + noiseFar(x * 0.0016, z * 0.0016) * 120 * wall * wall;
  // The valley floor: flat ground along the start runway's first
  // stretch, so the takeoff rolls over open fields and the parked view
  // opens onto the sky instead of a wall of hills.
  if (z < 900) {
    const floor = 0.25 + 0.75 * Math.min(1, Math.abs(x) / 300);
    hills *= floor;
  }
  // The same flat ground on the final approach to the home runway, so
  // a plane on the glide slope never meets a hill short of the
  // threshold.
  if (z > 4800 && z < 6000) {
    const floor = 0.15 + 0.85 * Math.min(1, Math.abs(x) / 300);
    hills *= floor;
  }
  // The runway strips and the ground under them are flattened.
  if (Math.abs(x - WORLD.runwayX) < 60 && z > WORLD.runwayZ0 - 80 && z < WORLD.runwayZ1 + 80) {
    return Math.min(hills, 2);
  }
  if (Math.abs(x - WORLD.homeX) < 60 && z > WORLD.homeZ0 - 80 && z < WORLD.homeZ1 + 80) {
    return Math.min(hills, 2);
  }
  return hills;
}

/** The river winds down the valley, east of the course. */
export function riverX(z) {
  return 210 + 150 * Math.sin(z * 0.0011) + 60 * Math.sin(z * 0.0031 + 2.0);
}

export function isRiver(x, z) {
  return Math.abs(x - riverX(z)) < 26;
}

export function onRunway(x, z) {
  return Math.abs(x - WORLD.runwayX) <= WORLD.runwayHalfWidth
    && z >= WORLD.runwayZ0 && z <= WORLD.runwayZ1;
}

export function onHomeRunway(x, z) {
  return Math.abs(x - WORLD.homeX) <= WORLD.runwayHalfWidth
    && z >= WORLD.homeZ0 && z <= WORLD.homeZ1;
}

/** The ring course: ten rings winding up the valley, then home. Each
 * ring floats well above the ground beneath it, so the course never
 * asks the plane to fly through a hillside. */
export function buildCourse() {
  const rings = [];
  for (let i = 0; i < WORLD.ringCount; i += 1) {
    const z = WORLD.ringFirstZ + i * WORLD.ringSpacing;
    const x = 240 * Math.sin(i * 0.85) * (1 - i * 0.03);
    const y = terrainHeight(x, z) + 62 + 26 * Math.sin(i * 1.25 + 0.6) + i * 2;
    const nextZ = z + WORLD.ringSpacing;
    const nextX = 240 * Math.sin((i + 1) * 0.85) * (1 - (i + 1) * 0.03);
    const heading = Math.atan2(nextX - x, nextZ - z);
    rings.push({ index: i, x, y, z, radius: WORLD.ringRadius, heading });
  }
  return rings;
}

/** Distant peaks ringing the valley, for the horizon. They stand on a
 * wide ring around the course's midpoint and never in the southern
 * sector behind the start runway, so none of them ever looms over the
 * takeoff or the final approach. */
export function buildPeaks() {
  const rng = makeRng(WORLD.seed + 5);
  const peaks = [];
  for (let i = 0; i < 22; i += 1) {
    // Angles around the ring, skipping the sector behind the start.
    const angle = -2.35 + (i / 21) * 4.7;
    const dist = 3100 + rng() * 1100;
    peaks.push({
      x: Math.sin(angle) * dist,
      z: 2900 + Math.cos(angle) * dist,
      base: 380 + rng() * 320,
      height: 260 + rng() * 240,
      lean: (rng() - 0.5) * 0.3,
    });
  }
  return peaks;
}

/** Soft clouds drifting over the valley. */
export function buildClouds() {
  const rng = makeRng(WORLD.seed + 11);
  const clouds = [];
  for (let i = 0; i < 42; i += 1) {
    clouds.push({
      x: (rng() - 0.5) * 2600,
      y: 300 + rng() * 170,
      z: 300 + rng() * 5600,
      size: 90 + rng() * 190,
      drift: 1.5 + rng() * 2.5,
    });
  }
  return clouds;
}

/** A few hot-air balloons floating over the fields, for colour. */
export function buildBalloons() {
  const rng = makeRng(WORLD.seed + 23);
  const colours = ['#e2543e', '#e8a13a', '#3f8fd2', '#7a5fd0', '#3fae7a'];
  const balloons = [];
  for (let i = 0; i < 6; i += 1) {
    balloons.push({
      x: (rng() - 0.5) * 1400,
      y: 150 + rng() * 90,
      z: 900 + rng() * 4200,
      radius: 13 + rng() * 6,
      colour: colours[i % colours.length],
      bob: rng() * Math.PI * 2,
    });
  }
  return balloons;
}
