// Deterministic randomness for Meridian Ring Run. Everything the game
// generates — the valley, the ring course, the clouds — comes from a
// seeded generator, so the same seed always builds the same valley and
// the screenshot scenes always stage the same frame.

/** mulberry32: a small, fast seeded PRNG. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic 2D value-noise field in [0, 1). */
export function makeNoise2D(seed) {
  const perm = new Uint8Array(512);
  const rng = makeRng(seed);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) base[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = base[i];
    base[i] = base[j];
    base[j] = tmp;
  }
  for (let i = 0; i < 512; i += 1) perm[i] = base[i & 255];

  function hash(ix, iz) {
    return perm[(perm[ix & 255] + iz) & 255] / 255;
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  return function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const a = hash(ix, iz);
    const b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1);
    const d = hash(ix + 1, iz + 1);
    const ux = smooth(fx);
    const uz = smooth(fz);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  };
}

/** Pick a deterministic element from an array. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
