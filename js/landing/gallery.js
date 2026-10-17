/**
 * Il piccolo slider dentro "La nostra storia".
 *
 * Niente scorrimento automatico: si cambia foto con le frecce, con i
 * pallini, con le frecce della tastiera o trascinando il dito. Le foto
 * stanno dove stanno — qui arrivano solo gli indirizzi salvati dal
 * portale.
 */

import { el, render } from '../lib/dom.js';

export function renderGallery(container, photos) {
  // null = il database non ha la tabella: resta la foto fissa in pagina.
  if (!container || !Array.isArray(photos) || !photos.length) return;

  let current = 0;

  const slides = photos.map((photo, index) => el('figure', {
    class: 'slider__slide',
    'aria-hidden': String(index !== 0),
  }, [
    el('img', {
      class: 'storia__img',
      src: photo.url,
      alt: photo.caption || '',
      loading: index === 0 ? 'eager' : 'lazy',
      decoding: 'async',
    }),
    photo.caption ? el('figcaption', { class: 'slider__caption' }, photo.caption) : null,
  ]));

  const dots = photos.map((photo, index) => el('button', {
    class: 'slider__dot',
    type: 'button',
    'aria-label': `Foto ${index + 1} di ${photos.length}${photo.caption ? `: ${photo.caption}` : ''}`,
    'aria-current': String(index === 0),
    onClick: () => show(index),
  }));

  const track = el('div', { class: 'slider__track' }, slides);

  function show(index) {
    current = (index + photos.length) % photos.length;
    track.style.transform = `translateX(-${current * 100}%)`;

    slides.forEach((slide, i) => slide.setAttribute('aria-hidden', String(i !== current)));
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === current)));
    status.textContent = `Foto ${current + 1} di ${photos.length}`;
  }

  // Annuncio per chi non vede il cambio: fuori schermo ma letto ad alta voce.
  const status = el('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' },
    `Foto 1 di ${photos.length}`);

  const arrow = (delta, symbol, label) => el('button', {
    class: `slider__arrow slider__arrow--${delta < 0 ? 'prev' : 'next'}`,
    type: 'button',
    'aria-label': label,
    onClick: () => show(current + delta),
  }, symbol);

  const viewport = el('div', {
    class: 'slider__viewport',
    onKeydown: (event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
    },
  }, track);

  // Trascinamento col dito: si cambia foto solo se il gesto è
  // chiaramente orizzontale, altrimenti resta lo scorrimento normale.
  let startX = null;
  let startY = null;

  viewport.addEventListener('touchstart', (event) => {
    startX = event.changedTouches[0].clientX;
    startY = event.changedTouches[0].clientY;
  }, { passive: true });

  viewport.addEventListener('touchend', (event) => {
    if (startX === null) return;
    const dx = event.changedTouches[0].clientX - startX;
    const dy = event.changedTouches[0].clientY - startY;
    startX = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) show(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  const single = photos.length === 1;

  render(container,
    el('div', {
      class: `slider${single ? ' slider--single' : ''}`,
      tabindex: single ? null : '0',
      role: 'group',
      'aria-roledescription': 'carosello',
      'aria-label': 'Le nostre foto',
    }, [
      viewport,
      single ? null : arrow(-1, '‹', 'Foto precedente'),
      single ? null : arrow(1, '›', 'Foto successiva'),
    ]),
    single ? null : el('div', { class: 'slider__dots' }, dots),
    status);

  // Il contenitore in pagina è una <figure>: con lo slider dentro non ha
  // più senso che resti tale, e la cornice la disegna lo slider.
  container.classList.remove('storia__figure');
  container.classList.add('storia__gallery');
}
