// Meridian Ring Run — the flight model and the world state. An arcade
// model on purpose: bank to turn, pitch to climb and dive, throttle for
// speed, and a wing that stops flying below stall speed.
import { PLANE, SCORE, STEP, WORLD } from './config.js';
import {
  buildBalloons, buildClouds, buildCourse, buildPeaks,
  onHomeRunway, onRunway, terrainHeight,
} from './terrain.js';

export const PHASE_TITLE = 'title';
export const PHASE_FLYING = 'flying';
export const PHASE_LANDED = 'landed';
export const PHASE_CRASHED = 'crashed';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASHED = 4;

/** A fresh world: the plane parked at the start of the runway. */
export function createWorld() {
  return {
    phase: PHASE_TITLE,
    time: 0,
    airborne: false, // true once the wheels have left the ground
    // Plane state: metres, radians, m/s.
    x: WORLD.runwayX,
    y: terrainHeight(WORLD.runwayX, 0) + 2,
    z: 40,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    verticalSpeed: 0,
    rings: buildCourse(),
    ringsPassed: 0,
    score: 0,
    lastRingPoints: 0,
    lastRingLabel: '',
    message: '',
    messageUntil: 0,
    crashReason: '',
    landingQuality: 0,
    clouds: buildClouds(),
    peaks: buildPeaks(),
    balloons: buildBalloons(),
    frozen: false,
    best: 0,
  };
}

export function resetWorld(world) {
  const fresh = createWorld();
  fresh.best = world.best;
  Object.assign(world, fresh);
}

/** Distance from the plane to a point, in metres. */
export function distanceTo(world, x, y, z) {
  const dx = x - world.x;
  const dy = y - world.y;
  const dz = z - world.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function nextRing(world) {
  return world.ringsPassed < world.rings.length ? world.rings[world.ringsPassed] : null;
}

function showMessage(world, text, seconds) {
  world.message = text;
  world.messageUntil = world.time + seconds;
}

/**
 * One fixed step of the flight model. `input` is { roll, pitch, throttle }
 * with roll/pitch in [-1, 1] and throttle in [0, 1]. Returns an event mask.
 */
export function stepWorld(world, input, dt = STEP) {
  if (world.phase !== PHASE_FLYING) return EVENT_NONE;
  let events = EVENT_NONE;
  world.time += dt;

  const onGround = world.y <= terrainHeight(world.x, world.z) + 2.05;
  const stalled = world.speed < PLANE.stallSpeed && !onGround;

  // Attitude: bank to turn, pitch to climb and dive. A stalled wing
  // answers the stick weakly and the nose drops on its own.
  const control = stalled ? 0.35 : 1;
  const targetRoll = input.roll * PLANE.maxRoll;
  world.roll += (targetRoll - world.roll) * Math.min(1, 3.2 * dt);
  const pitchTarget = input.pitch * (input.pitch > 0 ? PLANE.maxPitchUp : -PLANE.maxPitchDown);
  world.pitch += (pitchTarget - world.pitch) * Math.min(1, 2.6 * dt);
  if (stalled) world.pitch += (PLANE.maxPitchDown * 0.7 - world.pitch) * Math.min(1, 1.2 * dt);

  world.throttle = input.throttle;
  world.heading += Math.sin(world.roll) * PLANE.turnRate * (world.speed / PLANE.maxSpeed + 0.25) * dt;

  // Speed: thrust fights drag and gravity along the flight path.
  const thrust = world.throttle * PLANE.thrust;
  const drag = PLANE.drag * world.speed * (0.55 + Math.abs(world.pitch) * 0.9);
  const gravityAlongPath = PLANE.gravity * Math.sin(world.pitch);
  world.speed += (thrust - drag - gravityAlongPath) * dt;
  world.speed = Math.max(0, Math.min(PLANE.maxSpeed * 1.08, world.speed));

  // Move along the flight path.
  const prevZ = world.z;
  const cosPitch = Math.cos(world.pitch);
  const vx = Math.sin(world.heading) * cosPitch * world.speed;
  const vy = Math.sin(world.pitch) * world.speed;
  const vz = Math.cos(world.heading) * cosPitch * world.speed;
  const prevY = world.y;
  world.x += vx * dt;
  world.y += vy * dt;
  world.z += vz * dt;
  world.verticalSpeed = (world.y - prevY) / dt;

  // Wheels on the ground: the runway holds the plane down until liftoff.
  if (!world.airborne) {
    world.y = terrainHeight(world.x, world.z) + 2;
    world.verticalSpeed = 0;
  }

  // Drift the clouds slowly down the valley.
  for (const cloud of world.clouds) {
    cloud.z -= cloud.drift * dt;
    if (cloud.z < -100) cloud.z += 5800;
  }

  // Ring crossings: the plane crossed the ring's plane this step.
  const ring = nextRing(world);
  if (ring) {
    const before = prevZ - ring.z;
    const after = world.z - ring.z;
    if (before < 0 && after >= 0) {
      const dy = world.y - ring.y;
      const dx = world.x - ring.x;
      const miss = Math.sqrt(dx * dx + dy * dy);
      if (miss <= ring.radius) {
        const accuracy = 1 - miss / ring.radius;
        const points = SCORE.ringBase + Math.round(SCORE.ringAccuracyBonus * accuracy);
        world.score += points;
        world.ringsPassed += 1;
        world.lastRingPoints = points;
        world.lastRingLabel = `RING ${world.ringsPassed}/${world.rings.length}  +${points}`;
        showMessage(world, world.lastRingLabel, 2.2);
        events |= EVENT_RING;
      } else {
        showMessage(world, `MISSED RING ${world.ringsPassed + 1} — keep flying`, 2.2);
        world.ringsPassed += 1;
        events |= EVENT_RING;
      }
    }
  }

  // Ground contact.
  const ground = terrainHeight(world.x, world.z);
  if (world.y <= ground + 2) {
    world.y = ground + 2;
    if (!world.airborne) {
      // Takeoff roll: the wheels stay on the runway while the plane
      // gathers speed; pull up past 38 m/s and she flies.
      world.verticalSpeed = 0;
      if (world.speed >= 38 && world.pitch > 0.05) world.airborne = true;
      return events;
    }
    const gentle = Math.abs(world.verticalSpeed) < 6 && world.speed < 52 && Math.abs(world.pitch) < 0.2;
    const allRingsDone = world.ringsPassed >= world.rings.length;
    if (onHomeRunway(world.x, world.z) && gentle) {
      return finishLanding(world, events, 'home');
    }
    if (onRunway(world.x, world.z) && gentle && allRingsDone) {
      return finishLanding(world, events, 'runway');
    }
    world.phase = PHASE_CRASHED;
    world.crashReason = world.speed < PLANE.stallSpeed
      ? 'Stalled into the ground — keep your speed up'
      : 'Flew into the terrain — pull up sooner';
    showMessage(world, 'CRASHED', 99);
    return events | EVENT_CRASHED;
  }
  if (world.y > ground + 12) world.airborne = true;

  // Low-altitude warning is rendered, not an event.
  return events;
}

function finishLanding(world, events, which) {
  world.phase = PHASE_LANDED;
  const centre = 1 - Math.min(1, Math.abs(world.x - WORLD.runwayX) / WORLD.runwayHalfWidth);
  const soft = Math.max(0, 1 - Math.abs(world.verticalSpeed) / 6);
  world.landingQuality = Math.round((centre * 0.6 + soft * 0.4) * 100);
  const landingPoints = SCORE.landingBase + Math.round(SCORE.landingCentreBonus * centre);
  world.score += landingPoints;
  const timeBonus = Math.max(0, Math.round((SCORE.parSeconds - world.time) * SCORE.timeBonusPerSecond));
  world.score += timeBonus;
  world.lastRingLabel = `TOUCHDOWN  +${landingPoints}  ·  TIME BONUS +${timeBonus}`;
  showMessage(world, 'TOUCHDOWN!', 99);
  return events | EVENT_LANDED;
}

/** The next-ring guidance: bearing, distance and height difference. */
export function guidance(world) {
  const ring = nextRing(world);
  if (ring) {
    return {
      kind: 'ring',
      label: `RING ${ring.index + 1}`,
      dx: ring.x - world.x,
      dy: ring.y - world.y,
      dz: ring.z - world.z,
      distance: distanceTo(world, ring.x, ring.y, ring.z),
    };
  }
  return {
    kind: 'runway',
    label: 'LAND — HOME RUNWAY',
    dx: WORLD.homeX - world.x,
    dy: 4 - world.y,
    dz: (WORLD.homeZ0 + WORLD.homeZ1) / 2 - world.z,
    distance: distanceTo(world, WORLD.homeX, 4, (WORLD.homeZ0 + WORLD.homeZ1) / 2),
  };
}
