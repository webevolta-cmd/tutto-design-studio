// Page chrome: header state, mobile menu, section highlighting, services imagery,
// reveal-on-scroll, opening-hours status and the copy-phone button.

export function initHeader(hero) {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const heroEnd = hero ? hero.offsetTop + hero.offsetHeight - window.innerHeight : 0;
    // Transparent over the film so the hero stays immersive; solid once the page content begins.
    header.classList.toggle('is-solid', y > Math.max(80, heroEnd - 8));
    // Inside the hero the header stays put; further down it steps aside while reading down.
    const hide = y > heroEnd + window.innerHeight && y > lastY + 4 && !document.documentElement.classList.contains('menu-open');
    if (y < lastY - 4 || y <= heroEnd + window.innerHeight) header.classList.remove('is-hidden');
    else if (hide) header.classList.add('is-hidden');
    lastY = y;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  update();
}

export function initMenu() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  if (!toggle || !menu) return;
  const root = document.documentElement;
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.menu-toggle__label').textContent = open ? 'Close' : 'Menu';
    menu.hidden = !open;
    root.classList.toggle('menu-open', open);
    root.classList.toggle('has-dialog', open);
    if (open) document.querySelector('[data-header]')?.classList.add('is-solid');
    else window.dispatchEvent(new Event('scroll'));
    if (open) menu.querySelector('a')?.focus();
  };
  toggle.addEventListener('click', () => setOpen(menu.hidden));
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  matchMedia('(min-width: 1081px)').addEventListener?.('change', (e) => {
    if (e.matches) setOpen(false);
  });
}

export function initSectionNav() {
  const links = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const sections = [...map.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  if (!('IntersectionObserver' in window) || !sections.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a) => a.removeAttribute('aria-current'));
        map.get(entry.target.id)?.setAttribute('aria-current', 'true');
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  sections.forEach((s) => io.observe(s));
}

export function initServices() {
  const items = [...document.querySelectorAll('[data-service]')];
  const frame = document.querySelector('[data-service-frame]');
  const caption = document.querySelector('[data-service-caption]');
  if (!items.length || !frame) return;
  const imgs = [...frame.querySelectorAll('[data-service-img]')];
  const activate = (item) => {
    items.forEach((el) => el.classList.toggle('is-active', el === item));
    const key = item.dataset.service;
    imgs.forEach((img) => img.classList.toggle('is-active', img.dataset.serviceImg === key));
    if (caption) caption.textContent = item.dataset.caption || '';
  };
  activate(items[0]);
  items.forEach((item) => {
    item.addEventListener('pointerenter', () => activate(item));
    item.addEventListener('focusin', () => activate(item));
  });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && activate(e.target)),
      { rootMargin: '-48% 0px -48% 0px' },
    );
    items.forEach((item) => io.observe(item));
  }
}

export function initReveal() {
  const els = [...document.querySelectorAll('[data-reveal]')];
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.remove('is-pending');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  const fold = window.innerHeight;
  for (const el of els) {
    // Only content below the fold animates in; anything already visible stays as it is.
    if (el.getBoundingClientRect().top > fold) {
      el.classList.add('is-pending');
      io.observe(el);
    }
  }
}

export function initHours() {
  const status = document.querySelector('[data-open-status]');
  if (!status) return;
  // Yerevan is UTC+4 all year (no daylight saving).
  const now = new Date();
  const yerevan = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 4 * 3600000);
  const day = yerevan.getDay();
  const minutes = yerevan.getHours() * 60 + yerevan.getMinutes();
  const open = day >= 1 && day <= 5 && minutes >= 9 * 60 && minutes < 18 * 60;
  status.textContent = open ? 'Open now' : 'Closed now';
  status.classList.add(open ? 'is-open' : 'is-closed');
  document.querySelector(`.hours tr[data-day="${day}"]`)?.classList.add('is-today');
}

export function initCopy() {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      const label = btn.textContent;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied';
      } catch {
        const target = btn.previousElementSibling;
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        btn.textContent = 'Selected';
      }
      setTimeout(() => (btn.textContent = label), 2000);
    });
  });
}

export function initYear() {
  const el = document.querySelector('[data-year]');
  if (el) el.textContent = String(new Date().getFullYear());
}
