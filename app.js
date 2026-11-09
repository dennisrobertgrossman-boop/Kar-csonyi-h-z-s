(function () {
  'use strict';
  const D = window.SORSOLAS;
  const $ = id => document.getElementById(id);
  const T = {
    hu: {
      kicker: '// NEON NOËL PROTOKOLL', sub: 'Családi ajándéksorsolás · ',
      barTitle: 'biztonsagos_terminal.exe', label: 'ADD MEG A SZEMÉLYES KÓDODAT', btn: 'TITKOSÍTÁS FELOLDÁSA',
      rLabel: 'CÉLPONT AZONOSÍTVA — NEKED AJÁNDÉKOT KELL VENNED', hide: 'ELREJTÉS · KÉPERNYŐ TÖRLÉSE',
      r1: 'Mindenki pontosan egy nevet húz.', r2: 'Mindenkit pontosan egyszer húznak ki.', r3: 'Senki nem húzhatja saját magát.',
      wTitle: 'KÍVÁNSÁGLISTÁK', wSub: 'Nem tudod, mit vegyél? Nézd meg, mire vágyik mindenki.',
      foot: 'A kódok titkosak. Ne oszd meg a sajátodat — és ne leskelődj mások után.',
      empty: 'Még nincs kívánság megadva.', hint: n => `Nézd meg lent ${n} kívánságlistáját!`,
      bad: 'HOZZÁFÉRÉS MEGTAGADVA — ismeretlen kód.', ask: 'Adj meg egy kódot.',
      work: 'Dekódolás…', ok: 'Hozzáférés engedélyezve.', nocrypto: 'Ez a böngésző nem támogatja a titkosítás feloldását (HTTPS vagy modern böngésző kell).',
      to: 'EN',
    },
    en: {
      kicker: '// NEON NOËL PROTOCOL', sub: 'Family gift draw · ',
      barTitle: 'secure_terminal.exe', label: 'ENTER YOUR PERSONAL CODE', btn: 'DECRYPT',
      rLabel: 'TARGET ACQUIRED — YOU BUY A GIFT FOR', hide: 'HIDE · CLEAR SCREEN',
      r1: 'Everyone draws exactly one name.', r2: 'Everyone is drawn exactly once.', r3: 'Nobody draws themselves.',
      wTitle: 'WISHLISTS', wSub: 'Stuck for ideas? Check what everyone is hoping for.',
      foot: 'Codes are secret. Don’t share yours — and don’t peek at anyone else’s.',
      empty: 'No wishes added yet.', hint: n => `Scroll down to see ${n}’s wishlist!`,
      bad: 'ACCESS DENIED — unknown code.', ask: 'Please enter a code.',
      work: 'Decrypting…', ok: 'Access granted.', nocrypto: 'This browser cannot decrypt (HTTPS or a modern browser is required).',
      to: 'HU',
    },
  };
  let lang = 'hu', last = null;
  try { lang = localStorage.getItem('lang') || (/^en/i.test(navigator.language) ? 'en' : 'hu'); } catch (e) {}
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

  function renderWishlists() {
    const g = $('wgrid'); g.textContent = '';
    D.people.slice().sort((a, b) => a.name.localeCompare(b.name, lang)).forEach(p => {
      const c = document.createElement('article'); c.className = 'card'; c.dataset.name = p.name;
      const h = document.createElement('h3'); h.textContent = p.name; c.appendChild(h);
      const ul = document.createElement('ul');
      if (p.wishlist.length) p.wishlist.forEach(w => { const li = document.createElement('li'); li.textContent = w; ul.appendChild(li); });
      else { const li = document.createElement('li'); li.className = 'empty'; li.textContent = t('empty'); ul.appendChild(li); }
      c.appendChild(ul); g.appendChild(c);
    });
    if (last) markTarget(last.receiver);
  }
  function markTarget(name) {
    document.querySelectorAll('.card').forEach(c => c.classList.toggle('target', c.dataset.name === name));
  }

  const GLYPHS = '█▓▒░#@$%&*+=?<>/\\ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function scramble(el, final, done) {
    if (reduce) { setText(el, final); done && done(); return; }
    const total = 28; let f = 0;
    const iv = setInterval(() => {
      f++;
      const reveal = Math.floor(final.length * f / total);
      let s = '';
      for (let i = 0; i < final.length; i++)
        s += i < reveal || final[i] === ' ' ? final[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      setText(el, s);
      if (f >= total) { clearInterval(iv); setText(el, final); done && done(); }
    }, 45);
  }

  function showResult(res, instant) {
    last = res;
    $('result').hidden = false;
    $('rhint').textContent = t('hint')(res.receiver);
    markTarget(res.receiver);
    if (instant) setText($('rname'), res.receiver); else scramble($('rname'), res.receiver);
  }
  function clearResult() {
    last = null; $('result').hidden = true; setText($('rname'), ' '); markTarget(null);
    $('code').value = ''; $('msg').textContent = ''; $('msg').className = 'msg'; $('code').focus();
  }

  /* ---------- events ---------- */
  const msg = (text, cls) => { const m = $('msg'); m.textContent = text; m.className = 'msg ' + (cls || ''); };

  $('code').addEventListener('input', e => {
    let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
    e.target.value = v;
  });
  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    const v = $('code').value.trim();
    if (!v) { msg(t('ask'), 'err'); return; }
    if (!(window.crypto && crypto.subtle)) { msg(t('nocrypto'), 'err'); return; }
    $('go').disabled = true; msg(t('work'));
    let res = null;
    try { res = await decrypt(v); } catch (err) { res = null; }
    $('go').disabled = false;
    if (res) { msg(t('ok'), 'ok'); showResult(res); $('result').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    else {
      last = null; $('result').hidden = true; markTarget(null);
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
    const chars = '❄❅❆*+·0123456789';
    function size() {
      w = cv.width = innerWidth; h = cv.height = innerHeight;
      cols = Math.ceil(w / 26); drops = Array.from({ length: cols }, () => Math.random() * -50);
    }
    size(); addEventListener('resize', size);
    setInterval(() => {
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
})();
