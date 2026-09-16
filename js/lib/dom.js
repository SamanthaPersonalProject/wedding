/** Utility DOM minime, senza framework. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Crea un elemento.
 * @param {string} tag
 * @param {Object} [attrs] - proprietà; `class`, `dataset`, `on*` gestiti a parte
 * @param {Array<Node|string>|string} [children]
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node && key !== 'list') {
      node[key] = value;
    } else {
      node.setAttribute(key, value);
    }
  }

  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Svuota un contenitore e vi inserisce i nodi passati. */
export function render(container, ...nodes) {
  container.replaceChildren(...nodes.flat().filter(Boolean));
  return container;
}

/** Riferimento a un simbolo dello sprite SVG. */
export function icon(id, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}

/** Messaggio temporaneo in basso a destra. */
export function toast(message, tone = 'info') {
  let host = $('.toast-host');
  if (!host) {
    host = el('div', { class: 'toast-host' });
    document.body.append(host);
  }
  const node = el('div', { class: `toast toast--${tone}`, role: 'status' }, message);
  host.append(node);
  setTimeout(() => node.remove(), 4200);
}

/**
 * Modale accessibile. Risolve con il valore passato a `close(value)`.
 * @param {{title: string, body: Node, actions?: (close: Function) => Node[]}} options
 */
export function modal({ title, body, actions }) {
  return new Promise((resolve) => {
    const close = (value) => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      previouslyFocused?.focus?.();
      resolve(value);
    };

    const onKey = (event) => {
      if (event.key === 'Escape') close(undefined);
    };

    const previouslyFocused = document.activeElement;

    const panel = el('div', { class: 'modal__panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      el('div', { class: 'modal__head' }, [
        el('h3', { class: 'card__title' }, title),
        el('button', { class: 'modal__close', type: 'button', 'aria-label': 'Chiudi', onClick: () => close(undefined) }, '×'),
      ]),
      body,
      el('div', { class: 'modal__foot' }, actions ? actions(close) : [
        el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => close(undefined) }, 'Chiudi'),
      ]),
    ]);

    const overlay = el('div', {
      class: 'modal',
      onClick: (event) => { if (event.target === overlay) close(undefined); },
    }, panel);

    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    panel.querySelector('input, select, textarea, button')?.focus();
  });
}

/** Conferma sì/no con la stessa estetica delle modali. */
export function confirmDialog(title, message, confirmLabel = 'Conferma') {
  return modal({
    title,
    body: el('p', {}, message),
    actions: (close) => [
      el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => close(false) }, 'Annulla'),
      el('button', { class: 'btn btn--danger btn--sm', type: 'button', onClick: () => close(true) }, confirmLabel),
    ],
  });
}

/** Legge un form in oggetto piano, con i campi vuoti a stringa vuota. */
export function formValues(form) {
  const data = {};
  for (const [key, value] of new FormData(form).entries()) {
    data[key] = typeof value === 'string' ? value.trim() : value;
  }
  return data;
}
