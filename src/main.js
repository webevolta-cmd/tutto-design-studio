import './styles.css';
import { initHero } from './hero.js';
import { initCompare } from './compare.js';
import { initGallery } from './gallery.js';
import { initCopy, initHeader, initHours, initMenu, initReveal, initSectionNav, initServices, initYear } from './ui.js';

const hero = document.querySelector('[data-hero]');
if (hero) initHero(hero);
document.querySelectorAll('[data-compare]').forEach(initCompare);
initHeader(hero);
initMenu();
initSectionNav();
initServices();
initGallery();
initReveal();
initHours();
initCopy();
initYear();
