// Before/after comparison. Both images stay fixed; the "after" layer is revealed with
// clip-path as the divider moves, so nothing is stretched or resized.
//
// Mouse: press anywhere on the image and drag. Touch: drag the handle, or swipe
// sideways on the image; vertical swipes keep scrolling the page (touch-action: pan-y).
// Keyboard: arrow keys move 2%, Shift+arrow or Page Up/Down 10%, Home/End jump to the ends.
const clamp = (v) => Math.min(100, Math.max(0, v));

export function initCompare(root) {
  const stage = root.querySelector('[data-compare-stage]');
  const handle = root.querySelector('[data-compare-handle]');
  if (!stage || !handle) return;

  let pos = 50;
  let queued = null;
  let frame = 0;
  let rect = null;
  let gesture = null;

  function apply(next) {
    pos = clamp(next);
    const rounded = Math.round(pos);
    root.style.setProperty('--pos', `${pos.toFixed(2)}%`);
    handle.setAttribute('aria-valuenow', String(rounded));
    handle.setAttribute('aria-valuetext', `${rounded}% before photo, ${100 - rounded}% after view`);
  }

  function queue(next) {
    queued = next;
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (queued !== null) apply(queued);
        queued = null;
      });
    }
  }

  const fromX = (clientX) => ((clientX - rect.left) / rect.width) * 100;
  const touched = () => root.classList.add('is-touched');

  function begin(e) {
    rect = stage.getBoundingClientRect();
    gesture.active = true;
    root.classList.add('is-dragging');
    touched();
    try {
      stage.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    queue(fromX(e.clientX));
  }

  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const onHandle = handle.contains(e.target);
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false };
    // Mouse and the handle respond at once; a finger on the image waits to see which way it moves.
    if (e.pointerType === 'mouse' || onHandle) {
      if (e.pointerType === 'mouse') e.preventDefault();
      begin(e);
      if (onHandle) handle.focus({ preventScroll: true });
    }
  });

  stage.addEventListener('pointermove', (e) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    if (!gesture.active) {
      const dx = Math.abs(e.clientX - gesture.x);
      const dy = Math.abs(e.clientY - gesture.y);
      if (dx < 6 || dx < dy) return;
      begin(e);
    }
    queue(fromX(e.clientX));
  });

  const end = (e) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    gesture = null;
    root.classList.remove('is-dragging');
  };
  // Not lostpointercapture: touch pointers are captured implicitly, and re-capturing
  // in begin() fires it mid-gesture.
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  handle.addEventListener('keydown', (e) => {
    const big = e.shiftKey ? 10 : 2;
    const moves = {
      ArrowLeft: -big,
      ArrowDown: -big,
      ArrowRight: big,
      ArrowUp: big,
      PageDown: -10,
      PageUp: 10,
    };
    let next = null;
    if (e.key in moves) next = pos + moves[e.key];
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 100;
    if (next === null) return;
    e.preventDefault();
    touched();
    apply(next);
  });

  apply(pos);
}
