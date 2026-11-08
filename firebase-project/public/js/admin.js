// Fresh Orbit — owner dashboard.
import { CATS, DEFAULT_SETTINGS, DEFAULT_PRODUCTS } from './defaults.js';
import { firebase } from './fb.js';
import { firebaseConfig } from './firebase-config.js';

// The main owner can always manage the shop and cannot be removed.
// Keep this the same as mainOwner() in firestore.rules.
const MAIN_OWNER = 'mosasiva6@gmail.com';

const $ = (id) => document.getElementById(id);
const rupee = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const kg = (q) => q < 1 ? Math.round(q * 1000) + ' g' : (Number.isInteger(q) ? q : +Number(q).toFixed(2)) + ' kg';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

let fb = null;
let tab = 'orders';
let orders = [], ordersLoaded = false, orderFilter = 'new', orderSearch = '', payingUpi = '';
let seenOrderIds = null;   // ids from earlier snapshots, null until the first one (for the new-order beep)
let products = [], productsLoaded = false, productsError = null;
let settings = null, settingsDraft = null, settingsDirty = false, settingsLoaded = false, settingsError = null;
let editing = null;        // product id being edited, or '__new'
let draft = null;          // product draft in the editor
let confirmDelete = false;
let admins = [], adminsLoaded = false, myEmail = '', removingAdmin = '';
const unsubs = [];
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isUpi = (s) => /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(s);
const DEFAULT_UPI = '8498857618@ybl';
const TITLE = 'Fresh Orbit Owner';
// Money typed by the owner: "25.50" -> 26, "1,700" -> 1700, junk -> 0.
const money = (v) => { const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? Math.round(n) : 0; };

let tt;
function toast(msg, isErr) {
  $('toastMsg').textContent = msg;
  $('toast').classList.toggle('err', !!isErr);
  $('toast').hidden = false;
  clearTimeout(tt); tt = setTimeout(() => { $('toast').hidden = true; }, Math.max(isErr ? 4200 : 2200, String(msg).length * 55));
}
function failMsg(e) {
  return e && e.code === 'permission-denied'
    ? 'Not allowed. This email is not on the admin list, or the latest firestore.rules are not published.'
    : 'Could not save. Check your internet connection and try again.';
}

/* ====== auth ====== */
async function boot() {
  fb = await firebase();
  if (!fb) { $('setupNote').hidden = false; return; }
  const { authMod, auth } = fb;
  authMod.onAuthStateChanged(auth, async (user) => {
    unsubs.splice(0).forEach((u) => u());
    resetUserState();
    $('notAdmin').hidden = true; $('verify').hidden = true;
    if (user) {
      myEmail = String(user.email || '').toLowerCase();
      $('login').hidden = true; $('signOut').hidden = false;
      await checkAccess(user);
    } else {
      myEmail = '';
      $('login').hidden = false; $('app').hidden = true; $('signOut').hidden = true;
    }
  });
  $('notAdminOut').onclick = () => authMod.signOut(auth);
  $('verifyOut').onclick = () => authMod.signOut(auth);
  $('verifySend').onclick = async () => {
    const user = auth.currentUser, b = $('verifySend'); if (!user) return;
    b.disabled = true; $('verifyMsg').textContent = '';
    try { await authMod.sendEmailVerification(user); toast('Verification email sent to ' + (user.email || 'your email') + '. Check the spam folder too.'); }
    catch (e) {
      console.warn(e);
      $('verifyMsg').textContent = e && e.code === 'auth/too-many-requests'
        ? 'Too many emails were sent. Wait a few minutes, then check your inbox and spam folder.'
        : 'Could not send the email. Check your internet connection and try again.';
    }
    b.disabled = false;
  };
  $('verifyDone').onclick = async () => {
    const user = auth.currentUser, b = $('verifyDone'); if (!user) return;
    b.disabled = true; $('verifyMsg').textContent = '';
    try { await user.reload(); await user.getIdToken(true); }
    catch (e) { console.warn(e); $('verifyMsg').textContent = 'Could not check. Check your internet connection and try again.'; b.disabled = false; return; }
    b.disabled = false;
    if (auth.currentUser !== user) return;
    if (!user.emailVerified) { $('verifyMsg').textContent = 'This email is not verified yet. Click the link in the email, then press this button again.'; return; }
    await checkAccess(user);
  };
  $('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('lEmail').value.trim(), pass = $('lPass').value;
    if (!email || !pass) { $('lErr').textContent = 'Enter your email and password.'; return; }
    $('lErr').textContent = ''; $('lBtn').disabled = true; $('lBtn').textContent = 'Signing in…';
    try { await authMod.signInWithEmailAndPassword(auth, email, pass); $('lPass').value = ''; }
    catch (err) {
      $('lErr').textContent = /invalid|wrong|user-not-found|credential/.test(err.code || '') ? 'Email or password is incorrect.'
        : err.code === 'auth/too-many-requests' ? 'Too many attempts. Wait a few minutes and try again.'
        : 'Could not sign in. Check your internet connection.';
    }
    $('lBtn').disabled = false; $('lBtn').textContent = 'Sign in';
  });
  $('signOut').onclick = () => authMod.signOut(auth);
}

// Everything that belongs to one signed-in person. Cleared on every sign-in / sign-out.
function resetUserState() {
  orders = []; products = []; settings = null; admins = [];
  ordersLoaded = productsLoaded = adminsLoaded = settingsLoaded = false;
  productsError = settingsError = null; seenOrderIds = null;
  settingsDraft = null; settingsDirty = false;
  editing = null; draft = null; confirmDelete = false; removingAdmin = '';
  orderFilter = 'new'; tab = 'orders'; orderSearch = ''; payingUpi = '';
  if ($('pane-orders')) $('pane-orders').innerHTML = '';
  document.title = TITLE;
}

// Decides what a signed-in person sees: verify-email screen, "Not an admin", or the dashboard.
async function checkAccess(user) {
  const { auth } = fb;
  unsubs.splice(0).forEach((u) => u());
  $('notAdmin').hidden = true; $('verify').hidden = true; $('app').hidden = true;
  // Admins other than the main owner must have a verified email (firestore.rules checks email_verified).
  if (myEmail !== MAIN_OWNER && !user.emailVerified) {
    $('verifyEmail').textContent = user.email || 'this account';
    $('verifyMsg').textContent = '';
    $('verify').hidden = false;
    return;
  }
  // Only admins can read the admin list, so this tells us whether this login may manage the shop.
  try {
    await fb.fs.getDoc(fb.fs.doc(fb.db, 'admins', 'list'));
  } catch (e) {
    if (e && e.code === 'permission-denied') {
      if (auth.currentUser !== user) return;
      $('notAdminEmail').textContent = user.email || 'this account';
      $('notAdmin').hidden = false; $('app').hidden = true;
      return;
    }
    console.warn(e); // network trouble: carry on, the panes show their own errors
  }
  if (auth.currentUser !== user) return;
  $('app').hidden = false;
  subscribe();
  render();
}

/* ====== new-order alert ====== */
let audioCtx = null;
function audio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}
// Browsers only allow sound after the page was touched, so wake the audio on the first tap.
document.addEventListener('pointerdown', () => { try { audio(); } catch (e) { /* no sound */ } }, { once: true });
function beep() {
  try {
    const ctx = audio(); if (!ctx) return;
    const t0 = ctx.currentTime;
    [0, 0.25].forEach((d) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = d ? 1175 : 880;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.2);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0 + d); o.stop(t0 + d + 0.22);
    });
  } catch (e) { /* sound blocked until the page is clicked */ }
}

function subscribe() {
  const { fs, db } = fb;
  unsubs.push(fs.onSnapshot(fs.query(fs.collection(db, 'orders'), fs.orderBy('createdAt', 'desc'), fs.limit(200)), (snap) => {
    orders = snap.docs.map((d) => ({ ...d.data(), id: d.id })); ordersLoaded = true;
    // Beep for a new order that arrived after the page loaded (not for the first snapshot).
    if (seenOrderIds) {
      if (orders.some((o) => o.status === 'new' && !seenOrderIds.has(o.id))) beep();
    } else seenOrderIds = new Set();
    orders.forEach((o) => seenOrderIds.add(o.id));
    if (tab === 'orders') renderOrders(); renderBadge();
  }, (e) => { ordersLoaded = true; orders = []; console.warn(e); if (tab === 'orders') renderOrders(e); renderBadge(); }));
  unsubs.push(fs.onSnapshot(fs.query(fs.collection(db, 'products'), fs.orderBy('order')), (snap) => {
    products = snap.docs.map((d) => ({ cuts: [], weights: [1], ...d.data(), id: d.id })); productsLoaded = true; productsError = null;
    if (editing && editing !== '__new' && !products.some((p) => p.id === editing)) {
      editing = null; draft = null; confirmDelete = false;
      toast('This product was deleted by another admin.', true);
    }
    if (tab === 'products') { if ($('pEditor') && draft) readEditor(); renderProducts(); }
  }, (e) => { productsLoaded = true; productsError = e; console.warn(e); if (tab === 'products') renderProducts(); }));
  unsubs.push(fs.onSnapshot(fs.doc(db, 'shop', 'settings'), (snap) => {
    settings = snap.exists() ? { ...structuredClone(DEFAULT_SETTINGS), ...snap.data() } : null;
    settingsLoaded = true; settingsError = null;
    if (!settingsDirty) settingsDraft = structuredClone(settings || DEFAULT_SETTINGS);
    if (tab === 'delivery' && !settingsDirty) renderDelivery();
  }, (e) => { settingsLoaded = true; settingsError = e; console.warn(e); if (tab === 'delivery') renderDelivery(); }));
  unsubs.push(fs.onSnapshot(fs.doc(db, 'admins', 'list'), (snap) => {
    admins = snap.exists() && Array.isArray(snap.data().emails) ? snap.data().emails : [];
    adminsLoaded = true;
    if (tab === 'admins') renderAdmins();
  }, (e) => { adminsLoaded = true; console.warn(e); if (tab === 'admins') renderAdmins(e); }));
}

/* ====== tabs ====== */
function render() {
  document.querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  ['orders', 'products', 'delivery', 'admins'].forEach((t) => { $('pane-' + t).hidden = t !== tab; });
  if (tab === 'orders') renderOrders();
  if (tab === 'products') renderProducts();
  if (tab === 'delivery') renderDelivery();
  if (tab === 'admins') renderAdmins();
}
function renderBadge() {
  const n = orders.filter((o) => o.status === 'new').length;
  $('newCount').hidden = n === 0; $('newCount').textContent = n;
  document.title = n ? `(${n}) ${TITLE}` : TITLE;
}

/* ====== orders ====== */
const STATUS = ['new', 'confirmed', 'delivered', 'cancelled'];
function fmtTime(ts) {
  const d = ts && ts.toDate ? ts.toDate() : null;
  if (!d) return 'Just now';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
// Search matches the order code, phone, name or UTR. While searching, all orders are searched (filters are ignored).
const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s-]/g, '');
function matchesSearch(o, q) {
  return [o.ref, o.phone, o.name, o.utr].some((v) => norm(v).includes(q));
}
function renderOrders(err) {
  const pane = $('pane-orders');
  // The search box is created once and kept, so typing is never interrupted when new orders arrive.
  if (!$('oSearch')) {
    pane.innerHTML = `<div id="oHead"></div>
      <label class="search-box"><span class="sr">Search orders</span><input id="oSearch" type="search" autocomplete="off" placeholder="Search code (FO-…), phone, name or UTR" value="${esc(orderSearch)}"></label>
      <div id="oBody"></div>`;
  }
  const head = $('oHead'), body = $('oBody');
  if (err) { head.innerHTML = ''; body.innerHTML = `<div class="notice">${esc(failMsg(err).replace('Could not save', 'Could not load orders'))}</div>`; return; }
  if (!ordersLoaded) { head.innerHTML = ''; body.innerHTML = '<div class="notice">Loading orders…</div>'; return; }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todays = orders.filter((o) => o.createdAt && o.createdAt.toDate && o.createdAt.toDate() >= today && o.status !== 'cancelled');
  const counts = Object.fromEntries(STATUS.map((s) => [s, orders.filter((o) => o.status === s).length]));
  counts.unpaid = orders.filter(isUnpaid).length;
  const collected = orders.filter((o) => isPaid(o) && paidToday(o, today)).reduce((s, o) => s + (o.total || 0), 0);
  const q = norm(orderSearch);
  const list = q ? orders.filter((o) => matchesSearch(o, q))
    : orderFilter === 'all' ? orders : orderFilter === 'unpaid' ? orders.filter(isUnpaid) : orders.filter((o) => o.status === orderFilter);
  // Keep a half-typed UTR when the list redraws.
  const utrTyped = $('utrIn') ? $('utrIn').value : '';
  head.innerHTML = `
    <div class="stats">
      <div class="stat"><b>${counts.new}</b><span>New orders</span></div>
      <div class="stat"><b>${todays.length}</b><span>Orders today</span></div>
      <div class="stat"><b>${rupee(todays.reduce((s, o) => s + (o.total || 0), 0))}</b><span>Value today</span></div>
      <div class="stat"><b>${rupee(collected)}</b><span>Collected today</span></div>
    </div>
    <div class="chips" role="group" aria-label="Filter orders">
      ${['new', 'confirmed', 'delivered', 'unpaid', 'cancelled', 'all'].map((s) => `<button class="chip" aria-pressed="${!q && s === orderFilter}" data-ofilter="${s}">${s[0].toUpperCase() + s.slice(1)}${s !== 'all' ? ' · ' + counts[s] : ''}</button>`).join('')}
    </div>`;
  body.innerHTML = (q ? `<p class="search-note">${list.length} order${list.length === 1 ? '' : 's'} found for “${esc(orderSearch.trim())}” · <button type="button" class="linkish" data-act="clearsearch">Clear search</button></p>` : '')
    + (list.length ? list.map(orderCard).join('') : `<div class="notice">${q ? 'No order matches. Only the latest 200 orders are searched.' : orderFilter === 'new' ? 'No new orders. New WhatsApp orders from the website appear here.' : orderFilter === 'unpaid' ? 'No unpaid orders.' : 'No orders in this list.'}</div>`);
  if (utrTyped && $('utrIn')) $('utrIn').value = utrTyped;
}
/* payments: payStatus is 'unpaid' | 'paid_upi' | 'paid_cash' (missing = unpaid); payMethod is 'upi' | 'cod' (missing = unknown) */
const isPaid = (o) => o.payStatus === 'paid_upi' || o.payStatus === 'paid_cash';
const isUnpaid = (o) => o.status !== 'cancelled' && !isPaid(o);
function paidToday(o, today) {
  // paidAt is null for a moment while our own "mark paid" write is still on its way: count it as now.
  const d = o.paidAt && o.paidAt.toDate ? o.paidAt.toDate() : o.paidAt === null ? new Date()
    : o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : null;
  return !!d && d >= today;
}
const shopUpi = () => (settings && settings.upi) || DEFAULT_SETTINGS.upi || DEFAULT_UPI;
function confirmText(o) {
  const upi = shopUpi(), ref = o.ref ? String(o.ref) : '';
  const items = (o.items || []).map((it) => `• ${it.en} · ${kg(it.qty)}${it.cut ? ', ' + it.cut : ''} · ${rupee(it.amount)}`).join('\n');
  const pay = isPaid(o) ? 'Payment received, thank you!'
    : o.payMethod === 'cod' ? `Pay cash or UPI (${upi}) at delivery.`
    : `Pay by UPI to ${upi}${ref ? ` (add ${ref} in the note)` : ''} or pay on delivery.`;
  return `✅ Fresh Orbit: your order${ref ? ' ' + ref : ''} is confirmed.\n${items}\nTotal: ${rupee(o.total)}\nDelivery: ${o.slot || ''}, ${o.area || ''}\n\n${pay}`;
}
function payHTML(o) {
  const paid = isPaid(o);
  const method = o.payMethod === 'upi' ? 'UPI now' : o.payMethod === 'cod' ? 'On delivery' : '';
  const badge = o.payStatus === 'paid_upi' ? 'Paid · UPI' : o.payStatus === 'paid_cash' ? 'Paid · cash' : 'Not paid';
  const id = esc(o.id);
  const btns = paid ? `<button class="btn-sm xs" data-opay="unpaid" data-oid="${id}">Undo paid</button>`
    : o.status === 'cancelled' ? ''
    : `<button class="btn-sm ok" data-utrask="${id}">Paid UPI</button><button class="btn-sm ok" data-opay="paid_cash" data-oid="${id}">Paid cash</button>`;
  const utrLine = o.utr ? `<div class="utr">UTR <b>${esc(o.utr)}</b></div>` : '';
  // Paid UPI asks for the UTR / transaction ID first (optional), shown inside the card.
  const utrForm = payingUpi === o.id && !paid ? `<div class="utr-form">
      <label class="field"><span>UTR / transaction ID <small>12 digits, from your UPI app (optional)</small></span>
        <input id="utrIn" inputmode="numeric" autocomplete="off" maxlength="22" placeholder="e.g. 431298765432"></label>
      <p class="hint">Only press Save after you see ₹${esc(Math.round(o.total || 0))} received in <b>your own</b> UPI app${o.ref ? `, with ${esc(o.ref)} in the note` : ''}. Screenshots can be fake.</p>
      <div class="form-err" id="utrErr" role="alert"></div>
      <div class="act-row"><button class="btn-sm" data-act="utrcancel">Cancel</button><button class="btn-sm gold" data-utrsave="${id}">Save as paid by UPI</button></div>
    </div>` : '';
  return `<div class="row-between pay-row"><span class="pay-info">${method ? `<span>Pay: ${method}</span>` : ''}<span class="pay ${paid ? 'pay-ok' : 'pay-due'}">${badge}</span></span>${btns && payingUpi !== o.id ? `<div class="act-row">${btns}</div>` : ''}</div>${utrLine}${utrForm}`;
}
async function setPay(id, payStatus, utr) {
  const { fs, db } = fb, paid = payStatus !== 'unpaid';
  // The UTR is kept only for a UPI payment that has one; every other change clears it.
  const change = {
    payStatus,
    paidAt: paid ? fs.serverTimestamp() : fs.deleteField(),
    utr: payStatus === 'paid_upi' && utr ? utr : fs.deleteField()
  };
  try {
    await fs.updateDoc(fs.doc(db, 'orders', id), change);
    payingUpi = '';
    toast(payStatus === 'paid_upi' ? 'Marked paid by UPI' + (utr ? ' · UTR saved' : '') : payStatus === 'paid_cash' ? 'Marked paid in cash' : 'Marked not paid');
    return true;
  } catch (e) { toast(failMsg(e), true); return false; }
}
async function saveUtr(id, btn) {
  const utr = ($('utrIn') ? $('utrIn').value : '').replace(/\s/g, '').toUpperCase();
  if (utr && !/^[A-Z0-9]{6,22}$/.test(utr)) { $('utrErr').textContent = 'A UTR is usually 12 digits. Check it, or leave it empty.'; return; }
  const dup = utr && orders.find((x) => x.id !== id && x.utr === utr);
  if (dup && !btn.dataset.dupok) {
    $('utrErr').textContent = `This UTR is already saved on order ${dup.ref || dup.name}. One payment can't pay for two orders. Press Save again only if you are sure.`;
    btn.dataset.dupok = '1'; return;
  }
  btn.disabled = true;
  if (!(await setPay(id, 'paid_upi', utr))) btn.disabled = false;
}
// Customer's pinned location (optional): opens Google Maps directions for the delivery person.
function mapLink(o) {
  const l = o.loc;
  if (!l || typeof l.lat !== 'number' || typeof l.lng !== 'number') return '';
  const url = `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`;
  const acc = typeof l.acc === 'number' && l.acc > 0 ? ` <small>(±${l.acc > 999 ? Math.round(l.acc / 1000) + ' km' : Math.round(l.acc) + ' m'})</small>` : '';
  return `<br><a class="maplink" href="${esc(url)}" target="_blank" rel="noopener">📍 Open in Maps</a>${acc}`;
}
function orderCard(o) {
  const next = o.status === 'new' ? [['confirmed', 'Confirm'], ['cancelled', 'Cancel']]
    : o.status === 'confirmed' ? [['delivered', 'Mark delivered'], ['cancelled', 'Cancel']]
    : [['new', 'Reopen']];
  const phone = String(o.phone || '');
  const confirmLink = (o.status === 'new' || o.status === 'confirmed') && phone
    ? `<a class="btn-sm wa" href="${esc('https://wa.me/91' + phone + '?text=' + encodeURIComponent(confirmText(o)))}" target="_blank" rel="noopener">Send confirmation</a>` : '';
  return `<article class="order${o.status === 'new' ? ' is-new' : ''}">
    <div class="row-between"><div><div class="who">${esc(o.name)}${o.ref ? `<span class="ref">${esc(o.ref)}</span>` : ''}</div><div class="when">${esc(fmtTime(o.createdAt))} · ${esc(o.slot)}</div></div><span class="status st-${esc(o.status)}">${esc(o.status)}</span></div>
    <ul>${(o.items || []).map((it) => `<li><span>${esc(it.en)} · ${kg(it.qty)}${it.cut ? ', ' + esc(it.cut) : ''}</span><span>${rupee(it.amount)}</span></li>`).join('')}
      <li><span>Delivery · ${esc(o.area)}</span><span>${o.delivery ? rupee(o.delivery) : 'Free'}</span></li></ul>
    <div class="row-between"><span class="addr">${esc(o.address)}, ${esc(o.area)}${o.note ? '<br>Note: ' + esc(o.note) : ''}${mapLink(o)}</span><span class="tot">${rupee(o.total)}</span></div>
    ${payHTML(o)}
    <div class="row-between"><span style="font-size:14px;font-weight:700;user-select:all">+91 ${esc(phone)}</span>
      <div class="act-row">
        <a class="btn-sm" href="tel:+91${esc(phone)}">Call</a>
        <a class="btn-sm wa" href="https://wa.me/91${esc(phone)}" target="_blank" rel="noopener">WhatsApp</a>
        ${confirmLink}
        ${next.map(([s, label]) => `<button class="btn-sm ${s === 'cancelled' ? 'danger' : 'gold'}" data-ostatus="${s}" data-oid="${esc(o.id)}">${label}</button>`).join('')}
      </div></div>
  </article>`;
}
async function setStatus(id, status) {
  try { await fb.fs.updateDoc(fb.fs.doc(fb.db, 'orders', id), { status }); toast('Order marked ' + status); }
  catch (e) { toast(failMsg(e), true); }
}

/* ====== products ====== */
const vis = (p) => p.img ? `<img src="${esc(p.img)}" alt="">` : `<span class="mono" aria-hidden="true">${esc((p.en || '?').charAt(0).toUpperCase())}</span>`;
function renderProducts() {
  const pane = $('pane-products');
  if (!productsLoaded) { pane.innerHTML = '<div class="notice">Loading products…</div>'; return; }
  if (productsError) {
    const why = productsError.code === 'permission-denied' ? 'not allowed. Check the admin list and that the latest firestore.rules are published.'
      : (productsError.message || 'check your internet connection.');
    pane.innerHTML = `<div class="notice">Could not load products: ${esc(why)} Reload the page to try again.</div>`;
    return;
  }
  if (!products.length && editing !== '__new') {
    pane.innerHTML = `<div class="box"><h2>Your catalogue is empty</h2><p style="margin:0;color:var(--soft)">Load the starting catalogue of ${DEFAULT_PRODUCTS.length} products and the delivery settings, then edit prices and stock here.</p>
      <div class="act-row"><button class="btn-gold" data-act="seed">Load starting catalog</button><button class="btn-sm" data-act="new">Add a product instead</button></div></div>`;
    return;
  }
  const live = products.filter((p) => p.inStock !== false).length;
  let html = `<div class="stats"><div class="stat"><b>${live}</b><span>In stock</span></div><div class="stat"><b>${products.length - live}</b><span>Out of stock</span></div></div>
    <div class="row-between"><span style="font-size:13px;color:var(--muted)">Price and stock changes go live as soon as you make them.</span><button class="btn-sm gold" data-act="new">+ Add product</button></div>`;
  if (editing === '__new') html += `<div class="box">${editorHTML()}</div>`;
  CATS.filter((c) => c.id !== 'all').forEach((c) => {
    const items = products.filter((p) => p.cat === c.id);
    if (!items.length) return;
    html += `<section><h2 style="margin:6px 0 10px;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--muted)">${esc(c.en)} · <span class="te" style="letter-spacing:0">${esc(c.te)}</span></h2>
      <div class="box" style="padding:0;gap:0">${items.map((p) => `
        <div class="prow${p.inStock === false ? ' off' : ''}">
          <div class="th">${vis(p)}</div>
          <div class="nm"><b>${esc(p.en)}</b><span class="te">${esc(p.te)}</span></div>
          <label class="money"><span>₹</span><input inputmode="decimal" aria-label="Price per kg for ${esc(p.en)}" data-price="${esc(p.id)}" value="${esc(p.price)}"><span>/kg</span></label>
          <button class="switch" role="switch" aria-checked="${p.inStock !== false}" aria-label="${esc(p.en)} in stock" data-stock="${esc(p.id)}"><i></i></button>
          <button class="btn-sm" data-edit="${esc(p.id)}" aria-expanded="${editing === p.id}">${editing === p.id ? 'Close' : 'Edit'}</button>
          ${editing === p.id ? editorHTML() : ''}
        </div>`).join('')}</div></section>`;
  });
  const other = products.filter((p) => !CATS.some((c) => c.id === p.cat && c.id !== 'all'));
  if (other.length) html += `<div class="notice">${other.length} product(s) have no category: ${other.map((p) => esc(p.en)).join(', ')}.</div>`;
  pane.innerHTML = html;
}
function editorHTML() {
  const d = draft, isNew = editing === '__new';
  return `<form class="editor" id="pEditor" novalidate>
    <div class="full row-between"><h3 class="serif" style="margin:0;font-size:24px;font-weight:400">${isNew ? 'New product' : 'Edit ' + esc(d.en)}</h3></div>
    <div class="full photo"><div class="th" id="pPhoto">${vis(d)}</div>
      <div style="display:flex;flex-direction:column;gap:6px"><label class="btn-sm" style="cursor:pointer">Upload photo<input type="file" id="pFile" accept="image/*" class="sr"></label>
      ${d.img ? '<button type="button" class="btn-sm" data-act="rmphoto" style="border:0;height:36px;color:var(--muted)">Remove photo</button>' : ''}</div></div>
    <label class="field"><span>Name (English)</span><input id="pEn" maxlength="60" value="${esc(d.en)}" required></label>
    <label class="field"><span>Name (Telugu)</span><input id="pTe" class="te" maxlength="60" value="${esc(d.te)}"></label>
    <label class="field"><span>Category</span><select id="pCat">${CATS.filter((c) => c.id !== 'all').map((c) => `<option value="${c.id}" ${c.id === d.cat ? 'selected' : ''}>${esc(c.en)}</option>`).join('')}</select></label>
    <label class="field"><span>Price per kg (₹)</span><input id="pPrice" inputmode="decimal" value="${esc(d.price)}" required></label>
    <label class="field full"><span>Description <small>(optional)</small></span><input id="pDesc" maxlength="160" value="${esc(d.desc)}" placeholder="e.g. Medium size, 40 to 50 per kg."></label>
    <label class="field"><span>Cut options <small>comma separated, blank for none</small></span><input id="pCuts" value="${esc((d.cuts || []).join(', '))}" placeholder="Cleaned, Whole"></label>
    <label class="field"><span>Weights in kg <small>comma separated</small></span><input id="pWts" value="${esc((d.weights || []).join(', '))}" placeholder="0.5, 1, 1.5, 2"></label>
    <label class="check"><input type="checkbox" id="pStock" ${d.inStock !== false ? 'checked' : ''}> In stock</label>
    <label class="check"><input type="checkbox" id="pBest" ${d.best ? 'checked' : ''}> Bestseller badge</label>
    <label class="check full"><input type="checkbox" id="pFeat" ${d.featured ? 'checked' : ''}> Show as “Catch of the day” on the home page</label>
    <div class="form-err full" id="pErr" role="alert"></div>
    ${confirmDelete ? `<div class="confirm full"><span>Delete ${esc(d.en)} from the shop? This cannot be undone.</span><span class="act-row"><button type="button" class="btn-sm" data-act="nodelete">Keep it</button><button type="button" class="btn-sm danger" data-act="dodelete">Delete</button></span></div>` : ''}
    <div class="full act-row" style="justify-content:space-between">
      ${isNew ? '<span></span>' : '<button type="button" class="btn-sm danger" data-act="askdelete">Delete product</button>'}
      <span class="act-row"><button type="button" class="btn-sm" data-act="cancel">Cancel</button><button type="submit" class="btn-sm gold" id="pSave">Save product</button></span>
    </div>
  </form>`;
}
function readEditor() {
  if (!draft || !$('pEn')) return;
  const v = (id) => $(id).value.trim();
  draft.en = v('pEn'); draft.te = v('pTe'); draft.cat = $('pCat').value; draft.desc = v('pDesc');
  draft.price = money(v('pPrice'));
  draft.cuts = v('pCuts').split(',').map((s) => s.trim()).filter(Boolean);
  draft.weights = v('pWts').split(',').map((s) => Number(s.trim())).filter((n) => n > 0 && n <= 50);
  draft.inStock = $('pStock').checked; draft.best = $('pBest').checked; draft.featured = $('pFeat').checked;
}
function slug(s) { return (s || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'item'; }
function productGone() {
  toast('This product was deleted by another admin.', true);
  editing = null; draft = null; confirmDelete = false; renderProducts();
}
async function saveEditor() {
  if (!draft) return;
  readEditor();
  const err = !draft.en ? 'Enter the English name.' : !(draft.price > 0) ? 'Enter a price per kg.' : !draft.weights.length ? 'Enter at least one weight, e.g. 1.' : '';
  if (err) { $('pErr').textContent = err; return; }
  const { fs, db } = fb;
  const isNew = editing === '__new';
  if (!isNew && !products.some((p) => p.id === editing)) { productGone(); return; }
  const id = isNew ? slug(draft.en) + '-' + Math.random().toString(36).slice(2, 6) : editing;
  const name = draft.en;
  // Only the fields this editor owns, so another admin's changes to other fields are kept.
  const fields = { en: draft.en, te: draft.te, cat: draft.cat, price: Math.round(draft.price), desc: draft.desc, cuts: draft.cuts, weights: draft.weights,
    inStock: draft.inStock, best: draft.best, featured: draft.featured, img: draft.img || '', hero: draft.hero || '' };
  $('pSave').disabled = true; $('pSave').textContent = 'Saving…';
  try {
    const batch = fs.writeBatch(db);
    if (isNew) batch.set(fs.doc(db, 'products', id), { ...fields, order: products.reduce((m, p) => Math.max(m, p.order || 0), 0) + 1 });
    else batch.update(fs.doc(db, 'products', id), fields);
    // Only one "Catch of the day" at a time.
    if (fields.featured) products.filter((p) => p.featured && p.id !== id).forEach((p) => batch.update(fs.doc(db, 'products', p.id), { featured: false }));
    await batch.commit();
    toast(isNew ? name + ' added to the shop' : name + ' saved');
    editing = null; draft = null; confirmDelete = false; renderProducts();
  } catch (e) {
    if (e && e.code === 'not-found') { productGone(); return; }
    toast(failMsg(e), true);
    if ($('pSave')) { $('pSave').disabled = false; $('pSave').textContent = 'Save product'; }
  }
}
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const max = 640, s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); // transparent PNGs become white, not black
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let q = 0.8, out = c.toDataURL('image/jpeg', q);
      while (out.length > 700000 && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}
async function seed() {
  const { fs, db } = fb;
  try {
    // Ask the server (not the local cache) what already exists, and never overwrite it.
    const [have, settingsSnap] = await Promise.all([
      fs.getDocsFromServer(fs.collection(db, 'products')),
      fs.getDocFromServer(fs.doc(db, 'shop', 'settings'))
    ]);
    const ids = new Set(have.docs.map((d) => d.id));
    const batch = fs.writeBatch(db);
    let n = 0;
    DEFAULT_PRODUCTS.forEach((p) => { if (ids.has(p.id)) return; const { id, ...rest } = p; batch.set(fs.doc(db, 'products', id), rest); n++; });
    const addSettings = !settingsSnap.exists();
    if (addSettings) batch.set(fs.doc(db, 'shop', 'settings'), { ...DEFAULT_SETTINGS, upi: DEFAULT_SETTINGS.upi ?? DEFAULT_UPI });
    if (!n && !addSettings) { toast('Nothing to load. The catalogue and settings are already there.'); renderProducts(); return; }
    await batch.commit();
    toast(n ? `Starting catalogue loaded (${n} products)` : 'Starting delivery settings loaded');
  } catch (e) {
    toast(e && e.code === 'unavailable' ? 'No internet connection. Try again.' : failMsg(e), true);
    renderProducts();
  }
}

/* ====== delivery settings ====== */
function renderDelivery() {
  if (!settingsLoaded) { $('pane-delivery').innerHTML = '<div class="notice">Loading delivery settings…</div>'; return; }
  const s = settingsDraft || structuredClone(DEFAULT_SETTINGS); settingsDraft = s;
  const blocked = !!settingsError;
  $('pane-delivery').innerHTML = `
    ${blocked ? `<div class="notice">Could not load the delivery settings: ${esc(settingsError.code === 'permission-denied' ? 'not allowed.' : (settingsError.message || 'check your internet connection.'))} Saving is turned off so the shop's real settings are not overwritten. Reload the page to try again.</div>`
      : !settings ? '<div class="notice">These are the starting settings. Press Save to publish them to the shop.</div>' : ''}
    <div class="box">
      <div class="row-between"><div><h2>Orders</h2><span style="font-size:13px;font-weight:700;color:${s.open !== false ? 'var(--ok)' : 'var(--warn)'}">${s.open !== false ? 'Taking orders' : 'Closed · customers see “Not taking orders right now”'}</span></div>
        <button class="switch" role="switch" aria-checked="${s.open !== false}" aria-label="Taking orders" data-sopen="1"><i></i></button></div>
      <label class="field"><span>WhatsApp number for orders</span><span class="phone"><b>+91</b><input id="sWa" inputmode="numeric" maxlength="16" value="${esc(String(s.whatsapp || '').replace(/^91/, ''))}"></span></label>
      <label class="field"><span>UPI ID for payments</span><input id="sUpi" maxlength="321" autocapitalize="off" autocomplete="off" spellcheck="false" value="${esc(s.upi ?? DEFAULT_UPI)}"><small>Customers see this to pay you. e.g. 8498857618@ybl</small></label>
      <label class="field"><span>Message on shop <small>(optional, shown at the top)</small></span><input id="sBanner" maxlength="120" value="${esc(s.banner)}"></label>
    </div>
    <div class="box"><h2>Delivery charge by area</h2>
      <div class="list-edit" id="areasEd">${s.areas.map((a, i) => `<div class="li"><input aria-label="Area name" data-aname="${i}" value="${esc(a.name)}"><label class="money"><span>₹</span><input inputmode="decimal" aria-label="Charge for ${esc(a.name)}" data-afee="${i}" value="${esc(a.fee)}"></label><button type="button" class="x" data-arm="${i}" aria-label="Remove ${esc(a.name)}">${X}</button></div>`).join('')}</div>
      <button type="button" class="dashed" data-act="addarea">+ Add area</button>
    </div>
    <div class="box"><h2>Order rules</h2><div class="grid2">
      <label class="field"><span>Free delivery above (₹)</span><input id="sFree" inputmode="decimal" value="${esc(s.freeAbove)}"></label>
      <label class="field"><span>Minimum order (₹)</span><input id="sMin" inputmode="decimal" value="${esc(s.minOrder)}"></label></div></div>
    <div class="box"><h2>Hours &amp; delivery slots</h2>
      <label class="field"><span>Opening hours</span><input id="sHours" maxlength="40" value="${esc(s.hours)}"></label>
      <div class="list-edit" id="slotsEd">${s.slots.map((t, i) => `<div class="li"><input aria-label="Delivery slot" data-slot="${i}" value="${esc(t)}"><button type="button" class="x" data-srm="${i}" aria-label="Remove slot ${esc(t)}">${X}</button></div>`).join('')}</div>
      <button type="button" class="dashed" data-act="addslot">+ Add slot</button>
    </div>
    <div class="savebar"><button type="button" class="btn-ghost" data-act="resetsettings" style="height:52px">Reset</button><button type="button" class="btn-gold" data-act="savesettings"${blocked ? ' disabled' : ''}>Save changes</button></div>`;
}
function readSettings() {
  const s = settingsDraft, v = (id) => $(id) ? $(id).value.trim() : '';
  if (!s || !$('sWa')) return;
  s.whatsapp = '91' + v('sWa').replace(/\D/g, '').slice(-10);
  s.upi = v('sUpi');
  s.banner = v('sBanner'); s.hours = v('sHours');
  s.freeAbove = money(v('sFree'));
  s.minOrder = money(v('sMin'));
  document.querySelectorAll('[data-aname]').forEach((el) => { s.areas[+el.dataset.aname].name = el.value.trim(); });
  document.querySelectorAll('[data-afee]').forEach((el) => { s.areas[+el.dataset.afee].fee = money(el.value); });
  document.querySelectorAll('[data-slot]').forEach((el) => { s.slots[+el.dataset.slot] = el.value.trim(); });
}
async function saveSettings() {
  if (!settingsLoaded || settingsError) { toast('The settings could not be loaded, so saving is turned off. Reload the page.', true); return; }
  readSettings();
  const s = settingsDraft;
  s.areas = s.areas.filter((a) => a.name); s.slots = s.slots.filter(Boolean);
  if (!/^91[6-9]\d{9}$/.test(s.whatsapp)) { toast('Enter a 10-digit WhatsApp number.', true); return; }
  if (!isUpi(s.upi)) { toast('Enter a UPI ID like 8498857618@ybl.', true); return; }
  if (!s.areas.length) { toast('Add at least one delivery area.', true); return; }
  if (!s.slots.length) { toast('Add at least one delivery slot.', true); return; }
  try {
    await fb.fs.setDoc(fb.fs.doc(fb.db, 'shop', 'settings'), s);
    settingsDirty = false; toast('Delivery settings saved'); renderDelivery();
  } catch (e) { toast(failMsg(e), true); }
}

/* ====== admins ====== */
function renderAdmins(err) {
  const pane = $('pane-admins');
  if (err) { pane.innerHTML = `<div class="notice">${esc(failMsg(err).replace('Could not save', 'Could not load the admin list'))}</div>`; return; }
  if (!adminsLoaded) { pane.innerHTML = '<div class="notice">Loading admins…</div>'; return; }
  const usersUrl = `https://console.firebase.google.com/project/${encodeURIComponent(firebaseConfig.projectId)}/authentication/users`;
  const others = admins.filter((a) => a !== MAIN_OWNER);
  const row = (email, tag, removable) => `<div class="admin-row">
      <span class="em">${esc(email)}${email === myEmail ? ' <span class="tag">· you</span>' : ''}</span>
      ${tag ? `<span class="tag">${tag}</span>` : ''}
      ${removable ? (removingAdmin === email
        ? `<span class="act-row"><button class="btn-sm" data-act="keepadmin">Keep</button><button class="btn-sm danger" data-adminrm="${esc(email)}">Remove</button></span>`
        : `<button type="button" class="btn-sm" data-adminreset="${esc(email)}">Reset password</button><button type="button" class="x" data-adminask="${esc(email)}" aria-label="Remove ${esc(email)}">${X}</button>`) : ''}
    </div>`;
  pane.innerHTML = `
    <div class="box">
      <h2>Admins</h2>
      <p style="margin:0;color:var(--soft);font-size:14px">Everyone here can see all orders and change prices, stock and delivery settings. Add only people you trust.</p>
      <div class="list-edit">
        ${row(MAIN_OWNER, 'Main owner', false)}
        ${others.map((a) => row(a, '', a !== myEmail)).join('')}
      </div>
      ${others.length ? '' : '<p style="margin:0;color:var(--muted);font-size:13px">No other admins yet.</p>'}
    </div>
    <form class="box" id="adminAdd" novalidate>
      <h2>Add an admin</h2>
      <label class="field"><span>Their email</span><input id="aEmail" type="email" autocomplete="off" placeholder="friend@gmail.com" maxlength="120"></label>
      <label class="field"><span>Password for them <small>at least 8 characters</small></span><input id="aPass" type="text" autocomplete="new-password" spellcheck="false" maxlength="64" placeholder="e.g. Orbit-4821-fish"></label>
      <div class="form-err" id="aErr" role="alert"></div>
      <button class="btn-gold" type="submit" id="aBtn">Create login &amp; add admin</button>
      <div class="notice">Send them <b>${esc(location.origin)}/admin.html</b>, their email and this password, privately. They can choose their own password later: press <b>Reset password</b> next to their name and Firebase emails them a link. If the email already has a login, it is just added to the list and keeps its old password. Every admin except the main owner must verify their email: Firebase sends them a link, and they can ask for a new one on the sign-in screen. <a href="${usersUrl}" target="_blank" rel="noopener" style="color:var(--gold)">All logins in Firebase</a></div>
    </form>`;
}
// Creates the login on a separate Firebase connection, so the admin doing it stays signed in.
async function createLogin(email, password) {
  const { appMod, authMod } = fb;
  const second = appMod.getApps().find((a) => a.name === 'create-login') || appMod.initializeApp(firebaseConfig, 'create-login');
  const secondAuth = authMod.getAuth(second);
  await authMod.setPersistence(secondAuth, authMod.inMemoryPersistence);
  const cred = await authMod.createUserWithEmailAndPassword(secondAuth, email, password);
  // New admins must confirm their email before the rules let them in.
  let sent = true;
  try { await authMod.sendEmailVerification(cred.user); }
  catch (e) { console.warn(e); sent = false; }
  await authMod.signOut(secondAuth);
  return sent;
}
function loginError(e) {
  const c = (e && e.code) || '';
  if (c === 'auth/operation-not-allowed' || c === 'auth/admin-restricted-operation')
    return 'Firebase is not allowing new logins. In Firebase open Authentication → Settings → User actions, tick "Enable create (sign-up)" and Save.';
  if (c === 'auth/weak-password' || c === 'auth/password-does-not-meet-requirements') return 'That password is too weak. Use at least 8 characters with letters and numbers.';
  if (c === 'auth/invalid-email') return 'That does not look like an email address.';
  if (c === 'auth/too-many-requests') return 'Too many attempts. Wait a few minutes and try again.';
  if (c === 'auth/network-request-failed') return 'No internet connection. Try again.';
  return 'Could not create the login. Try again.';
}
// Adds or removes one email. arrayUnion / arrayRemove with merge means two admins editing at once
// don't undo each other's changes, and it also works when the list doc doesn't exist yet.
async function saveAdmins(change, okMsg) {
  const { fs, db } = fb;
  try {
    const emails = change.add ? fs.arrayUnion(change.add) : fs.arrayRemove(change.remove);
    await fs.setDoc(fs.doc(db, 'admins', 'list'), { emails, updatedBy: myEmail, updatedAt: fs.serverTimestamp() }, { merge: true });
    removingAdmin = ''; toast(okMsg);
    if (tab === 'admins') renderAdmins();
    return true;
  } catch (e) { toast(failMsg(e), true); if (tab === 'admins') renderAdmins(); return false; }
}
async function addAdmin() {
  const email = $('aEmail').value.trim().toLowerCase(), pass = $('aPass').value;
  const err = !email ? 'Enter an email.' : !isEmail(email) ? 'That does not look like an email address.'
    : (email === MAIN_OWNER || admins.includes(email)) ? 'This email is already an admin.'
    : admins.length >= 25 ? 'The admin list is full (25). Remove someone first.'
    : pass.length < 8 ? 'Enter a password of at least 8 characters.' : '';
  if (err) { $('aErr').textContent = err; return; }
  const done = () => { if ($('aBtn')) { $('aBtn').disabled = false; $('aBtn').textContent = 'Create login & add admin'; } };
  $('aErr').textContent = ''; $('aBtn').disabled = true; $('aBtn').textContent = 'Creating login…';
  let existed = false, sent = false;
  try { sent = await createLogin(email, pass); }
  catch (e) {
    if (e && e.code === 'auth/email-already-in-use') existed = true;
    else { console.warn(e); $('aErr').textContent = loginError(e); done(); return; }
  }
  const msg = existed
    ? email + ' already had a login and is now an admin with their existing password. Their email must be verified: they can sign in and press "Send verification email".'
    : sent ? 'Login created. A verification email was sent to ' + email + ' — they must click it before they can sign in.'
    : 'Login created and ' + email + ' added, but the verification email could not be sent. They can sign in and press "Send verification email".';
  const ok = await saveAdmins({ add: email }, msg);
  if (ok && $('aEmail')) { $('aEmail').value = ''; $('aPass').value = ''; }
  done();
}
async function resetPassword(email, btn) {
  btn.disabled = true;
  try { await fb.authMod.sendPasswordResetEmail(fb.auth, email); toast('Password reset email sent to ' + email); }
  catch (e) { toast(loginError(e).replace('create the login', 'send the reset email'), true); }
  btn.disabled = false;
}

/* ====== events ====== */
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button'); if (!t || t.disabled) return;
  if (t.dataset.tab) { tab = t.dataset.tab; render(); return; }
  if (t.dataset.ofilter) { orderFilter = t.dataset.ofilter; renderOrders(); return; }
  if (t.dataset.ostatus) { setStatus(t.dataset.oid, t.dataset.ostatus); return; }
  if (t.dataset.opay) { t.disabled = true; await setPay(t.dataset.oid, t.dataset.opay); t.disabled = false; return; }
  if (t.dataset.utrask) { payingUpi = t.dataset.utrask; renderOrders(); $('utrIn') && $('utrIn').focus(); return; }
  if (t.dataset.utrsave) { saveUtr(t.dataset.utrsave, t); return; }
  if (t.dataset.act === 'utrcancel') { payingUpi = ''; renderOrders(); return; }
  if (t.dataset.act === 'clearsearch') { orderSearch = ''; if ($('oSearch')) $('oSearch').value = ''; renderOrders(); return; }
  if (t.dataset.stock) {
    const p = products.find((x) => x.id === t.dataset.stock); if (!p) return;
    const on = p.inStock === false;
    try { await fb.fs.updateDoc(fb.fs.doc(fb.db, 'products', p.id), { inStock: on }); toast(p.en + (on ? ' back in stock' : ' marked out of stock')); }
    catch (err) { toast(failMsg(err), true); }
    return;
  }
  if (t.dataset.edit) {
    const id = t.dataset.edit;
    if (editing === id) { editing = null; draft = null; }
    else { editing = id; draft = structuredClone(products.find((p) => p.id === id)); }
    confirmDelete = false; renderProducts(); return;
  }
  if (t.dataset.sopen) { readSettings(); settingsDraft.open = settingsDraft.open === false; settingsDirty = true; renderDelivery(); return; }
  if (t.dataset.arm) { readSettings(); settingsDraft.areas.splice(+t.dataset.arm, 1); settingsDirty = true; renderDelivery(); return; }
  if (t.dataset.srm) { readSettings(); settingsDraft.slots.splice(+t.dataset.srm, 1); settingsDirty = true; renderDelivery(); return; }
  if (t.dataset.adminreset) { resetPassword(t.dataset.adminreset, t); return; }
  if (t.dataset.adminask) { removingAdmin = t.dataset.adminask; renderAdmins(); return; }
  if (t.dataset.adminrm) {
    const email = t.dataset.adminrm; t.disabled = true;
    await saveAdmins({ remove: email }, email + ' removed from admins');
    return;
  }
  const act = t.dataset.act;
  if (act === 'keepadmin') { removingAdmin = ''; renderAdmins(); return; }
  if (act === 'seed') { t.disabled = true; t.textContent = 'Loading…'; await seed(); return; }
  if (act === 'new') { editing = '__new'; draft = { en: '', te: '', cat: 'fish', price: '', desc: '', cuts: ['Cleaned', 'Whole'], weights: [0.5, 1, 1.5, 2], inStock: true, best: false, featured: false, img: '' }; confirmDelete = false; renderProducts(); $('pEn') && $('pEn').focus(); return; }
  if (act === 'cancel') { editing = null; draft = null; confirmDelete = false; renderProducts(); return; }
  if (act === 'askdelete') { readEditor(); confirmDelete = true; renderProducts(); return; }
  if (act === 'nodelete') { readEditor(); confirmDelete = false; renderProducts(); return; }
  if (act === 'dodelete') {
    // Close the editor first, so our own delete isn't reported as "deleted by another admin".
    const id = editing, name = draft ? draft.en : 'Product';
    editing = null; draft = null; confirmDelete = false; renderProducts();
    try { await fb.fs.deleteDoc(fb.fs.doc(fb.db, 'products', id)); toast(name + ' deleted'); }
    catch (err) { toast(failMsg(err), true); }
    return;
  }
  if (act === 'rmphoto') { readEditor(); draft.img = ''; draft.hero = ''; renderProducts(); return; }
  if (act === 'addarea') { readSettings(); settingsDraft.areas.push({ name: '', fee: 30 }); settingsDirty = true; renderDelivery(); const ins = document.querySelectorAll('[data-aname]'); ins[ins.length - 1].focus(); return; }
  if (act === 'addslot') { readSettings(); settingsDraft.slots.push(''); settingsDirty = true; renderDelivery(); const ins = document.querySelectorAll('[data-slot]'); ins[ins.length - 1].focus(); return; }
  if (act === 'savesettings') { saveSettings(); return; }
  if (act === 'resetsettings') { settingsDirty = false; settingsDraft = structuredClone(settings || DEFAULT_SETTINGS); renderDelivery(); toast('Changes discarded'); return; }
});
document.addEventListener('submit', (e) => {
  if (e.target.id === 'pEditor') { e.preventDefault(); saveEditor(); }
  if (e.target.id === 'adminAdd') { e.preventDefault(); addAdmin(); }
});
document.addEventListener('input', (e) => {
  if (e.target.closest('#pane-delivery')) settingsDirty = true;
  if (e.target.id === 'oSearch') { orderSearch = e.target.value; renderOrders(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'utrIn') { e.preventDefault(); const b = document.querySelector('[data-utrsave]'); b && saveUtr(b.dataset.utrsave, b); }
});
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.price) {
    const p = products.find((x) => x.id === el.dataset.price); if (!p) return;
    const v = money(el.value);
    if (!(v > 0)) { el.value = p.price; toast('Enter a price above ₹0.', true); return; }
    if (v === p.price) return;
    try { await fb.fs.updateDoc(fb.fs.doc(fb.db, 'products', p.id), { price: v }); toast(`Saved · ${p.en} ${rupee(v)}/kg`); }
    catch (err) { el.value = p.price; toast(failMsg(err), true); }
  }
  if (el.id === 'pFile' && el.files && el.files[0]) {
    if (!draft) return;
    readEditor();
    const forDraft = draft;
    try {
      const img = await resizeImage(el.files[0]);
      if (!draft || draft !== forDraft) return; // editor was closed (or another product opened) while resizing
      draft.img = img; draft.hero = '';
      if ($('pPhoto')) $('pPhoto').innerHTML = vis(draft);
    } catch (err) { if (draft === forDraft && $('pErr')) $('pErr').textContent = 'That file is not a photo we can read. Try a JPG or PNG.'; }
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.price) e.target.blur(); });

boot();
