// Scroll-linked hero: the visitor's scroll position drives the film frame by frame.
//
// Frames are WebP stills cut from the 4K master by scripts/build_media.py. They load
// progressively (every 16th frame first, then 8th, 4th, 2nd, 1st) so the sequence is
// usable within the first few hundred kilobytes and refines as the rest arrives.
// Only a small window of frames around the current position is kept decoded as
// ImageBitmaps, so drawing never waits on a decode and memory stays bounded.
import meta from './data/hero.json';

const PORTRAIT = '(max-aspect-ratio: 4/5)';
const SMOOTHING_MS = 70; // time constant of the scroll easing; small enough to feel direct
const SMOOTHING_QUALITY = 'medium'; // downscales are at most ~1.5x, where medium matches high visually

const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function loadPlan(count, maxStride) {
  const order = [0, count - 1];
  const seen = new Set(order);
  for (const stride of [16, 8, 4, 2, 1]) {
    if (stride < maxStride) break;
    for (let i = 0; i < count; i += stride) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  return order;
}

function connectionStride(isPortrait) {
  const c = navigator.connection;
  if (c?.saveData || /(^|-)2g|3g/.test(c?.effectiveType || '')) return 4;
  if (!isPortrait) return 1;
  // Phones: every second frame (cross-fading fills the gaps) unless the connection is clearly fast.
  return c?.effectiveType === '4g' && (c.downlink ?? 0) >= 8 ? 1 : 2;
}

class FrameStore {
  constructor(set, onFrame) {
    this.set = set;
    this.count = meta.frames;
    this.onFrame = onFrame;
    this.blobs = new Array(this.count);
    this.bitmaps = new Map();
    this.decoding = new Set();
    this.loaded = [];
    this.aborter = new AbortController();
    this.canBitmap = typeof createImageBitmap === 'function';
    this.images = new Array(this.count);
  }

  url(i) {
    return `media/hero/${this.set}/${String(i).padStart(4, '0')}.webp`;
  }

  start(maxStride) {
    const queue = loadPlan(this.count, maxStride);
    const worker = async () => {
      while (queue.length && !this.aborter.signal.aborted) {
        const i = queue.shift();
        try {
          if (this.canBitmap) {
            const res = await fetch(this.url(i), { signal: this.aborter.signal });
            if (!res.ok) continue;
            this.blobs[i] = await res.blob();
          } else {
            const img = new Image();
            img.src = this.url(i);
            await img.decode();
            this.images[i] = img;
          }
          this.loaded.push(i);
          this.loaded.sort((a, b) => a - b);
          this.onFrame(i);
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }
    };
    for (let n = 0; n < 6; n++) worker();
  }

  stop() {
    this.aborter.abort();
    for (const bmp of this.bitmaps.values()) bmp.close?.();
    this.bitmaps.clear();
  }

  // Nearest frame that has been downloaded.
  nearestLoaded(i) {
    const list = this.loaded;
    if (!list.length) return -1;
    let lo = 0;
    let hi = list.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid] < i) lo = mid + 1;
      else hi = mid;
    }
    const after = list[lo];
    const before = lo > 0 ? list[lo - 1] : after;
    return Math.abs(before - i) <= Math.abs(after - i) ? before : after;
  }

  // Keep decoded bitmaps for frames around `center`; release the rest.
  keepWindow(center, radius) {
    if (!this.canBitmap) return;
    for (const [i, bmp] of this.bitmaps) {
      if (Math.abs(i - center) > radius + 4) {
        bmp.close?.();
        this.bitmaps.delete(i);
      }
    }
    for (let d = 0; d <= radius && this.decoding.size < 3; d++) {
      for (const i of d ? [center + d, center - d] : [center]) {
        if (i < 0 || i >= this.count) continue;
        if (!this.blobs[i] || this.bitmaps.has(i) || this.decoding.has(i)) continue;
        this.decoding.add(i);
        createImageBitmap(this.blobs[i])
          .then((bmp) => {
            this.decoding.delete(i);
            if (this.aborter.signal.aborted) return bmp.close?.();
            this.bitmaps.set(i, bmp);
            this.onFrame(i);
          })
          .catch(() => this.decoding.delete(i));
        if (this.decoding.size >= 3) return;
      }
    }
  }

  // Best drawable source for frame i: the exact frame if ready, else the closest decoded one.
  drawable(i, reach) {
    if (!this.canBitmap) {
      const n = this.nearestLoaded(i);
      return n < 0 ? null : { src: this.images[n], index: n };
    }
    if (this.bitmaps.has(i)) return { src: this.bitmaps.get(i), index: i };
    for (let d = 1; d <= reach; d++) {
      if (this.bitmaps.has(i - d)) return { src: this.bitmaps.get(i - d), index: i - d };
      if (this.bitmaps.has(i + d)) return { src: this.bitmaps.get(i + d), index: i + d };
    }
    return null;
  }
}

export function initHero(root) {
  const canvas = root.querySelector('[data-hero-canvas]');
  const ctx = canvas?.getContext('2d', { alpha: false });
  if (!ctx || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const intro = root.querySelector('[data-hero-intro]');
  const caption = root.querySelector('[data-hero-caption]');
  const statement = root.querySelector('[data-hero-statement]');
  const cue = root.querySelector('[data-hero-cue]');
  const shade = root.querySelector('[data-hero-shade]');
  const bar = root.querySelector('[data-hero-progress]');
  const portraitQuery = matchMedia(PORTRAIT);

  root.classList.add('hero--scrub');

  let store = null;
  let target = 0;
  let current = 0;
  let raf = 0;
  let lastTime = 0;
  let top = 0;
  let length = 1;
  let width = 0;
  let height = 0;
  let drawnKey = '';
  let blurText = true;
  const applied = new WeakMap();

  // Write a style only when its value changes, so idle frames cost no style work.
  const setStyle = (el, prop, value) => {
    let props = applied.get(el);
    if (!props) applied.set(el, (props = new Map()));
    if (props.get(prop) === value) return;
    props.set(prop, value);
    if (prop.startsWith('--')) el.style.setProperty(prop, value);
    else el.style[prop] = value;
  };

  function measure() {
    const rect = root.getBoundingClientRect();
    top = rect.top + window.scrollY;
    length = Math.max(1, root.offsetHeight - window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth * dpr;
    const ch = canvas.clientHeight * dpr;
    // When the screen has more pixels than the frame, keep the canvas at the frame's own
    // resolution (a 1:1 copy per draw) and let the compositor scale it up on the GPU.
    const src = meta.sets[portraitQuery.matches ? 'm' : 'd'];
    const k = Math.min(1, 1 / Math.max(cw / src.width, ch / src.height));
    const w = Math.max(1, Math.round(cw * k));
    const h = Math.max(1, Math.round(ch * k));
    if (w !== width || h !== height) {
      width = canvas.width = w;
      height = canvas.height = h;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = SMOOTHING_QUALITY;
      drawnKey = '';
    }
    blurText = window.innerWidth > 900;
  }

  function useSet() {
    const portrait = portraitQuery.matches;
    const set = portrait ? 'm' : 'd';
    if (store?.set === set) return;
    store?.stop();
    drawnKey = '';
    store = new FrameStore(set, () => schedule());
    store.start(connectionStride(portrait));
  }

  function drawCover(src, alpha) {
    const iw = src.width;
    const ih = src.height;
    const scale = Math.max(width / iw, height / ih);
    const sw = width / scale;
    const sh = height / scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(src, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, width, height);
  }

  // Draw frame `pos` (fractional), cross-fading into the next frame for sub-frame smoothness.
  // When a frame is not decoded yet the closest decoded one stands in; the store calls
  // schedule() as soon as more frames arrive, so no polling loop is needed.
  let lastPos = 0;
  function renderFrame(p) {
    if (!store) return;
    const pos = p * (store.count - 1);
    // Cross-fading only helps slow movement; when the film advances a frame or more per
    // display frame, a single draw is both sharper and cheaper.
    const fast = Math.abs(pos - lastPos) >= 0.9;
    lastPos = pos;
    const i0 = Math.floor(pos);
    const i1 = Math.min(store.count - 1, i0 + 1);
    const t = pos - i0;
    store.keepWindow(Math.round(pos), portraitQuery.matches ? 4 : 6);
    const base = store.drawable(i0, 12);
    if (!base) return;
    const next = !fast && base.index === i0 && t > 0.01 ? store.drawable(i1, 0) : null;
    const key = `${base.index}:${next ? Math.round(t * 48) : 0}`;
    if (key === drawnKey) return;
    drawCover(base.src, 1);
    if (next) drawCover(next.src, t);
    ctx.globalAlpha = 1;
    drawnKey = key;
    if (!root.classList.contains('is-ready')) root.classList.add('is-ready');
  }

  function renderText(p) {
    const out = smooth(0.06, 0.28, p);
    setStyle(intro, 'opacity', (1 - out).toFixed(3));
    setStyle(intro, 'transform', `translate3d(0, ${(-70 * out).toFixed(1)}px, 0)`);
    setStyle(intro, 'filter', blurText && out > 0.01 ? `blur(${(out * 8).toFixed(1)}px)` : 'none');
    setStyle(intro, 'visibility', out > 0.995 ? 'hidden' : 'visible');
    setStyle(cue, 'opacity', (1 - smooth(0, 0.06, p)).toFixed(3));

    const capIn = smooth(0.3, 0.4, p);
    const capOut = smooth(0.6, 0.7, p);
    setStyle(caption, 'opacity', (capIn * (1 - capOut)).toFixed(3));
    setStyle(caption, 'transform', `translate3d(0, ${(24 * (1 - capIn) - 24 * capOut).toFixed(1)}px, 0)`);

    const stIn = smooth(0.72, 0.86, p);
    setStyle(statement, 'opacity', stIn.toFixed(3));
    setStyle(statement, 'transform', `translate3d(-50%, ${(-40 + 14 * (1 - stIn) - 8 * smooth(0.86, 1, p)).toFixed(1)}%, 0)`);
    setStyle(statement, 'filter', blurText && stIn < 0.99 ? `blur(${((1 - stIn) * 4).toFixed(1)}px)` : 'none');

    setStyle(shade, '--fade', (0.5 * smooth(0.88, 1, p)).toFixed(3));
    setStyle(bar, 'transform', `scaleX(${p.toFixed(4)})`);
  }

  function tick(now) {
    raf = 0;
    const dt = lastTime ? Math.min(64, now - lastTime) : 16;
    lastTime = now;
    current += (target - current) * (1 - Math.exp(-dt / SMOOTHING_MS));
    if (Math.abs(target - current) < 0.0002) current = target;
    renderFrame(current);
    renderText(current);
    if (current !== target) raf = requestAnimationFrame(tick);
    else lastTime = 0;
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function onScroll() {
    target = clamp((window.scrollY - top) / length);
    schedule();
  }

  measure();
  useSet();
  target = current = clamp((window.scrollY - top) / length);
  renderText(current);
  schedule();

  window.addEventListener('scroll', onScroll, { passive: true });
  const onResize = () => {
    measure();
    useSet();
    onScroll();
  };
  window.addEventListener('resize', onResize, { passive: true });
  new ResizeObserver(onResize).observe(root);
  portraitQuery.addEventListener?.('change', onResize);
  window.addEventListener('pageshow', onResize);
}
