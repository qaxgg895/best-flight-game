// Meridian Ring Run — the 3D chase view. A small hand-rolled projector
// (yaw / pitch / roll, perspective divide) draws the golden-hour valley:
// sky, sun, snow-capped peaks, a patchwork terrain grid, the river, the
// runways, the glowing rings, drifting clouds, balloons — and the little
// stunt plane itself, banked with the world.
import { VIEW, WORLD } from './config.js';
import { isRiver, riverX, terrainHeight } from './terrain.js';

const TAU = Math.PI * 2;

/** Linear interpolation between two [r, g, b] colours. */
export function mixColour(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function cssColour(c, alpha = 1) {
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

/** Camera trailing the plane, looking down the flight path. */
export function makeCamera(world) {
  const heading = world.heading;
  const pitch = world.pitch * 0.38;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  return {
    x: world.x - fx * VIEW.chaseDistance,
    y: world.y + VIEW.chaseHeight - Math.sin(pitch) * VIEW.chaseDistance,
    z: world.z - fz * VIEW.chaseDistance,
    heading,
    pitch,
    // The camera rolls with the plane, but only part-way: the rest of
    // the bank shows on the plane sprite itself, so the horizon still
    // tilts and the plane still looks like it is banking.
    roll: world.roll * 0.45,
  };
}

function projector(cam, w, h) {
  const f = (h / 2) / Math.tan((VIEW.fovDegrees * Math.PI) / 360);
  const cy = Math.sin(cam.heading);
  const sy = Math.cos(cam.heading);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const cr = Math.cos(cam.roll);
  const sr = Math.sin(cam.roll);
  const cx = w / 2;
  const horizon = h * 0.46;
  return function project(px, py, pz, clampNear = false) {
    let dx = px - cam.x;
    let dy = py - cam.y;
    let dz = pz - cam.z;
    // Yaw: rotate around Y so forward is +z.
    let x1 = dx * sy - dz * cy;
    let z1 = dx * cy + dz * sy;
    let y1 = dy;
    // Pitch: rotate around X.
    const y2 = y1 * cp - z1 * sp;
    let z2 = y1 * sp + z1 * cp;
    // Roll: rotate around Z.
    const x3 = x1 * cr - y2 * sr;
    const y3 = x1 * sr + y2 * cr;
    // Ground close to (or just behind) the camera still has to fill the
    // bottom of the frame: clamp it onto the near plane instead of
    // dropping it, which would leave a hole in the picture.
    if (z2 < 0.6) {
      if (!clampNear) return null;
      z2 = 0.6;
    }
    return {
      x: cx + (x3 / z2) * f,
      y: horizon - (y3 / z2) * f,
      depth: z2,
      scale: f / z2,
    };
  };
}

/** The patchwork colour of one terrain cell, by height and field. */
function cellColour(x, z, ground, haze) {
  let base;
  if (ground > 235) base = [232, 238, 244]; // snow
  else if (ground > 150) base = [122, 106, 90]; // rock
  else {
    // Field patchwork from a cell hash: greens, gold, tilled brown.
    const hash = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    if (hash < 0.30) base = [93, 138, 60];
    else if (hash < 0.55) base = [111, 154, 68];
    else if (hash < 0.72) base = [127, 174, 78];
    else if (hash < 0.86) base = [168, 154, 85];
    else base = [122, 98, 66];
  }
  if (isRiver(x, z)) base = [63, 127, 184];
  return mixColour(base, haze, Math.min(0.75, Math.max(0, (ground - 0) * 0)));
}

function drawTerrain(ctx, project, cam, w, h, time) {
  const haze = [216, 164, 122];
  const cell = VIEW.terrainCell;
  // The grid starts at the camera: rows behind it cannot project (their
  // corners sit on the camera plane and smear across the frame), and the
  // ground a few metres ahead already covers the bottom of the picture.
  const zStart = Math.floor(cam.z / cell) * cell;
  const zEnd = cam.z + VIEW.terrainAhead + 160;
  for (let z = zEnd; z >= zStart; z -= cell) {
    // The grid widens with distance, so the ground still covers the
    // frame's corners out at the horizon.
    const halfWidth = 520 + Math.max(0, z - cam.z) * 0.55;
    const x0 = cam.x - halfWidth;
    const x1 = cam.x + halfWidth;
    const row = [];
    for (let x = x0; x <= x1; x += cell) {
      const gy = terrainHeight(x, z);
      row.push({ p: project(x, gy, z), x, z, gy });
    }
    for (let i = 0; i < row.length - 1; i += 1) {
      const a = row[i];
      const b = row[i + 1];
      if (!a.p || !b.p) continue;
      // The quad is the strip between this row and the one nearer the
      // camera; draw it as a flat-shaded patch with a haze fade.
      const az = a.z;
      const depthFade = Math.min(0.72, Math.max(0, (az - cam.z - 120) / 900));
      let colour = cellColour(a.x + cell / 2, a.z, a.gy, haze);
      colour = mixColour(colour, haze, depthFade);
      const gya = terrainHeight(a.x, z + cell);
      const gyb = terrainHeight(b.x, z + cell);
      const pa = project(a.x, gya, z + cell);
      const pb = project(b.x, gyb, z + cell);
      if (!pa || !pb) continue;
      ctx.fillStyle = cssColour(colour);
      ctx.beginPath();
      ctx.moveTo(a.p.x, a.p.y);
      ctx.lineTo(b.p.x, b.p.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.lineTo(pa.x, pa.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** A runway drawn as its own strip, with edge lines, centreline dashes
 * and threshold bars — the cell grid is too coarse to draw one. */
function drawRunway(ctx, project, centreX, z0, z1) {
  const half = 16;
  const y = 2.5;
  const corners = [
    project(centreX - half, y, z0),
    project(centreX + half, y, z0),
    project(centreX + half, y, z1),
    project(centreX - half, y, z1),
  ];
  if (corners.some((p) => !p)) return;
  const poly = (points, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
  };
  poly(corners, 'rgba(52, 56, 64, 0.96)');
  // Centreline dashes.
  for (let z = z0 + 20; z < z1 - 10; z += 40) {
    const a = project(centreX - 1.6, y, z);
    const b = project(centreX + 1.6, y, z);
    const c = project(centreX + 1.6, y, z + 18);
    const d = project(centreX - 1.6, y, z + 18);
    if (a && b && c && d) poly([a, b, c, d], 'rgba(240, 240, 234, 0.92)');
  }
  // Threshold bars at both ends.
  for (const zt of [z0 + 8, z1 - 14]) {
    const a = project(centreX - 12, y, zt);
    const b = project(centreX + 12, y, zt);
    const c = project(centreX + 12, y, zt + 6);
    const d = project(centreX - 12, y, zt + 6);
    if (a && b && c && d) poly([a, b, c, d], 'rgba(240, 240, 234, 0.85)');
  }
}

function drawPeaks(ctx, project, world) {
  for (const peak of world.peaks) {
    const baseY = terrainHeight(peak.x, peak.z);
    const left = project(peak.x - peak.base / 2, baseY, peak.z);
    const right = project(peak.x + peak.base / 2, baseY, peak.z);
    const top = project(peak.x + peak.base * peak.lean, baseY + peak.height, peak.z);
    if (!left || !right || !top) continue;
    const depthFade = Math.min(0.8, Math.max(0, (peak.z - world.z) / 2600));
    const rock = mixColour([96, 84, 108], [216, 164, 122], depthFade);
    const snow = mixColour([238, 240, 246], [216, 164, 122], depthFade);
    ctx.fillStyle = cssColour(rock);
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(top.x, top.y);
    ctx.closePath();
    ctx.fill();
    // Snow cap: the top quarter of the triangle.
    const capL = { x: left.x + (top.x - left.x) * 0.74, y: left.y + (top.y - left.y) * 0.74 };
    const capR = { x: right.x + (top.x - right.x) * 0.74, y: right.y + (top.y - right.y) * 0.74 };
    ctx.fillStyle = cssColour(snow);
    ctx.beginPath();
    ctx.moveTo(capL.x, capL.y);
    ctx.lineTo(capR.x, capR.y);
    ctx.lineTo(top.x, top.y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawClouds(ctx, project, world, time) {
  ctx.save();
  for (const cloud of world.clouds) {
    const p = project(cloud.x, cloud.y, cloud.z);
    if (!p) continue;
    const r = Math.max(6, cloud.size * p.scale * 0.55);
    if (r < 4) continue;
    const alpha = Math.min(0.9, Math.max(0.25, 340 / p.depth));
    ctx.fillStyle = `rgba(255,246,236,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(p.x - r * 0.55, p.y, r * 0.62, r * 0.34, 0, 0, TAU);
    ctx.ellipse(p.x, p.y - r * 0.18, r * 0.8, r * 0.44, 0, 0, TAU);
    ctx.ellipse(p.x + r * 0.55, p.y, r * 0.6, r * 0.32, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawBalloons(ctx, project, world, time) {
  for (const balloon of world.balloons) {
    const bobY = balloon.y + Math.sin(time * 0.4 + balloon.bob) * 4;
    const p = project(balloon.x, bobY, balloon.z);
    if (!p || p.depth < 30) continue;
    const r = Math.max(3, balloon.radius * p.scale * 0.6);
    ctx.fillStyle = balloon.colour;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - r, r, r * 1.15, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x - r * 0.3, p.y - r * 1.3, r * 0.28, r * 0.42, -0.3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,30,0.8)';
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(p.x - r * 0.6, p.y - r * 0.1);
    ctx.lineTo(p.x - r * 0.3, p.y + r * 0.9);
    ctx.moveTo(p.x + r * 0.6, p.y - r * 0.1);
    ctx.lineTo(p.x + r * 0.3, p.y + r * 0.9);
    ctx.stroke();
    ctx.fillStyle = '#5a3a28';
    ctx.fillRect(p.x - r * 0.32, p.y + r * 0.85, r * 0.64, r * 0.5);
  }
}

function drawRings(ctx, project, world, time) {
  const far = [...world.rings].sort((a, b) => b.z - a.z);
  for (const ring of far) {
    const passed = ring.index < world.ringsPassed;
    const isNext = ring.index === world.ringsPassed;
    const rightX = Math.cos(ring.heading);
    const rightZ = -Math.sin(ring.heading);
    const points = [];
    let visible = true;
    for (let i = 0; i <= 28; i += 1) {
      const t = (i / 28) * TAU;
      const px = ring.x + Math.cos(t) * ring.radius * rightX;
      const py = ring.y + Math.sin(t) * ring.radius;
      const pz = ring.z + Math.cos(t) * ring.radius * rightZ;
      const p = project(px, py, pz);
      if (!p) { visible = false; break; }
      points.push(p);
    }
    if (!visible || points.length < 4) continue;
    const pulse = isNext ? 1 + 0.18 * Math.sin(time * 5) : 1;
    ctx.save();
    ctx.lineJoin = 'round';
    if (isNext) {
      ctx.strokeStyle = '#ffd34d';
      ctx.shadowColor = '#ffb52e';
      ctx.shadowBlur = 22;
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 7 * pulse;
    } else if (passed) {
      ctx.strokeStyle = '#58d68d';
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 4;
    } else {
      ctx.strokeStyle = '#4dd8ff';
      ctx.shadowColor = '#2aa8cc';
      ctx.shadowBlur = 10;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 5;
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.stroke();
    // Inner rim, so the ring reads at a glance even when small.
    ctx.globalAlpha *= 0.7;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

/** The little stunt plane, drawn from behind in screen space: a short,
 * wide fuselage with a canopy, big mid-mounted wings, tailplanes at the
 * tail and a red fin — a jet seen from its chase camera, not a rocket. */
export function drawPlane(ctx, world, w, h, time) {
  const cx = w / 2;
  const cy = h * 0.60 + world.pitch * 60;
  const s = Math.min(w, h) / 800;
  const bank = world.roll * 0.55;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(bank);
  ctx.scale(s, s);
  const flame = world.throttle > 0.15 && world.phase === 'flying';
  // Engine glow spilling from the two nozzles.
  if (flame) {
    const flicker = 0.8 + 0.22 * Math.sin(time * 31) + 0.08 * Math.sin(time * 47);
    const glow = ctx.createRadialGradient(0, 58, 2, 0, 58, 42 * flicker);
    glow.addColorStop(0, 'rgba(255,190,80,0.9)');
    glow.addColorStop(0.5, 'rgba(255,110,40,0.45)');
    glow.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 58, 42 * flicker, 0, TAU);
    ctx.fill();
  }
  // Main wings, mid-mounted and swept slightly back, with orange tips.
  ctx.fillStyle = '#2f6f8f';
  ctx.beginPath();
  ctx.moveTo(-16, -8);
  ctx.lineTo(-128, 26);
  ctx.lineTo(-122, 44);
  ctx.lineTo(-12, 22);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(16, -8);
  ctx.lineTo(128, 26);
  ctx.lineTo(122, 44);
  ctx.lineTo(12, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8862e';
  ctx.beginPath();
  ctx.moveTo(-128, 26);
  ctx.lineTo(-112, 22);
  ctx.lineTo(-108, 39);
  ctx.lineTo(-122, 44);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(128, 26);
  ctx.lineTo(112, 22);
  ctx.lineTo(108, 39);
  ctx.lineTo(122, 44);
  ctx.closePath();
  ctx.fill();
  // Wingtip nav lights: red left, green right, white strobe at the tail.
  const strobe = (time % 1.2) < 0.12;
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath(); ctx.arc(-124, 35, 4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4dff88';
  ctx.beginPath(); ctx.arc(124, 35, 4, 0, TAU); ctx.fill();
  if (strobe) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 72, 5, 0, TAU); ctx.fill();
  }
  // Fuselage: short and wide, nose up-screen, tail at the bottom.
  const body = ctx.createLinearGradient(-18, -62, 18, 62);
  body.addColorStop(0, '#f7f4ec');
  body.addColorStop(0.55, '#e3ddcc');
  body.addColorStop(1, '#b9ac8d');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-9, -62);
  ctx.quadraticCurveTo(-19, -18, -18, 38);
  ctx.quadraticCurveTo(-17, 58, 0, 60);
  ctx.quadraticCurveTo(17, 58, 18, 38);
  ctx.quadraticCurveTo(19, -18, 9, -62);
  ctx.quadraticCurveTo(0, -70, -9, -62);
  ctx.fill();
  // Canopy, seen over the nose from behind and above.
  ctx.fillStyle = '#274b6d';
  ctx.beginPath();
  ctx.ellipse(0, -38, 8, 15, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-3, -44, 2.5, 6, -0.2, 0, TAU);
  ctx.fill();
  // Red cheatlines down the fuselage sides.
  ctx.strokeStyle = '#d2543e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-13, -6);
  ctx.quadraticCurveTo(-15, 20, -14, 44);
  ctx.moveTo(13, -6);
  ctx.quadraticCurveTo(15, 20, 14, 44);
  ctx.stroke();
  // Tail fin rising from the rear fuselage, with the gold sunburst.
  ctx.fillStyle = '#d2543e';
  ctx.beginPath();
  ctx.moveTo(-13, 52);
  ctx.lineTo(-5, 2);
  ctx.lineTo(0, -12);
  ctx.lineTo(5, 2);
  ctx.lineTo(13, 52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath(); ctx.arc(0, 30, 7, 0, TAU); ctx.fill();
  // Horizontal stabilisers at the tail.
  ctx.fillStyle = '#2f6f8f';
  ctx.beginPath();
  ctx.moveTo(-13, 38);
  ctx.lineTo(-56, 58);
  ctx.lineTo(-52, 68);
  ctx.lineTo(-11, 50);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(13, 38);
  ctx.lineTo(56, 58);
  ctx.lineTo(52, 68);
  ctx.lineTo(11, 50);
  ctx.closePath();
  ctx.fill();
  // Twin engine nozzles at the very tail.
  ctx.fillStyle = '#2b2f36';
  ctx.beginPath(); ctx.arc(-9, 56, 7, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(9, 56, 7, 0, TAU); ctx.fill();
  if (flame) {
    ctx.fillStyle = '#ffb52e';
    ctx.beginPath(); ctx.arc(-9, 56, 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(9, 56, 4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/** The whole world frame, without HUD or screens. */
export function drawWorld(ctx, world, w, h, time) {
  const cam = makeCamera(world);
  const project = projector(cam, w, h);
  // Golden-hour sky.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2c3a6e');
  sky.addColorStop(0.42, '#7d6a9e');
  sky.addColorStop(0.62, '#e8825a');
  sky.addColorStop(0.78, '#f6b06a');
  sky.addColorStop(1, '#3a2c22');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // Low sun, right of the flight path.
  const sunX = w * 0.76;
  const sunY = h * 0.30;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 190);
  sunGlow.addColorStop(0, 'rgba(255,236,180,0.95)');
  sunGlow.addColorStop(0.25, 'rgba(255,190,110,0.55)');
  sunGlow.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, TAU);
  ctx.fill();
  // A few high streaks of cloud in the sky itself.
  ctx.fillStyle = 'rgba(255,220,200,0.16)';
  for (let i = 0; i < 5; i += 1) {
    const sx = ((i * 317 + 140) % w);
    const sy = 60 + i * 26;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 70 + i * 16, 5, -0.06, 0, TAU);
    ctx.fill();
  }
  drawPeaks(ctx, project, world);
  drawTerrain(ctx, project, cam, w, h, time);
  // Each runway is clipped to start just ahead of the chase camera:
  // its near end sits behind the camera on takeoff, and a polygon
  // with a corner behind the camera cannot project at all.
  const nearZ = cam.z + 5;
  drawRunway(ctx, project, WORLD.runwayX, Math.max(WORLD.runwayZ0, nearZ), WORLD.runwayZ1);
  drawRunway(ctx, project, WORLD.homeX, Math.max(WORLD.homeZ0, nearZ), WORLD.homeZ1);
  drawClouds(ctx, project, world, time);
  drawRings(ctx, project, world, time);
  drawBalloons(ctx, project, world, time);
  // Warm haze near the horizon, so far ground melts into the sky.
  const hazeBand = ctx.createLinearGradient(0, h * 0.30, 0, h * 0.52);
  hazeBand.addColorStop(0, 'rgba(246,176,106,0)');
  hazeBand.addColorStop(1, 'rgba(246,176,106,0.20)');
  ctx.fillStyle = hazeBand;
  ctx.fillRect(0, h * 0.30, w, h * 0.22);
  drawPlane(ctx, world, w, h, time);
  return { cam, project };
}
