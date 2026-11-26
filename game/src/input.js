// Meridian Ring Run — keyboard and mouse. Arrows (or A/D) bank, Up/Down
// (or W/S) pitch and throttle, and dragging the mouse steers the plane
// toward the pointer, so the game plays with either hand.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    // Mouse steering: null when the pointer is not steering.
    mouse: null,
    // One-shot actions the main loop consumes each frame.
    pressed: new Set(),
    /** True while the key is held. */
    down(code) {
      return this.keys.has(code);
    },
    /** True once, on the frame the key went down. */
    wasPressed(code) {
      return this.pressed.has(code);
    },
    /** The main loop calls this after each frame. */
    endFrame() {
      this.pressed.clear();
    },
  };

  const GAME_KEYS = [
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'Enter', 'KeyR', 'KeyP', 'KeyM',
  ];

  window.addEventListener('keydown', (event) => {
    if (GAME_KEYS.includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      input.keys.add(event.code);
      input.pressed.add(event.code);
    }
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouse = null;
  });

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    input.mouse = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (input.mouse) input.mouse = { x: event.clientX, y: event.clientY };
  });
  const releaseMouse = () => { input.mouse = null; };
  canvas.addEventListener('pointerup', releaseMouse);
  canvas.addEventListener('pointercancel', releaseMouse);

  return input;
}

/**
 * Turn the raw input into the flight model's { roll, pitch, throttle }.
 * Keyboard and mouse blend: the mouse sets a target bank and pitch from
 * where the pointer sits relative to the screen centre, the keys add to
 * it, and the throttle keys nudge the throttle up or down.
 */
export function readFlightInput(input, canvas, throttle, dt) {
  let roll = 0;
  let pitch = 0;
  if (input.down('ArrowLeft') || input.down('KeyA')) roll -= 1;
  if (input.down('ArrowRight') || input.down('KeyD')) roll += 1;
  if (input.down('ArrowUp')) pitch += 1;
  if (input.down('ArrowDown')) pitch -= 1;
  if (input.mouse) {
    const rect = canvas.getBoundingClientRect();
    const nx = (input.mouse.x - rect.left) / rect.width - 0.5;
    const ny = (input.mouse.y - rect.top) / rect.height - 0.5;
    roll += Math.max(-1, Math.min(1, nx * 2.4));
    pitch -= Math.max(-1, Math.min(1, ny * 2.0));
  }
  let nextThrottle = throttle;
  if (input.down('KeyW')) nextThrottle += 0.9 * dt;
  if (input.down('KeyS')) nextThrottle -= 0.9 * dt;
  if (input.down('ShiftLeft') || input.down('ShiftRight')) nextThrottle += 0.9 * dt;
  if (input.down('ControlLeft') || input.down('ControlRight')) nextThrottle -= 0.9 * dt;
  return {
    roll: Math.max(-1, Math.min(1, roll)),
    pitch: Math.max(-1, Math.min(1, pitch)),
    throttle: Math.max(0, Math.min(1, nextThrottle)),
  };
}
