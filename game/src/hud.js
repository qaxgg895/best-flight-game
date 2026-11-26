// Meridian Ring Run — the instruments and the screens. Everything the
// pilot reads is drawn on the canvas so the screenshots carry it: the
// compass tape, airspeed and altitude tapes, the artificial horizon, the
// throttle, the score, the next-ring guidance and the messages.
import { PLANE } from './config.js';
import { guidance, PHASE_CRASHED, PHASE_FLYING, PHASE_LANDED, PHASE_TITLE } from './physics.js';
import { terrainHeight } from './terrain.js';

const TAU = Math.PI * 2;
const PANEL = 'rgba(10, 16, 28, 0.62)';
const LIT = '#8ef1ff';
const AMBER = '#ffd34d';

function panel(ctx, x, y, w, h, radius = 8) {
  ctx.fillStyle = PANEL;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = 'rgba(142, 241, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function text(ctx, str, x, y, size, colour = '#eaf6ff', align = 'center', weight = '600') {
  ctx.fillStyle = colour;
  ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function headingLabel(deg) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  if (deg % 45 === 0) return names[Math.round(deg / 45) % 8];
  return String(deg).padStart(3, '0');
}

function drawCompass(ctx, world, w) {
  const cx = w / 2;
  const y = 26;
  const headingDeg = ((Math.round((world.heading * 180) / Math.PI) % 360) + 360) % 360;
  panel(ctx, cx - 210, y - 18, 420, 36, 18);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - 210, y - 18, 420, 36, 18);
  ctx.clip();
  const pxPerDeg = 4.2;
  for (let d = -60; d <= 60; d += 5) {
    const deg = ((headingDeg + d) % 360 + 360) % 360;
    const x = cx + d * pxPerDeg;
    const major = deg % 30 === 0;
    ctx.strokeStyle = major ? LIT : 'rgba(234,246,255,0.5)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y + (major ? -12 : -6));
    ctx.lineTo(x, y + 2);
    ctx.stroke();
    if (major) text(ctx, headingLabel(deg), x, y + 10, 11, major ? '#ffffff' : '#cfe8ff');
  }
  ctx.restore();
  // Centre caret and the current heading.
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(cx - 7, y - 18);
  ctx.lineTo(cx + 7, y - 18);
  ctx.lineTo(cx, y - 8);
  ctx.closePath();
  ctx.fill();
  text(ctx, String(headingDeg).padStart(3, '0') + '°', cx, y + 34, 13, AMBER);
}

function tape(ctx, x, y, height, value, unit, format, range, step) {
  panel(ctx, x - 46, y - height / 2, 92, height);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x - 46, y - height / 2, 92, height, 8);
  ctx.clip();
  const pxPerUnit = (height - 30) / range;
  // Tick values aligned to the step grid, so the labelled majors (every
  // second step) always land on a tick instead of between ticks.
  const first = Math.ceil((value - range / 2) / step) * step;
  const last = value + range / 2;
  for (let v = first; v <= last; v += step) {
    if (v < 0) continue;
    const yy = y - (v - value) * pxPerUnit;
    const major = v % (step * 2) === 0;
    ctx.strokeStyle = major ? LIT : 'rgba(234,246,255,0.45)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x - 40, yy);
    ctx.lineTo(x - 28, yy);
    ctx.stroke();
    // Labels hide behind the current-value box at the centre, so skip
    // any that would sit under it.
    if (major && Math.abs(yy - y) > 24) text(ctx, format(v), x + 6, yy, 12, '#eaf6ff', 'left');
  }
  ctx.restore();
  panel(ctx, x - 52, y - 17, 104, 34, 6);
  text(ctx, format(value) + ' ' + unit, x, y, 16, '#ffffff');
}

function drawArtificialHorizon(ctx, world, x, y, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-world.roll);
  // Nose up pushes the horizon bar below the centre, showing more sky.
  const pitchPx = world.pitch * r * 1.6;
  ctx.fillStyle = '#3f7fc9';
  ctx.fillRect(-r, -r, r * 2, r + pitchPx);
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(-r, pitchPx, r * 2, r - pitchPx);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, pitchPx);
  ctx.lineTo(r, pitchPx);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.strokeStyle = LIT;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  // Fixed aircraft symbol.
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y);
  ctx.lineTo(x - r * 0.12, y);
  ctx.moveTo(x + r * 0.12, y);
  ctx.lineTo(x + r * 0.55, y);
  ctx.moveTo(x, y - 3);
  ctx.lineTo(x, y + 3);
  ctx.stroke();
  text(ctx, 'ATT', x, y + r + 12, 10, '#cfe8ff');
}

function drawThrottle(ctx, world, x, y, w) {
  panel(ctx, x, y, w, 54);
  text(ctx, 'THR', x + 34, y + 14, 11, '#cfe8ff', 'left');
  ctx.fillStyle = 'rgba(234,246,255,0.18)';
  ctx.beginPath();
  ctx.roundRect(x + 12, y + 26, w - 24, 12, 6);
  ctx.fill();
  const frac = world.throttle;
  const grad = ctx.createLinearGradient(x + 12, 0, x + w - 12, 0);
  grad.addColorStop(0, '#3fae7a');
  grad.addColorStop(0.7, '#ffd34d');
  grad.addColorStop(1, '#ff6a3d');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x + 12, y + 26, (w - 24) * frac, 12, 6);
  ctx.fill();
  text(ctx, Math.round(frac * 100) + '%', x + w - 14, y + 14, 12, '#ffffff', 'right');
}

function drawGuidance(ctx, world, project, w, h) {
  const g = guidance(world);
  const p = project(g.dx + world.x, g.dy + world.y, g.dz + world.z);
  const label = `${g.label}  ${Math.round(g.distance)}m`;
  if (p && p.x > 40 && p.x < w - 40 && p.y > 90 && p.y < h - 120) {
    // The target is on screen: a diamond marker over it. The label is
    // skipped when the target hides behind the plane itself.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 3;
    ctx.strokeRect(-11, -11, 22, 22);
    ctx.restore();
    const behindPlane = Math.abs(p.x - w / 2) < 80 && Math.abs(p.y - h * 0.60) < 100;
    if (!behindPlane) text(ctx, label, p.x, p.y - 30, 14, AMBER);
    return;
  }
  // Off screen: an arrow on the frame edge, pointing the way.
  const tx = p ? p.x : w / 2;
  const ty = p ? p.y : h / 2;
  const cx = w / 2;
  const cy = h * 0.55;
  const angle = Math.atan2(ty - cy, tx - cx);
  const ex = cx + Math.cos(angle) * (w / 2 - 70);
  const ey = Math.max(100, Math.min(h - 140, cy + Math.sin(angle) * (h / 2 - 90)));
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(angle);
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, label, ex, ey + 28, 13, AMBER);
}

/** The instruments, score and warnings over the world view. */
export function drawHud(ctx, world, w, h, time, project) {
  const knots = Math.round(world.speed * 1.944);
  const feet = Math.round(world.y * 3.281);
  drawCompass(ctx, world, w);
  tape(ctx, 74, h * 0.42, 220, knots, 'KT', (v) => String(Math.round(v)), 100, 10);
  text(ctx, 'AIRSPEED', 74, h * 0.42 - 126, 11, '#cfe8ff');
  tape(ctx, w - 74, h * 0.42, 220, feet, 'FT', (v) => String(Math.round(v)), 500, 100);
  text(ctx, 'ALTITUDE', w - 74, h * 0.42 - 126, 11, '#cfe8ff');
  // Vertical speed under the altitude tape.
  const vs = world.verticalSpeed * 3.281;
  text(ctx, (vs >= 0 ? '+' : '') + Math.round(vs) + ' FT/MIN', w - 74, h * 0.42 + 128, 12, vs < -500 ? '#ff8a6a' : '#cfe8ff');
  drawArtificialHorizon(ctx, world, 96, h - 108, 46);
  drawThrottle(ctx, world, 170, h - 118, 170);
  // Score block, top right.
  panel(ctx, w - 236, 14, 222, 86);
  text(ctx, `SCORE  ${world.score}`, w - 128, 32, 17, '#ffffff');
  text(ctx, `RINGS  ${world.ringsPassed}/${world.rings.length}`, w - 128, 56, 13, LIT);
  const mins = Math.floor(world.time / 60);
  const secs = Math.floor(world.time % 60);
  text(ctx, `TIME  ${mins}:${String(secs).padStart(2, '0')}`, w - 128, 78, 13, '#cfe8ff');
  if (world.phase === PHASE_FLYING) drawGuidance(ctx, world, project, w, h);
  // Warnings.
  const ground = terrainHeight(world.x, world.z);
  const low = world.airborne && world.y - ground < 26 && world.verticalSpeed < 0;
  if (world.speed < 32 && world.airborne && world.phase === PHASE_FLYING) {
    text(ctx, 'STALL — NOSE DOWN, FULL THROTTLE', w / 2, h * 0.30, 20, '#ffb52e');
  } else if (low) {
    const blink = Math.sin(time * 10) > 0;
    if (blink) text(ctx, '⚠ PULL UP ⚠', w / 2, h * 0.30, 22, '#ff6a5e');
  }
  // Centre message (ring pass, touchdown, crash) — only while flying:
  // once the flight is over the end panel carries the news.
  if (world.phase === PHASE_FLYING && world.message && world.time < world.messageUntil) {
    const alpha = Math.min(1, (world.messageUntil - world.time) / 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    text(ctx, world.message, w / 2, h * 0.34, 30, '#ffffff');
    ctx.restore();
  }
  // Controls hint, early in the flight.
  if (world.phase === PHASE_FLYING && world.time < 12) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - world.time / 12);
    text(ctx, '← → bank · ↑ ↓ pitch · W/S throttle · mouse steers · P pause', w / 2, h - 22, 13, '#eaf6ff');
    ctx.restore();
  }
}

function overlay(ctx, w, h, alpha) {
  ctx.fillStyle = `rgba(8, 12, 24, ${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

function centredPanel(ctx, w, h, pw, ph) {
  panel(ctx, (w - pw) / 2, (h - ph) / 2, pw, ph, 16);
}

/** Title screen, drawn over the parked plane on the runway. */
export function drawTitle(ctx, world, w, h, time) {
  overlay(ctx, w, h, 0.38);
  const top = h * 0.15;
  text(ctx, 'MERIDIAN', w / 2, top, 64, '#ffffff');
  text(ctx, 'RING RUN', w / 2, top + 62, 64, AMBER);
  text(ctx, 'A golden-hour flight through the valley — ten rings, one runway home.', w / 2, top + 118, 18, '#eaf6ff');
  if (world.best > 0) text(ctx, `BEST SCORE  ${world.best}`, w / 2, top + 150, 15, LIT);
  const panelH = 210;
  const py = h * 0.60 - panelH / 2;
  panel(ctx, (w - 560) / 2, py, 560, panelH, 16);
  text(ctx, 'HOW TO FLY', w / 2, py + 30, 16, AMBER);
  text(ctx, '← → or A/D  bank and turn      ↑ ↓  pitch', w / 2, py + 66, 15, '#eaf6ff');
  text(ctx, 'W / S  throttle  ·  Mouse drag steers too  ·  Fly through every gold ring', w / 2, py + 94, 15, '#eaf6ff');
  text(ctx, 'Then land gently on the home runway — don\'t stall, don\'t kiss the hills', w / 2, py + 122, 15, '#eaf6ff');
  text(ctx, 'ENTER or CLICK to take off', w / 2, py + 168, 17, '#ffffff');
  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.save();
  ctx.globalAlpha = pulse;
  text(ctx, '▸  PRESS ENTER  ◂', w / 2, h * 0.86, 20, AMBER);
  ctx.restore();
}

/** End-of-flight panel: touchdown or crash, with the score breakdown. */
export function drawEnd(ctx, world, w, h) {
  overlay(ctx, w, h, 0.5);
  const landed = world.phase === PHASE_LANDED;
  centredPanel(ctx, w, h, 600, 300);
  const py = (h - 300) / 2;
  if (landed) {
    text(ctx, 'TOUCHDOWN!', w / 2, py + 40, 40, '#7be495');
    text(ctx, `Landing quality  ${world.landingQuality}%`, w / 2, py + 92, 17, '#eaf6ff');
  } else {
    text(ctx, 'CRASHED', w / 2, py + 40, 40, '#ff6a5e');
    text(ctx, world.crashReason, w / 2, py + 92, 16, '#ffd9d4');
  }
  text(ctx, `Rings flown  ${world.ringsPassed}/${world.rings.length}`, w / 2, py + 130, 17, LIT);
  const mins = Math.floor(world.time / 60);
  const secs = Math.floor(world.time % 60);
  text(ctx, `Flight time  ${mins}:${String(secs).padStart(2, '0')}`, w / 2, py + 158, 16, '#eaf6ff');
  text(ctx, `FINAL SCORE  ${world.score}`, w / 2, py + 200, 24, AMBER);
  if (world.score >= world.best && world.score > 0) {
    text(ctx, '★ NEW BEST SCORE ★', w / 2, py + 232, 16, '#7be495');
  } else if (world.best > 0) {
    text(ctx, `Best  ${world.best}`, w / 2, py + 232, 15, '#cfe8ff');
  }
  text(ctx, 'Press R to fly again', w / 2, py + 268, 15, '#ffffff');
}

/** Pause veil. */
export function drawPaused(ctx, w, h) {
  overlay(ctx, w, h, 0.45);
  text(ctx, 'PAUSED', w / 2, h / 2 - 10, 44, '#ffffff');
  text(ctx, 'Press P to keep flying', w / 2, h / 2 + 34, 16, '#cfe8ff');
}
