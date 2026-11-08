// Fresh Orbit — customer shop.
import { CATS, DEFAULT_SETTINGS, DEFAULT_PRODUCTS } from './defaults.js';
import { firebase } from './fb.js';

/* ====== state ====== */
let SETTINGS = structuredClone(DEFAULT_SETTINGS);
let PRODUCTS = structuredClone(DEFAULT_PRODUCTS);
let fb = null;

const I18N = {
  en: {
    navShop: 'Shop', navHow: 'How it works', navDelivery: 'Delivery areas',
    heroTitle: 'Today’s <em>catch</em>, at your door.',
    factFrom: () => 'Delivery from ' + rupee(minFee()), factFree: () => 'Free above ' + rupee(SETTINGS.freeAbove),
    ctaShop: 'Shop today’s catch', ctaHow: 'How ordering works', catchDay: 'Catch of the day',
    shopEyebrow: 'The counter', shopTitle: 'Shop fresh', howEyebrow: 'Ordering', howTitle: 'Three steps, no app to install',
    delEyebrow: 'Across Kakinada', delTitle: 'Delivery areas &amp; charges', viewCart: 'View cart'
  },
  te: {
    navShop: 'షాప్', navHow: 'ఎలా ఆర్డర్ చేయాలి', navDelivery: 'డెలివరీ ప్రాంతాలు',
    heroTitle: 'తాజా <em>చేపలు</em>, మీ ఇంటికే.',
    factFrom: () => 'డెలివరీ ' + rupee(minFee()) + ' నుండి', factFree: () => rupee(SETTINGS.freeAbove) + ' పైన ఉచితం',
    ctaShop: 'ఇప్పుడే కొనండి', ctaHow: 'ఎలా ఆర్డర్ చేయాలి', catchDay: 'ఈరోజు ప్రత్యేకం',
    shopEyebrow: 'కౌంటర్', shopTitle: 'తాజాగా కొనండి', howEyebrow: 'ఆర్డర్', howTitle: 'మూడు స్టెప్పులు, యాప్ అవసరం లేదు',
    delEyebrow: 'కాకినాడ అంతటా', delTitle: 'డెలివరీ ప్రాంతాలు &amp; ఛార్జీలు', viewCart: 'Cart చూడండి'
  }
};

const $ = (id) => document.getElementById(id);
const rupee = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const kg = (q) => q < 1 ? Math.round(q * 1000) + ' g' : (Number.isInteger(q) ? q : +q.toFixed(2)) + ' kg';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const minFee = () => SETTINGS.areas.length ? Math.min(...SETTINGS.areas.map((a) => Number(a.fee) || 0)) : 0;
const waDigits = () => String(SETTINGS.whatsapp || '').replace(/\D/g, '');

let lang = 'en', cat = 'all', query = '';
let cart = [];   // {key, id, cut, qty}
let form = { name: '', phone: '', area: '', address: '', slot: '', note: '' };
let view = 'cart';
let lastOrder = null;
try { const s = JSON.parse(localStorage.getItem('fo_cart') || 'null'); if (Array.isArray(s)) cart = s; } catch (e) {}
try { const f = JSON.parse(localStorage.getItem('fo_form') || 'null'); if (f) form = Object.assign(form, f); } catch (e) {}
try { if (localStorage.getItem('fo_lang') === 'te') lang = 'te'; } catch (e) {}
const save = () => { try { localStorage.setItem('fo_cart', JSON.stringify(cart)); localStorage.setItem('fo_form', JSON.stringify(form)); } catch (e) {} };

const prod = (id) => PRODUCTS.find((p) => p.id === id);
const nameP = (p) => lang === 'en' ? p.en : (p.te || p.en);
const nameS = (p) => lang === 'en' ? (p.te || '') : p.en;
const liveCart = () => cart.filter((l) => prod(l.id));
const subtotal = () => liveCart().reduce((s, l) => s + prod(l.id).price * l.qty, 0);
const qtyIn = (id) => cart.filter((l) => l.id === id).reduce((s, l) => s + l.qty, 0);
const outLines = () => liveCart().filter((l) => prod(l.id).inStock === false);
const monoOf = (p) => (p.en || '?').trim().charAt(0).toUpperCase();

const visual = (p) => p.img ? `<img src="${esc(p.img)}" alt="${esc(p.en)}" loading="lazy">` : `<span class="mono" aria-hidden="true">${esc(monoOf(p))}</span>`;
const plus = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const minus = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>';

/* ====== render shop ====== */
function renderCats() {
  $('cats').innerHTML = CATS.map((c) => `<button class="cat" aria-pressed="${c.id === cat}" data-cat="${c.id}"><b class="${lang === 'te' ? 'te' : ''}">${lang === 'en' ? c.en : c.te}</b><span class="${lang === 'en' ? 'te' : ''}">${lang === 'en' ? c.te : c.en}</span></button>`).join('');
}
function renderGroups() {
  const q = query.trim().toLowerCase();
  const match = (p) => !q || [p.en, p.te, p.id].some((s) => String(s || '').toLowerCase().includes(q)) || (q.startsWith('kon') && p.id === 'seer') || (q.startsWith('roy') && p.cat === 'prawn');
  const shown = CATS.filter((c) => c.id !== 'all' && (cat === 'all' || cat === c.id));
  let html = '', total = 0;
  shown.forEach((c) => {
    const items = PRODUCTS.filter((p) => p.cat === c.id && match(p));
    if (!items.length) return;
    total += items.length;
    html += `<div class="group"><div class="group-title"><h3 class="${lang === 'te' ? 'te' : ''}">${lang === 'en' ? c.en : c.te}</h3><span class="${lang === 'en' ? 'te' : ''}">${lang === 'en' ? c.te : c.en}</span><span class="count">${items.length} item${items.length > 1 ? 's' : ''}</span></div><div class="grid">` +
      items.map((p) => {
        const out = p.inStock === false;
        const inq = qtyIn(p.id);
        const action = out
          ? `<button class="add" disabled aria-label="${esc(p.en)} is out of stock">${plus}</button>`
          : inq ? `<button class="in-cart" data-open="${esc(p.id)}" aria-label="${esc(p.en)} in cart, ${kg(inq)}">${kg(inq)} ✓</button>`
          : `<button class="add" data-open="${esc(p.id)}" aria-label="Add ${esc(p.en)}">${plus}</button>`;
        return `<article class="card${out ? ' is-out' : ''}">
          <button class="ph" ${out ? 'disabled' : `data-open="${esc(p.id)}"`} aria-label="${out ? esc(p.en) + ', out of stock' : 'View ' + esc(p.en)}">${visual(p)}${p.best && !out ? '<span class="best">Bestseller</span>' : ''}${out ? '<span class="out">Out of stock</span>' : ''}</button>
          <div class="meta"><b class="${lang === 'te' ? 'te' : ''}">${esc(nameP(p))}</b><span class="${lang === 'en' ? 'te' : ''}" style="font-size:14px;color:var(--muted)">${esc(nameS(p))}</span></div>
          <div class="foot"><span class="price-tag">${rupee(p.price)}<small> /kg</small></span>${action}</div>
        </article>`;
      }).join('') + `</div></div>`;
  });
  $('groups').innerHTML = total ? html : `<div class="empty">No products match “${esc(query)}”. Try “prawns”, “pomfret” or “chicken”.</div>`;
}
function renderSettings() {
  $('areaList').innerHTML = SETTINGS.areas.map((a) => `<div><span>${esc(a.name)}</span><b>${rupee(a.fee)}</b></div>`).join('');
  $('announce').hidden = !SETTINGS.banner;
  $('announceText').textContent = SETTINGS.banner || '';
  $('closedNote').hidden = SETTINGS.open !== false;
  $('factHours').textContent = SETTINGS.hours;
  $('ruleFree').textContent = 'Free delivery above ' + rupee(SETTINGS.freeAbove);
  $('ruleMin').textContent = 'Minimum order ' + rupee(SETTINGS.minOrder);
  $('ruleHours').textContent = 'Open ' + SETTINGS.hours;
  $('ruleSlots').textContent = SETTINGS.slots.length ? 'Slots: ' + SETTINGS.slots.join(' · ') : '';
  const d = waDigits();
  $('waShown').textContent = '+' + d.replace(/^91(\d{5})(\d{5})$/, '91 $1 $2');
}
function renderFeature() {
  const f = PRODUCTS.find((p) => p.featured && p.inStock !== false && (p.hero || p.img)) || PRODUCTS.find((p) => p.inStock !== false && p.hero);
  const card = $('featureCard');
  if (!f) { card.hidden = true; return; }
  card.hidden = false;
  card.dataset.open = f.id;
  card.setAttribute('aria-label', 'View ' + f.en);
  $('featImg').src = f.hero || f.img;
  $('featImg').alt = f.en;
  $('featName').textContent = nameP(f);
  $('featSub').textContent = [nameS(f), f.desc].filter(Boolean).join(' · ');
  $('featPrice').textContent = rupee(f.price);
}
function renderBar() {
  const lines = liveCart(), n = lines.length, s = subtotal();
  $('cartCount').textContent = n;
  $('cartBar').hidden = n === 0 || !$('drawer').hidden || !$('modal').hidden;
  $('barTotal').textContent = rupee(s);
  $('barItems').textContent = n + ' item' + (n === 1 ? '' : 's') + ' · ' + lines.map((l) => prod(l.id).en).slice(0, 2).join(', ') + (n > 2 ? '…' : '');
}
function applyLang() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'te';
  document.querySelectorAll('[data-i]').forEach((el) => {
    const v = I18N[lang][el.dataset.i];
    el.innerHTML = typeof v === 'function' ? esc(v()) : v;
    el.classList.toggle('te', lang === 'te');
  });
  $('langA').textContent = lang === 'en' ? 'EN' : 'తె';
  $('langB').textContent = lang === 'en' ? 'తె' : 'EN';
  $('langA').className = lang === 'te' ? 'te' : '';
  $('langB').className = lang === 'en' ? 'te' : '';
  renderCats(); renderGroups(); renderFeature();
  if (!$('drawer').hidden) renderDrawer();
}
function renderAll() { renderSettings(); applyLang(); renderBar(); }
function greet() {
  const h = new Date().getHours();
  $('greet').textContent = (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ' · Kakinada';
}

/* ====== overlays ====== */
let lastFocus = null;
function openLayer(el) { lastFocus = document.activeElement; $('scrim').hidden = false; el.hidden = false; document.body.style.overflow = 'hidden'; renderBar(); const f = el.querySelector('button:not([hidden])'); f && f.focus(); }
function closeLayers() { $('scrim').hidden = true; $('modal').hidden = true; $('drawer').hidden = true; document.body.style.overflow = ''; renderBar(); lastFocus && lastFocus.focus && lastFocus.focus(); }

let mState = null;
function openProduct(id) {
  const p = prod(id);
  if (!p || p.inStock === false) return;
  const w = p.weights && p.weights.length ? p.weights : [1];
  mState = { id, cut: p.cuts && p.cuts.length ? p.cuts[0] : '', w: p.cat === 'prawn' && p.id !== 'crab' ? 0 : Math.max(0, w.indexOf(1)) };
  $('mImg').innerHTML = p.hero ? `<img src="${esc(p.hero)}" alt="${esc(p.en)}">` : visual(p);
  $('mCat').textContent = (CATS.find((c) => c.id === p.cat) || CATS[0]).en;
  $('mName').textContent = nameP(p); $('mName').className = 'serif' + (lang === 'te' ? ' te' : '');
  $('mTe').textContent = nameS(p); $('mTe').className = lang === 'en' ? 'te' : '';
  $('mPrice').textContent = rupee(p.price);
  $('mDesc').textContent = p.desc || '';
  $('mDesc').hidden = !p.desc;
  $('mCutWrap').hidden = !(p.cuts && p.cuts.length);
  renderModalOpts();
  openLayer($('modal'));
}
function weightsOf(p) { return p.weights && p.weights.length ? p.weights : [1]; }
function renderModalOpts() {
  const p = prod(mState.id), w = weightsOf(p);
  if (p.cuts && p.cuts.length) $('mCuts').innerHTML = p.cuts.map((c) => `<button aria-pressed="${c === mState.cut}" data-cut="${esc(c)}">${esc(c)}</button>`).join('');
  $('mWts').innerHTML = w.map((q, i) => `<button aria-pressed="${i === mState.w}" data-w="${i}"><b>${kg(q)}</b><span>${rupee(q * p.price)}</span></button>`).join('');
  $('mAdd').textContent = 'Add to cart · ' + rupee(w[mState.w] * p.price);
}
function addFromModal() {
  const p = prod(mState.id); if (!p) return closeLayers();
  const qty = weightsOf(p)[mState.w], key = p.id + '|' + mState.cut;
  const ex = cart.find((l) => l.key === key);
  if (ex) ex.qty += qty; else cart.push({ key, id: p.id, cut: mState.cut, qty });
  save(); closeLayers(); renderGroups(); renderBar();
  toast(`${p.en} · ${kg(qty)} added`);
}
let tt;
function toast(msg) { $('toastMsg').textContent = msg; $('toast').hidden = false; clearTimeout(tt); tt = setTimeout(() => { $('toast').hidden = true; }, 2200); }

/* ====== drawer: cart → checkout → sent ====== */
const stepFor = (p) => p.cat === 'prawn' && p.id !== 'crab' ? 0.25 : 0.5;
const areaObj = () => SETTINGS.areas.find((a) => a.name === form.area) || null;
function deliveryCharge() { const a = areaObj(); if (!a) return null; return subtotal() >= SETTINGS.freeAbove ? 0 : Number(a.fee) || 0; }
function summaryHTML(withArea) {
  const s = subtotal(), d = deliveryCharge();
  const dLabel = d === null ? '<span class="k">Choose area at checkout</span>' : d === 0 ? '<b style="color:var(--ok)">Free</b>' : `<b>${rupee(d)}</b>`;
  return `<div class="sum"><div><span class="k">Items (${liveCart().length})</span><b>${rupee(s)}</b></div>
    <div><span class="k">Delivery${withArea && areaObj() ? ' · ' + esc(form.area) : ''}</span>${dLabel}</div>
    <div class="total"><span class="k">Total</span><b>${rupee(s + (d || 0))}</b></div></div>`;
}
function renderDrawer() {
  cart = liveCart();
  const s = subtotal();
  $('dBack').hidden = view === 'cart';
  if (view === 'cart') {
    $('dTitle').textContent = 'Your cart';
    if (!cart.length) {
      $('dBody').innerHTML = `<div class="empty" style="margin-top:20px">Your cart is empty.<br>Add something fresh from the counter.</div>`;
      $('dFoot').innerHTML = `<button class="btn-gold" data-act="close">Browse products</button>`;
      return;
    }
    const left = Math.max(0, SETTINGS.freeAbove - s);
    $('dBody').innerHTML = cart.map((l, i) => {
      const p = prod(l.id), out = p.inStock === false;
      return `<div class="line">
      <div class="th">${visual(p)}</div>
      <div class="info"><div class="row"><div><b class="${lang === 'te' ? 'te' : ''}">${esc(nameP(p))}</b><div class="sub">${esc(l.cut || 'Standard')} · ${rupee(p.price)}/kg</div>${out ? '<div class="sub" style="color:var(--warn);font-weight:700">Out of stock now. Remove to continue.</div>' : ''}</div><b style="color:var(--gold-hi)">${rupee(p.price * l.qty)}</b></div>
      <div class="stepper"><button data-dec="${i}" aria-label="Less ${esc(p.en)}">${minus}</button><span>${kg(l.qty)}</span><button data-inc="${i}" aria-label="More ${esc(p.en)}" ${out ? 'disabled' : ''}>${plus}</button></div></div></div>`;
    }).join('') +
      `<div class="progress"><span>${left > 0 ? 'Add ' + rupee(left) + ' more for free delivery' : 'You’ve unlocked free delivery'}</span><div class="bar"><i style="width:${Math.min(100, s / SETTINGS.freeAbove * 100)}%"></i></div></div>` + summaryHTML(false);
    const short = s < SETTINGS.minOrder, closed = SETTINGS.open === false, outs = outLines().length > 0;
    const why = closed ? 'The shop is not taking orders right now. Please check back later.'
      : outs ? 'Remove out-of-stock items to continue.'
      : short ? `Minimum order is ${rupee(SETTINGS.minOrder)}. Add ${rupee(SETTINGS.minOrder - s)} more.` : '';
    $('dFoot').innerHTML = (why ? `<span class="note" style="color:var(--warn)">${why}</span>` : '') +
      `<button class="btn-gold" data-act="checkout" ${why ? 'disabled' : ''}>Continue to delivery</button>`;
  } else if (view === 'checkout') {
    $('dTitle').textContent = 'Delivery details';
    $('dBody').innerHTML = `<form id="coForm" novalidate style="display:flex;flex-direction:column;gap:18px">
      <label class="field"><span>Name</span><input id="fName" autocomplete="name" maxlength="80" value="${esc(form.name)}" placeholder="Your name"><em class="err" id="eName" hidden>Enter your name.</em></label>
      <label class="field"><span>Phone</span><span class="phone"><b>+91</b><input id="fPhone" type="tel" inputmode="numeric" maxlength="16" autocomplete="tel-national" value="${esc(form.phone)}" placeholder="10-digit mobile"></span><em class="err" id="ePhone" hidden>Enter a 10-digit mobile number.</em></label>
      <div class="field"><span>Area · delivery charge</span><div class="area-pick">${SETTINGS.areas.map((a) => `<button type="button" aria-pressed="${a.name === form.area}" data-area="${esc(a.name)}">${esc(a.name)}<b>${rupee(a.fee)}</b></button>`).join('')}</div><em class="err" id="eArea" hidden>Choose your area.</em></div>
      <label class="field"><span>Address</span><textarea id="fAddr" rows="3" maxlength="400" autocomplete="street-address" placeholder="Door no, street, landmark">${esc(form.address)}</textarea><em class="err" id="eAddr" hidden>Enter your address.</em></label>
      <div class="field"><span>Delivery time</span><div class="seg" style="grid-template-columns:repeat(${Math.min(3, SETTINGS.slots.length) || 1},minmax(0,1fr))">${SETTINGS.slots.map((t) => `<button type="button" aria-pressed="${t === form.slot}" data-slot="${esc(t)}">${esc(t)}</button>`).join('')}</div><em class="err" id="eSlot" hidden>Choose a delivery time.</em></div>
      <label class="field"><span>Note (optional)</span><input id="fNote" maxlength="300" value="${esc(form.note)}" placeholder="e.g. Cut prawns small, call on arrival"></label>
    </form>` + summaryHTML(true);
    $('dFoot').innerHTML = `<button class="btn-wa" data-act="send" ${SETTINGS.open === false ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8.1 19L4 20Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2L9 9.5Z"/></svg>Send order on WhatsApp</button><span class="note">Pay the shop after they call to confirm · <span class="te">కాల్ తర్వాత చెల్లించండి</span></span>`;
  } else {
    const msg = lastOrder ? lastOrder.msg : '';
    $('dTitle').textContent = 'Almost done';
    $('dBody').innerHTML = `<div class="done-ico"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8.1 19L4 20Z"/></svg></div>
      <h3 class="serif" style="font-size:30px;margin:0;line-height:1.1">Send it on WhatsApp</h3>
      <p style="margin:0;color:var(--soft);font-size:14px">WhatsApp opens with your order ready to send. Press send there to place it. If WhatsApp did not open, tap Open WhatsApp below, or copy the message and send it to <b style="user-select:all">${esc($('waShown').textContent)}</b>.</p>
      <div class="msgbox" id="msgBox">${esc(msg)}</div>`;
    $('dFoot').innerHTML = `<a class="btn-wa" href="${waLink(msg)}" target="_blank" rel="noopener">Open WhatsApp</a><button class="btn-ghost" style="justify-content:center;width:100%" data-act="copy">Copy order message</button><button class="btn-ghost" style="justify-content:center;width:100%;border:0;height:44px" data-act="new">Start a new order</button>`;
  }
}
function readForm() {
  const v = (id) => ($(id) ? $(id).value : null);
  if (v('fName') !== null) form.name = v('fName').trim();
  if (v('fPhone') !== null) form.phone = v('fPhone').replace(/\D/g, '');
  if (v('fAddr') !== null) form.address = v('fAddr').trim();
  if (v('fNote') !== null) form.note = v('fNote').trim();
  save();
}
function validate() {
  readForm();
  const errs = { eName: !form.name, ePhone: !/^[6-9]\d{9}$/.test(form.phone), eArea: !areaObj(), eAddr: !form.address, eSlot: !SETTINGS.slots.includes(form.slot) };
  let first = null;
  Object.entries(errs).forEach(([k, bad]) => { $(k).hidden = !bad; if (bad && !first) first = $(k); });
  if (first) first.parentElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return !first;
}
function buildOrder() {
  const s = subtotal(), d = deliveryCharge() || 0;
  const items = liveCart().map((l) => { const p = prod(l.id); return { id: p.id, en: p.en, te: p.te || '', qty: l.qty, cut: l.cut || '', price: p.price, amount: Math.round(p.price * l.qty) }; });
  const lines = items.map((it) => `• ${it.en}${it.te ? ' (' + it.te + ')' : ''} — ${kg(it.qty)}${it.cut ? ', ' + it.cut : ''} — ${rupee(it.amount)}`);
  const msg = `New order — Fresh Orbit\n\n${lines.join('\n')}\n\nItems: ${rupee(s)}\nDelivery (${form.area}): ${d ? rupee(d) : 'Free'}\nTotal: ${rupee(s + d)}\n\nName: ${form.name}\nPhone: +91 ${form.phone}\nAddress: ${form.address}, ${form.area}\nTime: ${form.slot}${form.note ? '\nNote: ' + form.note : ''}`;
  return { items, subtotal: Math.round(s), delivery: d, total: Math.round(s + d), msg };
}
const waLink = (msg) => 'https://wa.me/' + waDigits() + '?text=' + encodeURIComponent(msg);

async function saveOrder(o) {
  try {
    if (!fb) return;
    const { fs, db } = fb;
    await fs.addDoc(fs.collection(db, 'orders'), {
      items: o.items, subtotal: o.subtotal, delivery: o.delivery, total: o.total,
      name: form.name, phone: form.phone, area: form.area, address: form.address,
      slot: form.slot, note: form.note || '', status: 'new', createdAt: fs.serverTimestamp()
    });
  } catch (e) {
    console.warn('Order not saved to the shop inbox; WhatsApp message still sent.', e);
  }
}

/* ====== events ====== */
document.addEventListener('click', (e) => {
  const t = e.target.closest('button,a'); if (!t || t.disabled) return;
  if (t.dataset.cat) { cat = t.dataset.cat; renderCats(); renderGroups(); return; }
  if (t.dataset.open) { openProduct(t.dataset.open); return; }
  if (t.dataset.cut) { mState.cut = t.dataset.cut; renderModalOpts(); return; }
  if (t.dataset.w) { mState.w = +t.dataset.w; renderModalOpts(); return; }
  if (t.dataset.inc || t.dataset.dec) {
    const i = +(t.dataset.inc || t.dataset.dec), l = cart[i]; if (!l) return;
    const st = stepFor(prod(l.id));
    if (t.dataset.inc) l.qty += st; else { l.qty -= st; if (l.qty <= 0.001) cart.splice(i, 1); }
    save(); renderDrawer(); renderGroups(); renderBar(); return;
  }
  if (t.dataset.area) { readForm(); form.area = t.dataset.area; save(); renderDrawer(); return; }
  if (t.dataset.slot) { readForm(); form.slot = t.dataset.slot; save(); renderDrawer(); return; }
  const act = t.dataset.act;
  if (act === 'close') return closeLayers();
  if (act === 'checkout') { view = 'checkout'; renderDrawer(); $('dBody').scrollTop = 0; return; }
  if (act === 'send') {
    if (SETTINGS.open === false || !validate()) return;
    lastOrder = buildOrder();
    // Open WhatsApp inside the tap so browsers allow it; save to the inbox in the background.
    window.open(waLink(lastOrder.msg), '_blank', 'noopener');
    saveOrder(lastOrder);
    view = 'sent'; renderDrawer(); return;
  }
  if (act === 'copy') {
    const msg = lastOrder ? lastOrder.msg : '';
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($('msgBox')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Message selected. Copy it.'); };
    try { navigator.clipboard.writeText(msg).then(() => toast('Order message copied'), fallback); } catch (err) { fallback(); }
    return;
  }
  if (act === 'new') { cart = []; lastOrder = null; save(); view = 'cart'; closeLayers(); renderGroups(); renderBar(); return; }
});
$('cartBtn').onclick = $('cartBar').onclick = () => { view = 'cart'; renderDrawer(); openLayer($('drawer')); };
$('dClose').onclick = $('mClose').onclick = $('scrim').onclick = closeLayers;
$('dBack').onclick = () => { readForm(); view = view === 'sent' ? 'checkout' : 'cart'; renderDrawer(); };
$('mAdd').onclick = addFromModal;
$('langBtn').onclick = () => { lang = lang === 'en' ? 'te' : 'en'; try { localStorage.setItem('fo_lang', lang); } catch (e) {} applyLang(); };
$('q').addEventListener('input', (e) => { query = e.target.value; renderGroups(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('scrim').hidden) closeLayers(); });
document.addEventListener('input', (e) => { if (e.target.id === 'fPhone') { const d = e.target.value.replace(/\D/g, ''); e.target.value = d.length > 10 ? (/^(91|0)/.test(d) ? d.slice(-10) : d.slice(0, 10)) : d; } });

/* ====== boot ====== */
greet();
renderAll();

(async () => {
  fb = await firebase();
  if (!fb) return;
  const { fs, db } = fb;
  fs.onSnapshot(fs.doc(db, 'shop', 'settings'), (snap) => {
    if (snap.exists()) {
      SETTINGS = { ...DEFAULT_SETTINGS, ...snap.data() };
      if (!Array.isArray(SETTINGS.areas)) SETTINGS.areas = [];
      if (!Array.isArray(SETTINGS.slots)) SETTINGS.slots = [];
      renderAll();
      if (!$('drawer').hidden) renderDrawer();
    }
  }, (e) => console.warn('Settings unavailable', e));
  fs.onSnapshot(fs.query(fs.collection(db, 'products'), fs.orderBy('order')), (snap) => {
    if (snap.empty) return; // keep the built-in catalogue until the owner loads one
    PRODUCTS = snap.docs.map((d) => ({ cuts: [], weights: [1], ...d.data(), id: d.id }));
    renderAll();
    if (!$('drawer').hidden) renderDrawer();
  }, (e) => console.warn('Products unavailable', e));
})();
