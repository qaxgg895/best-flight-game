// Meridian Ring Run — the screenshot scenes behind ?shot=takeoff|ring|
// valley|landing. Each one plays the real rules forward from a fresh
// world for a fixed stretch, steered by a simple autopilot (bank toward
// the next ring, pitch to hold its height, throttle to hold speed), so
// the frame is what a real flight looks like and the same seed always
// gives the same frame. The staged world is frozen: the render loop
// keeps drawing it, but time no longer advances.
import { STEP } from './config.js';
import { guidance, PHASE_FLYING, stepWorld } from './physics.js';
import { terrainHeight } from './terrain.js';

const SAMPLE = STEP;

/** Steer toward the current target: the next ring, then the runway. */
function autopilot(world) {
  const g = guidance(world);
  const desiredHeading = Math.atan2(g.dx, g.dz);
  let headingError = desiredHeading - world.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  const roll = Math.max(-1, Math.min(1, headingError * 1.6));
  const targetY = g.kind === 'ring' ? g.dy + world.y : Math.max(28, g.distance * 0.11);
  const heightError = targetY - world.y;
  // Never aim below the hills: hold at least 45 m over the ground
  // under the plane, and dive gently — a steep dive into a valley wall
  // is how flights end.
  const floorY = terrainHeight(world.x, world.z) + 45;
  const safeTarget = Math.max(targetY, floorY);
  const pitch = Math.max(-0.3, Math.min(0.5, (safeTarget - world.y) * 0.015 + 0.05));
  // Hold about 62 m/s: full throttle while slow, ease off when fast.
  const throttle = world.speed < 55 ? 0.95 : world.speed > 72 ? 0.55 : 0.75;
  return { roll, pitch, throttle };
}

function flyFor(world, seconds, until) {
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, autopilot(world), SAMPLE);
    if (until && until(world)) break;
  }
}

/**
 * Stage the named scene on a fresh world and freeze it. Returns the
 * screen the renderer should draw over it.
 */
export function stageShot(name, world) {
  world.phase = PHASE_FLYING;
  world.throttle = 0.85;
  if (name === 'takeoff') {
    // Just after liftoff: the wheels have left the runway, the strip
    // still stretches ahead below, the instruments are lit.
    flyFor(world, 3.0);
  } else if (name === 'ring') {
    // Through the fourth ring: the gold ring fills the frame, the next
    // one glows ahead over the river bend.
    flyFor(world, 90, (w) => w.ringsPassed >= 4);
    flyFor(world, 0.35);
  } else if (name === 'valley') {
    // Low over the river past the seventh ring, mountains all around.
    flyFor(world, 150, (w) => w.ringsPassed >= 7);
    flyFor(world, 0.4);
  } else if (name === 'landing') {
    // Final approach: the home runway ahead, gear down in spirit,
    // slow and steady over the threshold.
    flyFor(world, 240, (w) => w.ringsPassed >= world.rings.length);
    flyFor(world, 25, (w) => {
      const dz = 5640 - w.z;
      return dz < 900 && dz > 0;
    });
  } else {
    flyFor(world, 6);
  }
  world.frozen = true;
  return 'photo';
}

export const SHOT_NAMES = ['takeoff', 'ring', 'valley', 'landing'];
