(function () {
  'use strict';
  const D = window.SORSOLAS;
  const $ = id => document.getElementById(id);
  if (!D || !Array.isArray(D.entries) || !Array.isArray(D.people)) {
    $('go').disabled = true; $('code').disabled = true;
    $('msg').textContent = 'Hiba / Error: data.js could not be loaded. Reload the page. / Töltsd újra az oldalt.';
    $('msg').className = 'msg err';
    return;
  }
  const T = {
    hu: {
      kicker: '// NEON NOËL PROTOKOLL', sub: 'Családi ajándéksorsolás · ',
      barTitle: 'biztonsagos_terminal.exe', label: 'ADD MEG A SZEMÉLYES KÓDODAT', btn: 'TITKOSÍTÁS FELOLDÁSA',
      rLabel: 'CÉLPONT AZONOSÍTVA — TE AJÁNDÉKOT VESZEL NEKI:', hide: 'ELREJTÉS · KÉPERNYŐ TÖRLÉSE',
      wTitle: 'KÍVÁNSÁGLISTÁK', wSub: 'Írd be, mire vágysz! A listákat bárki szerkesztheti, aki megnyitja az oldalt.',
      wPh: 'Új kívánság…', wAdd: 'Hozzáadás', wDel: 'Törlés', wConfirm: 'Biztosan törlöd ezt a kívánságot?', wLoading: 'Betöltés…',
      wLoadErr: 'A kívánságlistákat nem sikerült betölteni. Ellenőrizd az internetkapcsolatot.', wSaveErr: 'Nem sikerült menteni. Próbáld újra.', wFull: 'Egy listán legfeljebb 20 kívánság lehet.',
      foot: 'A kódok titkosak. Ne oszd meg a sajátodat — és ne leskelődj mások után.',
      empty: 'Még nincs kívánság megadva.', hint: n => `Nézd meg lent ${n} kívánságlistáját!`,
      bad: 'HOZZÁFÉRÉS MEGTAGADVA — ismeretlen kód.', ask: 'Adj meg egy kódot.', short: 'A kód 8 karakter hosszú (pl. ABCD-EFGH).',
      work: 'Dekódolás…', ok: 'Hozzáférés engedélyezve.', nocrypto: 'Ez a böngésző nem támogatja a titkosítás feloldását (HTTPS vagy modern böngésző kell).',
      to: 'EN',
    },
    en: {
      kicker: '// NEON NOËL PROTOCOL', sub: 'Family gift draw · ',
      barTitle: 'secure_terminal.exe', label: 'ENTER YOUR PERSONAL CODE', btn: 'DECRYPT',
      rLabel: 'TARGET ACQUIRED — YOU BUY A GIFT FOR:', hide: 'HIDE · CLEAR SCREEN',
      wTitle: 'WISHLISTS', wSub: 'Type in what you wish for! Anyone who opens this page can edit the lists.',
      wPh: 'New wish…', wAdd: 'Add', wDel: 'Delete', wConfirm: 'Really delete this wish?', wLoading: 'Loading…',
      wLoadErr: 'The wishlists could not be loaded. Check your internet connection.', wSaveErr: 'Could not save. Please try again.', wFull: 'A list can hold at most 20 wishes.',
      foot: 'Codes are secret. Don’t share yours — and don’t peek at anyone else’s.',
      empty: 'No wishes added yet.', hint: n => `Scroll down to see ${n}’s wishlist!`,
      bad: 'ACCESS DENIED — unknown code.', ask: 'Please enter a code.', short: 'A code has 8 characters (e.g. ABCD-EFGH).',
      work: 'Decrypting…', ok: 'Access granted.', nocrypto: 'This browser cannot decrypt (HTTPS or a modern browser is required).',
      to: 'HU',
    },
  };
  let lang = 'hu', last = null;
  try { const s = localStorage.getItem('lang'); if (s === 'en' || s === 'hu') lang = s; } catch (e) {}
  const t = k => T[lang][k];

  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const hex = u => Array.from(u, b => b.toString(16).padStart(2, '0')).join('');

  async function decrypt(raw) {
    const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const s = crypto.subtle;
    const base = await s.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await s.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: b64(D.salt), iterations: D.iterations }, base, 384));
    const id = hex(bits.subarray(0, 16));
    const e = D.entries.find(x => x.id === id);
    if (!e) return null;
    const key = await s.importKey('raw', bits.subarray(16, 48), 'AES-GCM', false, ['decrypt']);
    try {
      const pt = await s.decrypt({ name: 'AES-GCM', iv: b64(e.iv) }, key, b64(e.ct));
      return JSON.parse(new TextDecoder().decode(pt));
    } catch (err) { return null; }
  }

  /* ---------- rendering ---------- */
  function setText(el, v) { el.textContent = v; if (el.dataset.text !== undefined) el.dataset.text = v; }

  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.dataset.i18n;
      if (k === 'sub') { el.firstChild.textContent = t('sub'); return; }
      el.textContent = t(k);
    });
    $('lang').textContent = t('to');
    renderWishlists();
    if (last) showResult(last, true);
  }

  /* ---------- wishlists (shared, stored in Firebase) ---------- */
  const DB = 'https://karacsonyi-huzas-3e71c-default-rtdb.europe-west1.firebasedatabase.app';
  const MAX_LEN = 120, MAX_WISHES = 20;
  let wishes = {}, wishState = 'loading'; // name -> [{id, text}]
  const wurl = (name, id) => DB + '/wishlists' + (name ? '/' + encodeURIComponent(name) : '') + (id ? '/' + encodeURIComponent(id) : '') + '.json';
  const wmsg = (text, cls) => { const m = $('wmsg'); m.textContent = text || ''; m.className = 'msg ' + (cls || ''); };

  function renderWishlists() {
    const g = $('wgrid'); g.textContent = '';
    D.people.slice().sort((a, b) => a.name.localeCompare(b.name, lang)).forEach(p => {
      const c = document.createElement('article'); c.className = 'card'; c.dataset.name = p.name;
      const h = document.createElement('h3'); h.textContent = p.name; c.appendChild(h);
      c.appendChild(document.createElement('ul'));
      const f = document.createElement('form'); f.className = 'wform'; f.noValidate = true;
      const inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = MAX_LEN; inp.autocomplete = 'off';
      inp.placeholder = t('wPh'); inp.setAttribute('aria-label', t('wPh') + ' – ' + p.name); inp.setAttribute('enterkeyhint', 'done');
      const b = document.createElement('button'); b.type = 'submit'; b.textContent = '+'; b.setAttribute('aria-label', t('wAdd') + ' – ' + p.name);
      f.appendChild(inp); f.appendChild(b); c.appendChild(f);
      f.addEventListener('submit', e => { e.preventDefault(); addWish(p.name, inp, b); });
      g.appendChild(c);
    });
    fillWishes();
    if (last) markTarget(last.receiver);
  }

  function fillWishes() {
    document.querySelectorAll('.card').forEach(c => {
      const name = c.dataset.name, ul = c.querySelector('ul'); ul.textContent = '';
      const p = D.people.find(x => x.name === name);
      const items = (p.wishlist || []).map(text => ({ text })).concat(wishes[name] || []);
      if (!items.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = t(wishState === 'loading' ? 'wLoading' : 'empty'); ul.appendChild(li); }
      items.forEach(w => {
        const li = document.createElement('li'); const s = document.createElement('span'); s.textContent = w.text; li.appendChild(s);
        if (w.id) {
          const d = document.createElement('button'); d.type = 'button'; d.className = 'del'; d.textContent = '×';
          d.setAttribute('aria-label', t('wDel') + ': ' + w.text);
          d.addEventListener('click', () => delWish(name, w, d));
          li.appendChild(d);
        }
        ul.appendChild(li);
      });
    });
    if (wishState === 'error') wmsg(t('wLoadErr'), 'err'); else if ($('wmsg').classList.contains('err') && $('wmsg').dataset.kind !== 'save') wmsg('');
  }

  async function loadWishes() {
    try {
      const r = await fetch(wurl(), { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = (await r.json()) || {}, next = {};
      Object.keys(j).forEach(name => {
        const o = j[name]; if (!o || typeof o !== 'object') return;
        next[name] = Object.keys(o).sort().filter(id => typeof o[id] === 'string').map(id => ({ id, text: o[id] }));
      });
      wishes = next; wishState = 'ok';
    } catch (err) { wishState = 'error'; }
    fillWishes();
  }

  async function addWish(name, inp, btn) {
    const text = inp.value.replace(/\s+/g, ' ').trim();
    if (!text) { inp.focus(); return; }
    if ((wishes[name] || []).length >= MAX_WISHES) { $('wmsg').dataset.kind = 'save'; wmsg(t('wFull'), 'err'); return; }
    btn.disabled = true;
    try {
      const r = await fetch(wurl(name), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(text.slice(0, MAX_LEN)) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      inp.value = ''; $('wmsg').dataset.kind = ''; wmsg('');
      await loadWishes();
    } catch (err) { $('wmsg').dataset.kind = 'save'; wmsg(t('wSaveErr'), 'err'); }
    btn.disabled = false;
  }

  async function delWish(name, w, btn) {
    if (!window.confirm(t('wConfirm') + '\n\n' + name + ': ' + w.text)) return;
    btn.disabled = true;
    try {
      const r = await fetch(wurl(name, w.id), { method: 'DELETE' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      $('wmsg').dataset.kind = ''; wmsg('');
      await loadWishes();
    } catch (err) { btn.disabled = false; $('wmsg').dataset.kind = 'save'; wmsg(t('wSaveErr'), 'err'); }
  }

  // Keep lists fresh for everyone: reload every 15 s while the page is visible, and when it becomes visible again.
  setInterval(() => { if (!document.hidden) loadWishes(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadWishes(); });

  function markTarget(name) {
    document.querySelectorAll('.card').forEach(c => c.classList.toggle('target', c.dataset.name === name));
  }

  const GLYPHS = '█▓▒░#@$%&*+=?<>/\\ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer = null;
  const stopScramble = () => { if (timer) { clearInterval(timer); timer = null; } };
  function scramble(el, final, done) {
    stopScramble();
    if (reduce) { setText(el, final); done && done(); return; }
    const total = 18; let f = 0;
    const iv = timer = setInterval(() => {
      f++;
      const reveal = Math.floor(final.length * f / total);
      let s = '';
      for (let i = 0; i < final.length; i++)
        s += i < reveal || final[i] === ' ' ? final[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      setText(el, s);
      if (f >= total) { stopScramble(); setText(el, final); done && done(); }
    }, 40);
  }

  function showResult(res, instant) {
    last = res;
    $('result').hidden = false;
    $('rhint').textContent = t('hint')(res.receiver);
    markTarget(res.receiver);
    $('rname').setAttribute('aria-label', res.receiver);
    if (instant) { stopScramble(); setText($('rname'), res.receiver); } else scramble($('rname'), res.receiver);
  }
  function clearResult() {
    stopScramble(); last = null; $('result').hidden = true; $('rname').removeAttribute('aria-label'); setText($('rname'), ' '); markTarget(null);
    $('code').value = ''; $('msg').textContent = ''; $('msg').className = 'msg'; $('code').focus();
  }

  /* ---------- events ---------- */
  const msg = (text, cls) => { const m = $('msg'); m.textContent = text; m.className = 'msg ' + (cls || ''); };

  $('code').addEventListener('input', e => {
    let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
    e.target.value = v;
  });
  let busy = false;
  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    const v = $('code').value.trim();
    if (!v) { msg(t('ask'), 'err'); return; }
    if (v.replace(/[^A-Z0-9]/gi, '').length !== 8) { msg(t('short'), 'err'); return; }
    if (!(window.crypto && crypto.subtle)) { msg(t('nocrypto'), 'err'); return; }
    busy = true; $('go').disabled = true; msg(t('work'));
    let res = null;
    try { res = await decrypt(v); } catch (err) { res = null; }
    busy = false; $('go').disabled = false;
    if (res) { msg(t('ok'), 'ok'); showResult(res); $('result').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    else {
      stopScramble(); last = null; $('result').hidden = true; markTarget(null);
      msg(t('bad'), 'err'); const r = document.querySelector('.row'); r.classList.remove('shake'); void r.offsetWidth; r.classList.add('shake');
    }
  });
  $('hide').addEventListener('click', clearResult);
  $('lang').addEventListener('click', () => {
    lang = lang === 'hu' ? 'en' : 'hu';
    try { localStorage.setItem('lang', lang); } catch (e) {}
    msg(''); applyLang();
  });

  /* ---------- digital snow ---------- */
  (function rain() {
    if (reduce) return;
    const cv = $('rain'), cx = cv.getContext('2d'); let w, h, cols, drops;
    const chars = '*+·0123456789'.split('').concat(['\u2744\uFE0E', '\u2745\uFE0E', '\u2746\uFE0E']);
    let lastW = 0;
    function size() {
      if (innerWidth === lastW && drops) return; lastW = innerWidth;
      w = cv.width = innerWidth; h = cv.height = innerHeight;
      cols = Math.ceil(w / 26); drops = Array.from({ length: cols }, () => Math.random() * -50);
    }
    size(); addEventListener('resize', size);
    setInterval(() => {
      if (document.hidden) return;
      cx.fillStyle = 'rgba(7,6,15,.14)'; cx.fillRect(0, 0, w, h);
      cx.font = '16px "Segoe UI", sans-serif';
      drops.forEach((y, i) => {
        const c = chars[Math.floor(Math.random() * chars.length)];
        cx.fillStyle = Math.random() < .08 ? '#ff2bd6' : '#00f0ff';
        cx.fillText(c, i * 26, y * 20);
        drops[i] = y * 20 > h && Math.random() > .975 ? 0 : y + .5;
      });
    }, 70);
  })();

  $('year').textContent = new Date().getFullYear();
  applyLang();
  loadWishes();
})();
