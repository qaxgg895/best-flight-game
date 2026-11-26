// Meridian Ring Run — tuning constants. One place for every number the
// flight model, the course and the renderer share, so the game can be
// balanced without hunting through the code.
export const STEP = 1 / 60;

export const WORLD = {
  // The valley the course winds through, in metres.
  seed: 20261126,
  // Runway: a strip along +z at x = 0, from z = -60 to z = 420.
  runwayX: 0,
  runwayZ0: -60,
  runwayZ1: 420,
  runwayHalfWidth: 16,
  // Course: 10 rings, then the landing runway far up the valley.
  ringCount: 10,
  ringSpacing: 430,
  ringFirstZ: 820,
  ringRadius: 20,
  // Final runway, parallel to the first, for the landing.
  homeX: 0,
  homeZ0: 5400,
  homeZ1: 5880,
};

export const PLANE = {
  maxSpeed: 96, // m/s, full throttle in level flight
  minSpeed: 24, // below this the wing stops flying
  stallSpeed: 32, // below this the nose drops and controls go soft
  thrust: 34, // m/s^2 at full throttle
  drag: 0.62, // 1/s: level flight settles near maxSpeed at full throttle
  gravity: 9.8,
  rollRate: 2.4, // rad/s
  pitchRate: 1.5, // rad/s
  maxRoll: 1.15, // rad
  maxPitchUp: 0.55,
  maxPitchDown: -0.5,
  turnRate: 0.9, // heading change per rad of bank, per second
  climbFactor: 1.0,
};

export const SCORE = {
  ringBase: 100,
  ringAccuracyBonus: 80, // scaled by how close to the ring centre
  landingBase: 250,
  landingCentreBonus: 150,
  timeBonusPerSecond: 4, // under the par time
  parSeconds: 150,
  crashPenalty: 0,
};

export const VIEW = {
  fovDegrees: 72,
  chaseDistance: 15, // metres behind the plane
  chaseHeight: 5.2, // metres above the plane
  terrainCell: 55, // metres per terrain quad
  terrainAhead: 950,
  terrainSide: 520,
};

export const SHOT_SEED = 1;
