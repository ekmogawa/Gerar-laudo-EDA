// ============================================================
// dnd_eda.js — Drag & Drop (Pointer Events)
// Reordena itens dentro das sortable-zones e dispara auto-save ao soltar.
// Depende de: core_eda.js (_SECOES, agendarAutoSave)
// ============================================================

function inicializarSortable() {
  _SECOES.forEach(function (s) {
    let zone = document.getElementById(s.sortable);
    if (zone) ativarZona(zone);
  });
}

function ativarZona(zone) {
  zone.querySelectorAll('.item').forEach(ativarItem);
  if (zone.getAttribute('data-zone-init')) return;
  zone.setAttribute('data-zone-init', '1');
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType === 1 && n.classList.contains('item')) ativarItem(n);
      });
    });
  }).observe(zone, { childList: true });
}

function ativarItem(item) {
  if (item.getAttribute('data-sep') === '1') return;
  if (item.getAttribute('data-drag-init')) return;
  item.setAttribute('data-drag-init', '1');

  let wasDragged = false;

  item.addEventListener('click', function (e) {
    if (e.target.matches('input[type=checkbox], button, select')) return;
    if (wasDragged) { wasDragged = false; return; }
    let cb = item.querySelector('input[type=checkbox]');
    if (cb) {
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  item.addEventListener('pointerdown', function (e) {
    if (e.target.matches('input[type=checkbox], button, select')) return;
    if (e.button !== 0) return;

    item.setPointerCapture(e.pointerId);

    let zone       = item.closest('.sortable-zone');
    let rect       = item.getBoundingClientRect();
    let offX       = e.clientX - rect.left;
    let offY       = e.clientY - rect.top;
    let moved      = false;
    let ghost      = null;
    let ph         = null;
    let lastTarget = undefined;

    function startDrag() {
      moved = true; wasDragged = true;
      ph = document.createElement('div');
      ph.className = 'item';
      ph.setAttribute('data-ph', '1');
      ph.style.cssText =
        `width:${rect.width}px;height:${rect.height}px;` +
        'border:2px dashed var(--accent);background:var(--accent-l);' +
        'border-radius:6px;pointer-events:none;flex-shrink:0;';
      zone.insertBefore(ph, item);
      item.style.display = 'none';

      ghost = item.cloneNode(true);
      ghost.style.cssText =
        `position:fixed;z-index:9999;pointer-events:none;width:${rect.width}px;` +
        'opacity:.88;box-shadow:0 8px 24px rgba(0,0,0,.22);' +
        'transform:rotate(1.5deg) scale(1.03);' +
        `left:${e.clientX - offX}px;top:${e.clientY - offY}px;`;
      document.body.appendChild(ghost);
    }

    function onMove(ev) {
      let dx = ev.clientX - (rect.left + offX);
      let dy = ev.clientY - (rect.top  + offY);
      if (!moved) {
        if (Math.sqrt(dx * dx + dy * dy) < 5) return;
        startDrag();
      }
      ghost.style.left = (ev.clientX - offX) + 'px';
      ghost.style.top  = (ev.clientY - offY) + 'px';

      ghost.style.visibility = 'hidden';
      let elUnder = document.elementFromPoint(ev.clientX, ev.clientY);
      ghost.style.visibility = '';
      let targetZone = elUnder ? elUnder.closest('.sortable-zone') : null;
      if (!targetZone) targetZone = zone;

      if (ph.parentElement !== targetZone) { targetZone.appendChild(ph); lastTarget = undefined; }
      let after = getAfterElement(targetZone, ev.clientX, ev.clientY, ph);
      let key   = after || null;
      if (key === lastTarget) return;
      lastTarget = key;
      after ? targetZone.insertBefore(ph, after) : targetZone.appendChild(ph);
    }

    function onUp() {
      item.removeEventListener('pointermove',   onMove);
      item.removeEventListener('pointerup',     onUp);
      item.removeEventListener('pointercancel', onUp);
      if (moved) {
        if (ph && ph.parentElement) ph.parentElement.insertBefore(item, ph);
        if (ph)    ph.remove();
        if (ghost) ghost.remove();
        item.style.display = '';
        agendarAutoSave();
      }
    }

    item.addEventListener('pointermove',   onMove);
    item.addEventListener('pointerup',     onUp);
    item.addEventListener('pointercancel', onUp);
  });
}

function getAfterElement(zone, x, y, exclude) {
  let items = Array.from(zone.querySelectorAll('.item')).filter(function (el) {
    return el !== exclude && !el.getAttribute('data-ph') && el.getAttribute('data-sep') !== '1';
  });

  let rows = [];
  items.forEach(function (el) {
    let r    = el.getBoundingClientRect();
    let rowY = Math.round(r.top / 8) * 8;
    let row  = rows.find(function (rw) { return rw.y === rowY; });
    if (!row) { row = { y: rowY, bottom: r.bottom, els: [] }; rows.push(row); }
    row.bottom = Math.max(row.bottom, r.bottom);
    row.els.push({ el: el, midX: r.left + r.width / 2 });
  });
  rows.sort(function (a, b) { return a.y - b.y; });
  if (!rows.length) return null;

  let targetRow = null;
  for (let i = 0; i < rows.length; i++) {
    if (y <= rows[i].bottom) { targetRow = rows[i]; break; }
  }
  if (!targetRow) return null;
  let sorted = targetRow.els.slice().sort(function (a, b) { return a.midX - b.midX; });
  for (let j = 0; j < sorted.length; j++) {
    if (x < sorted[j].midX) return sorted[j].el;
  }
  let ri = rows.indexOf(targetRow);
  if (ri < rows.length - 1) {
    let next = rows[ri + 1].els.slice().sort(function (a, b) { return a.midX - b.midX; });
    return next[0].el;
  }
  return null;
}

// ----------------------------------------------------------
// VERIFICAÇÃO DE DEPENDÊNCIAS
// ----------------------------------------------------------
if (typeof _SECOES === 'undefined') {
  console.error('[dnd_eda] ERRO: _SECOES nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof agendarAutoSave === 'undefined') {
  console.error('[dnd_eda] ERRO: agendarAutoSave nao encontrado — core_eda.js precisa ser carregado antes');
}
console.log('[dnd_eda] Modulo carregado, dependencias OK');
