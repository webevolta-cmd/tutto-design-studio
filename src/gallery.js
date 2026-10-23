// Project galleries: one native <dialog>, filled from each project's data-gallery list.
import images from './data/images.json';

function srcset(id) {
  const info = images[id];
  if (!info) return null;
  const set = info.variants.map((v) => `${v.src} ${v.w}w`).join(', ');
  const largest = info.variants[info.variants.length - 1];
  return { set, src: largest.src, w: largest.w, h: largest.h };
}

export function initGallery() {
  const dialog = document.querySelector('[data-gallery-dialog]');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const track = dialog.querySelector('[data-gallery-track]');
  const title = dialog.querySelector('[data-gallery-title]');
  const count = dialog.querySelector('[data-gallery-count]');
  const prev = dialog.querySelector('[data-gallery-prev]');
  const next = dialog.querySelector('[data-gallery-next]');
  let slides = [];
  let index = 0;
  let opener = null;

  function update() {
    count.textContent = slides.length ? `${index + 1} / ${slides.length}` : '';
    prev.disabled = index <= 0;
    next.disabled = index >= slides.length - 1;
  }

  function go(i, behavior = 'smooth') {
    index = Math.max(0, Math.min(slides.length - 1, i));
    const slide = slides[index];
    if (slide) track.scrollTo({ left: slide.offsetLeft - track.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft), behavior });
    update();
  }

  function open(project, startAt = 0, trigger = null) {
    let list = [];
    try {
      list = JSON.parse(project.dataset.gallery || '[]');
    } catch {
      return;
    }
    opener = trigger;
    title.textContent = project.querySelector('.project__title')?.textContent || '';
    track.replaceChildren(
      ...list.map(([id, cap], n) => {
        const img = srcset(id);
        const fig = document.createElement('figure');
        fig.className = 'gallery__slide';
        if (img) {
          const el = document.createElement('img');
          el.src = img.src;
          el.srcset = img.set;
          el.sizes = '100vw';
          el.width = img.w;
          el.height = img.h;
          el.alt = `${title.textContent}: ${cap}. Design visualization by Tutto.`;
          el.decoding = 'async';
          el.loading = Math.abs(n - startAt) <= 1 ? 'eager' : 'lazy';
          fig.append(el);
        }
        const fc = document.createElement('figcaption');
        fc.className = 'mono';
        fc.textContent = cap;
        fig.append(fc);
        return fig;
      }),
    );
    slides = [...track.children];
    dialog.showModal();
    document.documentElement.classList.add('has-dialog');
    requestAnimationFrame(() => go(startAt, 'instant'));
    dialog.querySelector('[data-gallery-close]').focus();
  }

  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('has-dialog');
    track.replaceChildren();
    slides = [];
    opener?.focus({ preventScroll: true });
  });
  dialog.querySelector('[data-gallery-close]').addEventListener('click', () => dialog.close());
  prev.addEventListener('click', () => go(index - 1));
  next.addEventListener('click', () => go(index + 1));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    }
  });

  let settle = 0;
  track.addEventListener(
    'scroll',
    () => {
      cancelAnimationFrame(settle);
      settle = requestAnimationFrame(() => {
        const w = track.clientWidth || 1;
        const i = Math.round(track.scrollLeft / (slides[1] ? slides[1].offsetLeft - slides[0].offsetLeft : w));
        if (i !== index) {
          index = Math.max(0, Math.min(slides.length - 1, i));
          update();
        }
      });
    },
    { passive: true },
  );

  document.querySelectorAll('[data-project]').forEach((project) => {
    project.querySelectorAll('.project__media, [data-project-open]').forEach((btn) => {
      btn.addEventListener('click', () => open(project, 0, btn));
    });
  });

  document.querySelectorAll('[data-open-project]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const project = document.querySelector(`[data-project="${link.dataset.openProject}"]`);
      if (!project) return;
      e.preventDefault();
      const list = JSON.parse(project.dataset.gallery || '[]');
      const start = list.findIndex(([id]) => id === Number(link.dataset.openImage));
      open(project, Math.max(0, start), link);
    });
  });
}
