/**
 * Rimette le sezioni della pagina nell'ordine deciso dal portale.
 *
 * Ogni sezione porta con sé la treccia che la segue, così i separatori
 * restano uno fra l'altro anche quando una sezione viene spostata o
 * nascosta. Le sezioni che il portale non conosce non si toccano:
 * restano dove le ha messe il markup, in coda a quelle ordinate.
 */

const SECTION = '[data-section]';

/** La treccia che segue una sezione, se c'è. */
const plaitOf = (node) =>
  (node.nextElementSibling?.classList.contains('plait') ? node.nextElementSibling : null);

/**
 * Mostra o nasconde una sezione e il suo separatore.
 * `hidden` e non una classe: così la sezione sparisce anche dalla
 * ricerca nella pagina e dalla lettura assistita.
 */
export function setSectionVisible(node, visible) {
  if (!node) return;
  node.hidden = !visible;
  const plait = plaitOf(node);
  if (plait) plait.hidden = !visible;
}

/**
 * @param {Array<{key: string, published: boolean}>|null} sections
 *        null quando il database non ha ancora la tabella: in quel caso
 *        la pagina resta esattamente com'è.
 */
export function applySectionOrder(sections) {
  if (!Array.isArray(sections) || !sections.length) return;

  const nodes = new Map();
  for (const node of document.querySelectorAll(SECTION)) {
    nodes.set(node.dataset.section, node);
  }
  if (!nodes.size) return;

  // Si parte dalla prima sezione in pagina: tutto quello che viene prima
  // (intestazione, prima treccia) non si muove.
  const first = document.querySelector(SECTION);
  let anchor = first.previousElementSibling;
  if (!anchor) return;

  for (const { key, published } of sections) {
    const node = nodes.get(key);
    if (!node) continue;                 // chiave senza sezione in pagina

    const plait = plaitOf(node);
    setSectionVisible(node, published !== false);

    anchor.after(node);
    if (plait) node.after(plait);
    anchor = plait ?? node;
  }
}
