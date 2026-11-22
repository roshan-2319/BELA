'use strict';
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CAT_LABEL = { cosmetics: 'Cosmetics', jewellery: 'Jewellery', clothing: 'Clothing' };
  var ICONS = {
    cosmetics: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="24" y="34" width="16" height="20" rx="2"/><rect x="22" y="28" width="20" height="6" rx="1"/><path d="M26 28V18L36 10V28"/></svg>',
    jewellery: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="40" r="14"/><path d="M25 24l7-10 7 10-7 7z"/></svg>',
    clothing: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M26 8L32 16L38 8"/><path d="M26 8L22 22L28 28L20 56H44L36 28L42 22L38 8"/></svg>'
  };

  var state = {
    store: null, view: 'shop', filter: 'all', cart: {}, method: 'gpay',
    form: { name: '', phone: '', address: '', txn: '' },
    error: '', placing: false, done: null, introDone: reduce, busy: false
  };

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var viewEl = $('#view');
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  var rupee = function (n) { return '₹' + Number(n).toLocaleString('en-IN'); };

  /* cart is kept in this browser only */
  try { var saved = JSON.parse(localStorage.getItem('bela_cart') || '{}'); if (saved && typeof saved === 'object') state.cart = saved; } catch (e) {}
  function saveCart() { try { localStorage.setItem('bela_cart', JSON.stringify(state.cart)); } catch (e) {} }

  function productById(id) { return state.store.products.find(function (p) { return p.id === id; }); }
  function cartLines() {
    return Object.keys(state.cart).map(function (id) {
      var p = productById(id);
      return p ? { p: p, qty: state.cart[id] } : null;
    }).filter(Boolean);
  }
  function cartCount() { return cartLines().reduce(function (a, l) { return a + l.qty; }, 0); }
  function cartTotal() { return cartLines().reduce(function (a, l) { return a + l.p.price * l.qty; }, 0); }
  function updateBag() { $('#bagCount').textContent = cartCount(); updateBar(); }

  /* ---------- shop ---------- */
  function buyHtml(p) {
    var qty = state.cart[p.id] || 0, id = esc(p.id);
    var action;
    if (!p.inStock) action = '<button class="btn ghost" disabled>Sold out</button>';
    else if (!qty) action = '<button class="btn ghost" data-action="add" data-id="' + id + '">Add to bag</button>';
    else action = '<div class="qty" role="group" aria-label="Quantity of ' + esc(p.name) + '"><button data-action="dec" data-id="' + id + '" aria-label="Remove one">−</button><span aria-live="polite">' + qty + '</span><button data-action="inc" data-id="' + id + '" aria-label="Add one more">+</button></div>';
    return '<span class="price">' + rupee(p.price) + '</span>' + action;
  }
  function refreshCard(id) {
    var p = productById(id), el = document.querySelector('.card[data-id="' + id + '"] .buy');
    if (p && el) el.innerHTML = buyHtml(p);
  }
  function updateBar() {
    var bar = $('#bar'); if (!bar || !state.store) return;
    var n = cartCount();
    if (state.view !== 'shop' || !n) { bar.hidden = true; document.body.classList.remove('has-bar'); return; }
    bar.hidden = false; document.body.classList.add('has-bar');
    bar.innerHTML = '<span><b>' + n + '</b> item' + (n > 1 ? 's' : '') + ' in bag · <b>' + rupee(cartTotal()) + '</b></span><button class="btn" data-action="go" data-view="cart">Go to Cart</button>';
  }
  function afterQty(id) {
    if (state.view === 'cart') renderCart(); else refreshCard(id);
    updateBag();
  }
  function methodBtn(key, label, sel) {
    return '<button class="method" data-action="method" data-key="' + key + '" aria-pressed="' + sel + '"><span class="dot ' + key + '"></span>' + label + '</button>';
  }
  function cardHtml(p) {
    var img1 = p.images[0], img2 = p.images[1];
    var media = img1 ? '<img src="' + esc(img1) + '" alt="' + esc(p.name) + '" loading="lazy">' : (ICONS[p.category] || '');
    var alt = img2 ? '<img class="alt" src="' + esc(img2) + '" alt="" aria-hidden="true" loading="lazy">' : '';
    return '<article class="card reveal" data-id="' + esc(p.id) + '"><div class="tile ' + esc(p.category) + '"><div class="zoom">' + media + alt + '</div>' +
      (p.inStock ? '' : '<span class="badge">Sold out</span>') + '</div>' +
      '<div><div class="cat">' + esc(CAT_LABEL[p.category] || p.category) + '</div><h3>' + esc(p.name) + '</h3><p class="note">' + esc(p.note) + '</p></div>' +
      '<div class="buy">' + buyHtml(p) + '</div></article>';
  }
  function tilesHtml() {
    var keys = ['all', 'cosmetics', 'jewellery', 'clothing'];
    return keys.map(function (k) {
      var n = k === 'all' ? state.store.products.length : state.store.products.filter(function (p) { return p.category === k; }).length;
      return '<button class="tile-btn" data-action="filter" data-key="' + k + '" aria-pressed="' + (state.filter === k) + '"><span class="t">' + (k === 'all' ? 'All' : CAT_LABEL[k]) + '</span><span class="c">' + n + ' items</span></button>';
    }).join('');
  }
  function gridHtml() {
    var list = state.store.products.filter(function (p) { return state.filter === 'all' || p.category === state.filter; });
    return list.length ? list.map(cardHtml).join('') : '<p class="empty">Nothing here yet.</p>';
  }
  function renderGrid() { $('#tiles').innerHTML = tilesHtml(); $('#grid').innerHTML = gridHtml(); }

  function renderShop() {
    var base = state.introDone ? 0.1 : 2.1;
    var d = function (i) { return 'style="--d:' + (base + i * 0.1).toFixed(1) + 's"'; };
    viewEl.innerHTML =
      '<main>' +
      '<section class="wordmark"><div class="wrap"><h2 aria-label="BELA">' +
      ['B', 'E', 'L', 'A'].map(function (c, i) { return '<span class="mask"><span ' + d(i) + '>' + c + '</span></span>'; }).join('') +
      '</h2><div class="rule" ' + d(5) + '></div></div></section>' +
      '<section class="hero"><div class="wrap hero-row"><div class="hero-copy">' +
      '<span class="eyebrow">Cosmetics · Jewellery · Clothing</span>' +
      '<h1>Everyday beauty, worn well.</h1>' +
      '<p>Face care, hair care and body care from BELA, with jewellery and clothing alongside. Add to your bag and pay with Google Pay or PhonePe.</p>' +
      '<a class="btn" href="#shop">Shop the collection</a></div>' +
      '<div class="collage"><div class="collage-grid">' +
      '<div><img src="/images/hibiscus-shampoo.jpg" alt="Hibiscus Shampoo"></div>' +
      '<div><img src="/images/whitening-serum.jpg" alt="Whitening and Brightening Face Serum"></div>' +
      '<div><img src="/images/jhumka-studio.jpg" alt="Temple Jhumka Earrings"></div>' +
      '</div></div></div></section>' +
      '<section class="wrap section" id="shop"><h2>Shop by category</h2><div class="tiles" id="tiles">' + tilesHtml() + '</div></section>' +
      '<section class="wrap"><div class="grid" id="grid">' + gridHtml() + '</div></section>' +
      '</main>';
  }

  /* ---------- bag and checkout ---------- */
  function payUrl(scheme) {
    var s = state.store;
    return scheme + 'pa=' + encodeURIComponent(s.upiId) + '&pn=' + encodeURIComponent(s.payeeName) +
      '&am=' + cartTotal().toFixed(2) + '&cu=INR&tn=' + encodeURIComponent('BELA order');
  }
  function formValid() {
    var f = state.form;
    return f.name.trim().length >= 2 && f.phone.replace(/\D/g, '').length >= 10 && f.address.trim().length >= 6 && f.txn.trim().length >= 6;
  }
  function refreshPlace() {
    var b = $('#placeBtn');
    if (b) b.disabled = !formValid() || state.placing;
  }
  function field(id, label, value, extra) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" data-field="' + id.replace('f-', '') + '" value="' + esc(value) + '" ' + (extra || '') + '></div>';
  }
  function renderCart() {
    var lines = cartLines();
    if (!lines.length) {
      viewEl.innerHTML = '<main class="wrap page"><h1>Your bag</h1><div class="line" style="flex-direction:column;align-items:flex-start;padding:40px 24px"><p class="muted" style="margin:0;font-size:18px">Your bag is empty. Pick something from the shop to get started.</p><button class="btn" data-action="go" data-view="shop">Back to the shop</button></div></main>';
      return;
    }
    var s = state.store, f = state.form, total = rupee(cartTotal());
    var items = lines.map(function (l) {
      return '<div class="line"><div class="info"><span class="name">' + esc(l.p.name) + '</span><span class="unit">' + rupee(l.p.price) + ' each</span></div>' +
        '<div class="qty"><button data-action="dec" data-id="' + esc(l.p.id) + '" aria-label="Remove one">−</button><span>' + l.qty + '</span><button data-action="inc" data-id="' + esc(l.p.id) + '" aria-label="Add one more">+</button></div>' +
        '<span class="sum">' + rupee(l.p.price * l.qty) + '</span></div>';
    }).join('');
    var pay;
    if (!s.upiId) {
      pay = '<div class="notice">Payments are not set up yet. Please check back soon.</div>';
    } else {
      pay = '<div class="paybox"><span class="label">Step 1. Pay ' + total + ' securely to BELA</span>' +
        '<a class="btn paybtn" href="' + esc(payUrl('upi://pay?')) + '">Pay ' + total + ' with Google Pay</a>' +
        '<p>On Android, this opens an available UPI payment app. Choose Google Pay, check the BELA UPI ID and exact amount, then approve the payment.</p></div>' +
        field('f-txn', 'Step 2. Enter the UPI transaction ID after payment', f.txn, 'autocomplete="off" maxlength="40"') +
        '<p class="hint">After paying, open the payment details in Google Pay and copy the UPI transaction ID (UTR). Your order is confirmed after we verify the payment.</p>' +
        '<div class="error" id="formError" role="alert">' + esc(state.error) + '</div>' +
        '<button class="btn" id="placeBtn" data-action="place" ' + (formValid() ? '' : 'disabled') + '>Place order · ' + total + '</button>';
    }
    viewEl.innerHTML = '<main class="wrap page"><h1>Your bag</h1><div class="cols"><section class="items" aria-label="Items in your bag">' + items +
      '<div class="total"><span>Total</span><b>' + total + '</b></div><button class="linkish" data-action="go" data-view="shop" style="align-self:flex-start">Continue shopping</button></section>' +
      '<section class="panel" aria-label="Delivery and payment"><h2>Delivery and payment</h2>' +
      field('f-name', 'Full name', f.name, 'autocomplete="name" maxlength="80"') +
      field('f-phone', 'Mobile number', f.phone, 'type="tel" autocomplete="tel" maxlength="20"') +
      '<div class="field"><label for="f-address">Delivery address</label><textarea id="f-address" data-field="address" rows="3" maxlength="400" autocomplete="street-address">' + esc(f.address) + '</textarea></div>' +
      pay + '</section></div></main>';
  }

  function placeOrder() {
    if (state.placing || !formValid()) return;
    state.placing = true; state.error = ''; refreshPlace();
    var f = state.form;
    fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: f.name, phone: f.phone, address: f.address, txn: f.txn, method: state.method, items: cartLines().map(function (l) { return { id: l.p.id, qty: l.qty }; }) })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        state.placing = false;
        if (!res.ok) { state.error = res.j.error || 'Could not place the order'; var e = $('#formError'); if (e) e.textContent = state.error; refreshPlace(); return; }
        state.done = { id: res.j.id, total: res.j.total, wa: res.j.wa || '', name: f.name, phone: f.phone, address: f.address, txn: f.txn.toUpperCase(), items: cartLines().map(function (l) { return { name: l.p.name, qty: l.qty, price: l.p.price }; }) };
        state.cart = {}; saveCart(); updateBag();
        state.form = { name: '', phone: '', address: '', txn: '' };
        go('done');
      })
      .catch(function () { state.placing = false; state.error = 'No connection. Your payment is safe; please try again.'; var e = $('#formError'); if (e) e.textContent = state.error; refreshPlace(); });
  }

  function renderDone() {
    var d = state.done;
    if (!d) { go('shop'); return; }
    var wa = (d.wa || '').replace(/\D/g, '');
    var link = '';
    if (wa.length >= 10) {
      var text = 'BELA order ' + d.id + '\nName: ' + d.name + '\nPhone: ' + d.phone + '\nAddress: ' + d.address + '\nItems:\n' +
        d.items.map(function (i) { return '- ' + i.name + ' x ' + i.qty + ' = ' + rupee(i.price * i.qty); }).join('\n') +
        '\nTotal: ' + rupee(d.total) + '\nUPI transaction ID: ' + d.txn;
      link = '<a class="btn outline" target="_blank" rel="noopener" href="https://wa.me/' + wa + '?text=' + encodeURIComponent(text) + '">Send order details on WhatsApp</a>';
    }
    viewEl.innerHTML = '<main class="wrap done"><img src="/images/logo-emblem.jpg" alt="BELA"><h1>Thank you, ' + esc(d.name) + '.</h1>' +
      '<p>Order ' + esc(d.id) + ' is noted. We confirm it once your UPI payment of ' + rupee(d.total) + ' shows up on our side, then contact you on ' + esc(d.phone) + ' about delivery.</p>' +
      link + '<button class="btn" data-action="go" data-view="shop">Back to the shop</button></main>';
  }

  /* ---------- navigation with the curtain ---------- */
  function render() {
    updateBag();
    if (state.view === 'cart') renderCart();
    else if (state.view === 'done') renderDone();
    else renderShop();
  }
  function go(view) {
    if (state.busy) return;
    if (view === state.view && view !== 'done') { window.scrollTo(0, 0); return; }
    var swap = function () { state.view = view; render(); window.scrollTo(0, 0); };
    if (reduce) { swap(); return; }
    state.busy = true;
    var w = $('#wipe');
    w.hidden = false; w.classList.remove('run'); void w.offsetWidth; w.classList.add('run');
    setTimeout(swap, 460);
    setTimeout(function () { w.hidden = true; w.classList.remove('run'); state.busy = false; }, 1000);
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-action]');
    if (!el) return;
    var a = el.dataset.action, id = el.dataset.id;
    if (a === 'go') go(el.dataset.view);
    else if (a === 'filter') { state.filter = el.dataset.key; renderGrid(); }
    else if (a === 'add') { state.cart[id] = Math.min(20, (state.cart[id] || 0) + 1); saveCart(); afterQty(id); }
    else if (a === 'inc') { state.cart[id] = Math.min(20, (state.cart[id] || 0) + 1); saveCart(); afterQty(id); }
    else if (a === 'dec') { state.cart[id] = (state.cart[id] || 0) - 1; if (state.cart[id] <= 0) delete state.cart[id]; saveCart(); afterQty(id); }
    else if (a === 'copy') {
      var txt = el.dataset.text;
      var done = function () { el.textContent = 'Copied'; setTimeout(function () { el.textContent = 'Copy'; }, 1500); };
      try { navigator.clipboard.writeText(txt).then(done, function () { el.textContent = 'Select and copy'; }); } catch (e) { el.textContent = 'Select and copy'; }
    }
    else if (a === 'method') { state.method = el.dataset.key; renderCart(); }
    else if (a === 'place') placeOrder();
  });
  document.addEventListener('input', function (ev) {
    var k = ev.target.dataset && ev.target.dataset.field;
    if (!k || !(k in state.form)) return;
    state.form[k] = ev.target.value;
    refreshPlace();
  });

  /* ---------- start ---------- */
  fetch('/api/store').then(function (r) { return r.json(); }).then(function (store) {
    state.store = store;
    // drop bag items that no longer exist
    Object.keys(state.cart).forEach(function (id) { if (!productById(id)) delete state.cart[id]; });
    render();
    if (!reduce) setTimeout(function () { state.introDone = true; var i = $('#intro'); if (i) i.remove(); }, 3700);
    else { var i = $('#intro'); if (i) i.remove(); }
  }).catch(function () {
    viewEl.innerHTML = '<main class="wrap page"><h1>BELA</h1><p class="muted">The store could not load. Please refresh the page.</p></main>';
  });
})();
