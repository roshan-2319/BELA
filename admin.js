'use strict';
(function () {
  var app = document.getElementById('app');
  var logoutBtn = document.getElementById('logoutBtn');
  var CATS = [['cosmetics', 'Cosmetics'], ['jewellery', 'Jewellery'], ['clothing', 'Clothing']];
  var STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
  var st = { tab: 'orders', orders: [], products: [], settings: {}, editing: null, msg: '', filter: 'all' };

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var rupee = function (n) { return '₹' + Number(n).toLocaleString('en-IN'); };

  function api(method, url, body) {
    return fetch(url, { method: method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401 && url !== '/api/admin/login') { showLogin(); throw new Error('login'); }
          if (!r.ok) throw new Error(j.error || 'Something went wrong');
          return j;
        });
      });
  }

  /* ---------- login ---------- */
  function showLogin(err) {
    logoutBtn.hidden = true;
    app.innerHTML = '<div class="panel login"><h2>Admin login</h2><div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password"></div>' +
      '<div class="error" id="loginErr" role="alert">' + esc(err || '') + '</div><button class="btn" id="loginBtn">Log in</button></div>';
    var go = function () {
      var pw = document.getElementById('pw').value;
      api('POST', '/api/admin/login', { password: pw }).then(load).catch(function (e) { if (e.message !== 'login') document.getElementById('loginErr').textContent = e.message; });
    };
    document.getElementById('loginBtn').onclick = go;
    document.getElementById('pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    document.getElementById('pw').focus();
  }
  logoutBtn.onclick = function () { api('POST', '/api/admin/logout', {}).then(function () { showLogin(); }); };

  function load() {
    return Promise.all([api('GET', '/api/admin/orders'), api('GET', '/api/admin/products'), api('GET', '/api/admin/settings')]).then(function (r) {
      st.orders = r[0]; st.products = r[1]; st.settings = r[2];
      logoutBtn.hidden = false;
      render();
    }).catch(function (e) { if (e.message !== 'login') app.innerHTML = '<p class="error">' + esc(e.message) + '</p>'; });
  }

  /* ---------- layout ---------- */
  function render() {
    var tabs = [['orders', 'Orders'], ['products', 'Products'], ['settings', 'Settings']];
    app.innerHTML = '<div class="tabs" role="tablist">' + tabs.map(function (t) {
      return '<button class="tab" data-tab="' + t[0] + '" aria-pressed="' + (st.tab === t[0]) + '">' + t[1] + (t[0] === 'orders' ? ' (' + st.orders.filter(function (o) { return o.status === 'pending'; }).length + ' new)' : '') + '</button>';
    }).join('') + '</div><div id="panel"></div>';
    var p = document.getElementById('panel');
    if (st.tab === 'orders') ordersView(p);
    else if (st.tab === 'products') productsView(p);
    else settingsView(p);
  }

  /* ---------- orders ---------- */
  function ordersView(p) {
    var paidTotal = st.orders.filter(function (o) { return o.status !== 'cancelled'; }).reduce(function (a, o) { return a + o.total; }, 0);
    var list = st.orders.filter(function (o) { return st.filter === 'all' || o.status === st.filter; });
    p.innerHTML = '<div class="stats">' +
      '<div class="stat"><b>' + st.orders.length + '</b><span>Total orders</span></div>' +
      '<div class="stat"><b>' + st.orders.filter(function (o) { return o.status === 'pending'; }).length + '</b><span>Waiting for payment check</span></div>' +
      '<div class="stat"><b>' + rupee(paidTotal) + '</b><span>Order value (not cancelled)</span></div></div>' +
      '<div class="notice" style="margin-bottom:16px">Open your Google Pay or PhonePe app, find the payment with the same UPI transaction ID, then mark the order <b>paid</b>. Only ship after that.</div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px"><label for="ofilter" class="muted">Show</label><select id="ofilter"><option value="all">All orders</option>' +
      STATUSES.map(function (s) { return '<option value="' + s + '"' + (st.filter === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
      '<button class="mini" id="exportBtn">Download orders (CSV)</button></div>' +
      (list.length ? '<div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>UPI transaction ID</th><th>Status</th></tr></thead><tbody>' +
        list.map(function (o) {
          return '<tr><td><b>' + esc(o.id) + '</b><br><span class="muted">' + esc(new Date(o.createdAt).toLocaleString('en-IN')) + '</span></td>' +
            '<td>' + esc(o.name) + '<br><a href="tel:' + esc(o.phone) + '">' + esc(o.phone) + '</a><br><span class="muted">' + esc(o.address) + '</span></td>' +
            '<td>' + o.items.map(function (i) { return esc(i.name) + ' × ' + i.qty; }).join('<br>') + '</td>' +
            '<td>' + rupee(o.total) + '<br><span class="muted">' + esc(o.method === 'phonepe' ? 'PhonePe' : 'Google Pay') + '</span></td>' +
            '<td>' + esc(o.txn) + '</td>' +
            '<td><span class="pill ' + esc(o.status) + '">' + esc(o.status) + '</span><br><select data-order="' + esc(o.id) + '" aria-label="Change status of ' + esc(o.id) + '" style="margin-top:6px">' +
            STATUSES.map(function (s) { return '<option' + (s === o.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="empty">No orders yet.</p>');
    document.getElementById('ofilter').onchange = function (e) { st.filter = e.target.value; render(); };
    document.getElementById('exportBtn').onclick = exportCsv;
    Array.prototype.forEach.call(p.querySelectorAll('select[data-order]'), function (sel) {
      sel.onchange = function () {
        api('PATCH', '/api/admin/orders/' + sel.dataset.order, { status: sel.value }).then(function (o) {
          st.orders = st.orders.map(function (x) { return x.id === o.id ? o : x; }); render();
        }).catch(function (e) { if (e.message !== 'login') alert(e.message); });
      };
    });
  }
  function exportCsv() {
    var q = function (v) { var s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    var rows = [['Order', 'Date', 'Status', 'Name', 'Phone', 'Address', 'Items', 'Total', 'Method', 'UPI transaction ID']];
    st.orders.forEach(function (o) {
      rows.push([o.id, o.createdAt, o.status, o.name, o.phone, o.address, o.items.map(function (i) { return i.name + ' x ' + i.qty; }).join('; '), o.total, o.method, o.txn]);
    });
    var blob = new Blob(['﻿' + rows.map(function (r) { return r.map(q).join(','); }).join('\n')], { type: 'text/csv' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bela-orders.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- products ---------- */
  function productsView(p) {
    if (st.editing) return productForm(p);
    p.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:24px 0 12px"><h2 class="serif" style="font-size:32px">Products (' + st.products.length + ')</h2><button class="btn" id="addProd" style="min-height:44px">Add product</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Shown</th><th>Stock</th><th></th></tr></thead><tbody>' +
      st.products.map(function (x) {
        return '<tr><td>' + (x.images[0] ? '<img class="row-thumb" src="' + esc(x.images[0]) + '" alt="">' : '') + '</td><td>' + esc(x.name) + '</td><td>' + esc(x.category) + '</td><td>' + rupee(x.price) + '</td>' +
          '<td>' + (x.active ? 'Yes' : 'Hidden') + '</td><td>' + (x.inStock ? 'In stock' : 'Sold out') + '</td>' +
          '<td><div class="row-actions"><button class="mini" data-edit="' + esc(x.id) + '">Edit</button><button class="mini danger" data-del="' + esc(x.id) + '">Delete</button></div></td></tr>';
      }).join('') + '</tbody></table></div>';
    document.getElementById('addProd').onclick = function () { st.editing = { id: null, name: '', note: '', category: 'cosmetics', price: '', images: [], active: true, inStock: true }; render(); };
    Array.prototype.forEach.call(p.querySelectorAll('[data-edit]'), function (b) {
      b.onclick = function () { var x = st.products.find(function (y) { return y.id === b.dataset.edit; }); st.editing = JSON.parse(JSON.stringify(x)); render(); };
    });
    Array.prototype.forEach.call(p.querySelectorAll('[data-del]'), function (b) {
      b.onclick = function () {
        if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Tap again to delete'; setTimeout(function () { b.dataset.armed = ''; b.textContent = 'Delete'; }, 4000); return; }
        api('DELETE', '/api/admin/products/' + b.dataset.del).then(function () { st.products = st.products.filter(function (y) { return y.id !== b.dataset.del; }); render(); })
          .catch(function (e) { if (e.message !== 'login') alert(e.message); });
      };
    });
  }

  function productForm(p) {
    var e = st.editing;
    p.innerHTML = '<div class="box"><h2 class="serif">' + (e.id ? 'Edit product' : 'Add product') + '</h2>' +
      '<div class="form-grid">' +
      '<div class="field"><label for="pn">Name</label><input id="pn" value="' + esc(e.name) + '" maxlength="120"></div>' +
      '<div class="field"><label for="pp">Price (₹)</label><input id="pp" type="number" min="1" step="1" inputmode="numeric" value="' + esc(e.price) + '"></div>' +
      '<div class="field"><label for="pc">Category</label><select id="pc" style="min-height:48px">' + CATS.map(function (c) { return '<option value="' + c[0] + '"' + (e.category === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label for="pd">Description</label><textarea id="pd" rows="3" maxlength="300">' + esc(e.note) + '</textarea></div>' +
      '<div class="field"><span class="label">Photos (the second photo shows when a customer hovers)</span><div class="thumbs" id="thumbs"></div>' +
      '<div><label class="btn outline" style="min-height:44px;cursor:pointer">Add photo<input id="pf" type="file" accept="image/png,image/jpeg,image/webp" hidden></label></div></div>' +
      '<div class="checks"><label><input id="pa" type="checkbox"' + (e.active ? ' checked' : '') + '> Show in the store</label><label><input id="ps" type="checkbox"' + (e.inStock ? ' checked' : '') + '> In stock</label></div>' +
      '<div class="error" id="perr" role="alert"></div>' +
      '<div class="row-actions"><button class="btn" id="saveProd">Save</button><button class="btn outline" id="cancelProd">Cancel</button></div></div>';
    var thumbs = function () {
      document.getElementById('thumbs').innerHTML = e.images.map(function (u, i) {
        return '<div class="th"><img src="' + esc(u) + '" alt=""><button data-rm="' + i + '" aria-label="Remove photo">×</button></div>';
      }).join('') || '<span class="muted">No photos yet</span>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-rm]'), function (b) { b.onclick = function () { e.images.splice(Number(b.dataset.rm), 1); thumbs(); }; });
    };
    thumbs();
    var err = document.getElementById('perr');
    document.getElementById('pf').onchange = function (ev) {
      var f = ev.target.files[0]; if (!f) return;
      if (e.images.length >= 6) { err.textContent = 'Up to 6 photos'; return; }
      downsize(f).then(function (dataUrl) { return api('POST', '/api/admin/upload', { dataUrl: dataUrl }); })
        .then(function (r) { e.images.push(r.url); err.textContent = ''; thumbs(); })
        .catch(function (x) { if (x.message !== 'login') err.textContent = x.message; });
      ev.target.value = '';
    };
    document.getElementById('cancelProd').onclick = function () { st.editing = null; render(); };
    document.getElementById('saveProd').onclick = function () {
      var body = {
        name: document.getElementById('pn').value, price: Number(document.getElementById('pp').value), category: document.getElementById('pc').value,
        note: document.getElementById('pd').value, images: e.images, active: document.getElementById('pa').checked, inStock: document.getElementById('ps').checked
      };
      api(e.id ? 'PUT' : 'POST', '/api/admin/products' + (e.id ? '/' + e.id : ''), body).then(function (saved) {
        if (e.id) st.products = st.products.map(function (x) { return x.id === saved.id ? saved : x; }); else st.products.push(saved);
        st.editing = null; render();
      }).catch(function (x) { if (x.message !== 'login') err.textContent = x.message; });
    };
  }

  /* shrink big phone photos before upload */
  function downsize(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1100, s = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That file is not an image')); };
      img.src = url;
    });
  }

  /* ---------- settings ---------- */
  function settingsView(p) {
    var s = st.settings;
    p.innerHTML = '<div class="box"><h2 class="serif">Payment and contact</h2>' +
      '<p class="muted" style="margin:0">Customers pay straight to this UPI ID, so use the one linked to your own Google Pay or PhonePe account.</p>' +
      '<div class="form-grid">' +
      '<div class="field"><label for="su">Your UPI ID</label><input id="su" value="' + esc(s.upiId) + '" placeholder="name@bank" autocomplete="off"></div>' +
      '<div class="field"><label for="sn">Name shown when paying</label><input id="sn" value="' + esc(s.payeeName) + '" maxlength="60"></div>' +
      '<div class="field"><label for="sw">WhatsApp number with country code (91 for India)</label><input id="sw" value="' + esc(s.whatsapp) + '" placeholder="919876543210" inputmode="numeric"></div></div>' +
      '<div class="error" id="serr" role="alert"></div><div class="ok" id="sok"></div><div><button class="btn" id="saveSet">Save settings</button></div></div>' +
      '<div class="box"><h2 class="serif">Change admin password</h2><div class="form-grid">' +
      '<div class="field"><label for="pc1">Current password</label><input id="pc1" type="password" autocomplete="current-password"></div>' +
      '<div class="field"><label for="pc2">New password (8 or more characters)</label><input id="pc2" type="password" autocomplete="new-password"></div></div>' +
      '<div class="error" id="werr" role="alert"></div><div class="ok" id="wok"></div><div><button class="btn outline" id="savePw">Change password</button></div></div>';
    document.getElementById('saveSet').onclick = function () {
      var body = { upiId: document.getElementById('su').value, payeeName: document.getElementById('sn').value, whatsapp: document.getElementById('sw').value };
      document.getElementById('sok').textContent = ''; document.getElementById('serr').textContent = '';
      api('PUT', '/api/admin/settings', body).then(function (r) { st.settings = r; document.getElementById('sok').textContent = 'Saved. The store now uses these details.'; })
        .catch(function (e) { if (e.message !== 'login') document.getElementById('serr').textContent = e.message; });
    };
    document.getElementById('savePw').onclick = function () {
      document.getElementById('wok').textContent = ''; document.getElementById('werr').textContent = '';
      api('POST', '/api/admin/password', { current: document.getElementById('pc1').value, next: document.getElementById('pc2').value })
        .then(function () { document.getElementById('wok').textContent = 'Password changed.'; document.getElementById('pc1').value = ''; document.getElementById('pc2').value = ''; })
        .catch(function (e) { if (e.message !== 'login') document.getElementById('werr').textContent = e.message; });
    };
  }

  app.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-tab]');
    if (t) { st.tab = t.dataset.tab; st.editing = null; render(); }
  });

  api('GET', '/api/admin/settings').then(load).catch(function (e) { if (e.message === 'login') return; app.innerHTML = '<p class="error">' + esc(e.message) + '</p>'; });
  if (!app.innerHTML) showLogin();
})();
