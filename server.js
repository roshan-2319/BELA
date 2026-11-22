'use strict';
/*
 * BELA store server. No npm packages needed, only Node.js 18 or newer.
 * Run:  node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const UPLOADS = path.join(PUBLIC, 'uploads');
const PORT = Number(process.env.PORT) || 3000;
const SECURE_COOKIE = process.env.COOKIE_SECURE === '1';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

/* ---------- small JSON file store ---------- */
const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')); } catch (e) { return fallback; }
};
const writeJson = (file, value) => {
  const target = path.join(DATA, file);
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, target);
};
if (!fs.existsSync(path.join(DATA, 'orders.json'))) writeJson('orders.json', []);
if (!fs.existsSync(path.join(DATA, 'settings.json'))) {
  writeJson('settings.json', { storeName: 'BELA', upiId: '', payeeName: 'BELA', whatsapp: '' });
}

/* ---------- admin password (stored hashed, never in plain text) ---------- */
const hashPassword = (pw, salt) => crypto.scryptSync(String(pw), salt, 32);
function setAdminPassword(pw) {
  const salt = crypto.randomBytes(16);
  writeJson('admin.json', { salt: salt.toString('hex'), hash: hashPassword(pw, salt).toString('hex') });
}
function checkAdminPassword(pw) {
  const a = readJson('admin.json', null);
  if (!a) return false;
  const got = hashPassword(pw, Buffer.from(a.salt, 'hex'));
  const want = Buffer.from(a.hash, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
if (process.env.ADMIN_PASSWORD) {
  setAdminPassword(process.env.ADMIN_PASSWORD);
  console.log('Admin password was set from the ADMIN_PASSWORD setting.');
} else if (!fs.existsSync(path.join(DATA, 'admin.json'))) {
  const first = crypto.randomBytes(7).toString('base64url');
  setAdminPassword(first);
  console.log('\n  FIRST RUN. Your admin password is:  ' + first);
  console.log('  Write it down, then change it in Admin > Settings.\n');
}

/* ---------- sessions and rate limits ---------- */
const sessions = new Map();
const newSession = () => {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + 8 * 3600 * 1000);
  return token;
};
const sessionToken = (req) => {
  const m = /(?:^|;\s*)bela_admin=([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (!m) return null;
  const exp = sessions.get(m[1]);
  if (!exp || exp < Date.now()) { sessions.delete(m[1]); return null; }
  return m[1];
};
const hits = new Map();
const limited = (key, max, windowMs) => {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now);
  hits.set(key, arr);
  return false;
};
const clientIp = (req) => {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
};

/* ---------- helpers ---------- */
const httpError = (status, message) => Object.assign(new Error(message), { status });
const CATEGORIES = ['cosmetics', 'jewellery', 'clothing'];
const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(httpError(413, 'Request is too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(httpError(400, 'Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'self'; " +
    "base-uri 'self'; frame-ancestors 'none'"
};

function send(res, status, body, extra) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  const payload = isObj ? JSON.stringify(body) : body;
  res.writeHead(status, Object.assign({}, baseHeaders, { 'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, extra || {}));
  res.end(payload);
}

/* ---------- validation ---------- */
function cleanText(v, min, max, label) {
  const s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (s.length < min) throw httpError(400, label + ' is required');
  if (s.length > max) throw httpError(400, label + ' is too long');
  return s;
}
const IMAGE_PATH = /^\/(images|uploads)\/[A-Za-z0-9._-]{1,120}$/;
function cleanProduct(b) {
  const name = cleanText(b.name, 2, 120, 'Name');
  const note = cleanText(b.note || '', 0, 300, 'Description');
  const category = String(b.category);
  if (!CATEGORIES.includes(category)) throw httpError(400, 'Choose a category');
  const price = Math.round(Number(b.price));
  if (!(price >= 1 && price <= 1000000)) throw httpError(400, 'Price must be between 1 and 1,000,000');
  const images = (Array.isArray(b.images) ? b.images : []).slice(0, 6).map(String);
  if (!images.every((u) => IMAGE_PATH.test(u))) throw httpError(400, 'Invalid image path');
  return { name, note, category, price, images, active: b.active !== false, inStock: b.inStock !== false };
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'item';

function cleanSettings(b) {
  const upiId = String(b.upiId || '').trim();
  if (upiId && !/^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,30}$/.test(upiId)) throw httpError(400, 'UPI ID looks wrong. It should look like name@bank');
  const payeeName = cleanText(b.payeeName || 'BELA', 1, 60, 'Payee name').replace(/[&=?#%]/g, '');
  const whatsapp = String(b.whatsapp || '').replace(/\D/g, '');
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) throw httpError(400, 'WhatsApp number must be 10 to 15 digits, with country code (for India start with 91)');
  return { storeName: 'BELA', upiId, payeeName, whatsapp };
}

/* ---------- orders ---------- */
function createOrder(body, ip) {
  if (limited('order:' + ip, 20, 3600 * 1000)) throw httpError(429, 'Too many orders from this device. Please try again later.');
  const settings = readJson('settings.json', {});
  if (!settings.upiId) throw httpError(503, 'Payments are not set up yet. Please contact the store.');
  const name = cleanText(body.name, 2, 80, 'Name');
  const phone = String(body.phone || '').replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 15) throw httpError(400, 'Enter a valid mobile number');
  const address = cleanText(body.address, 6, 400, 'Delivery address');
  const txn = cleanText(body.txn, 6, 40, 'UPI transaction ID').toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(txn)) throw httpError(400, 'Transaction ID can only have letters and numbers');
  const method = body.method === 'phonepe' ? 'phonepe' : 'gpay';
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) throw httpError(400, 'Your bag is empty');

  const products = readJson('products.json', []);
  const items = [];
  let total = 0;
  for (const it of body.items) {
    const p = products.find((x) => x.id === String(it.id));
    const qty = Math.floor(Number(it.qty));
    if (!p || !p.active) throw httpError(400, 'An item in your bag is no longer available');
    if (!p.inStock) throw httpError(400, p.name + ' is sold out');
    if (!(qty >= 1 && qty <= 20)) throw httpError(400, 'Quantity must be between 1 and 20');
    items.push({ id: p.id, name: p.name, price: p.price, qty });
    total += p.price * qty;
  }
  const orders = readJson('orders.json', []);
  if (orders.some((o) => o.txn === txn && o.status !== 'cancelled')) throw httpError(409, 'This transaction ID was already used for another order');
  let id;
  do { id = 'BELA-' + crypto.randomInt(100000, 999999); } while (orders.some((o) => o.id === id));
  const order = { id, createdAt: new Date().toISOString(), status: 'pending', name, phone, address, items, total, txn, method };
  orders.push(order);
  writeJson('orders.json', orders);
  return { id: order.id, total: order.total, wa: settings.whatsapp || '' };
}

/* ---------- image upload ---------- */
function saveUpload(dataUrl) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw httpError(400, 'Use a PNG, JPG or WebP image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 4 * 1024 * 1024) throw httpError(413, 'Image must be under 4 MB');
  const isPng = buf.length > 8 && buf.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isJpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isWebp = buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
  if (!((m[1] === 'png' && isPng) || (m[1] === 'jpeg' && isJpg) || (m[1] === 'webp' && isWebp))) throw httpError(400, 'That file is not a valid image');
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = crypto.randomBytes(10).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return '/uploads/' + name;
}

/* ---------- API ---------- */
async function handleApi(req, res, url) {
  const method = req.method;
  const p = url.pathname;
  const ip = clientIp(req);

  if (method !== 'GET' && method !== 'HEAD') {
    if (!/^application\/json/i.test(req.headers['content-type'] || '')) throw httpError(415, 'JSON only');
  }

  if (method === 'GET' && p === '/api/store') {
    const s = readJson('settings.json', {});
    const products = readJson('products.json', []).filter((x) => x.active);
    return send(res, 200, { name: s.storeName || 'BELA', upiId: s.upiId || '', payeeName: s.payeeName || 'BELA', products });
  }
  if (method === 'POST' && p === '/api/orders') {
    const body = await readBody(req, 100 * 1024);
    return send(res, 201, createOrder(body, ip));
  }
  if (method === 'POST' && p === '/api/admin/login') {
    if (limited('login:' + ip, 10, 10 * 60 * 1000)) throw httpError(429, 'Too many attempts. Wait 10 minutes and try again.');
    const body = await readBody(req, 4 * 1024);
    if (!checkAdminPassword(body.password || '')) throw httpError(401, 'Wrong password');
    const token = newSession();
    const cookie = 'bela_admin=' + token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800' + (SECURE_COOKIE ? '; Secure' : '');
    return send(res, 200, { ok: true }, { 'Set-Cookie': cookie });
  }

  /* everything below needs a logged-in admin */
  if (!p.startsWith('/api/admin/')) throw httpError(404, 'Not found');
  const token = sessionToken(req);
  if (!token) throw httpError(401, 'Please log in');

  if (method === 'POST' && p === '/api/admin/logout') {
    sessions.delete(token);
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'bela_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }
  if (method === 'GET' && p === '/api/admin/orders') {
    return send(res, 200, readJson('orders.json', []).slice().reverse());
  }
  let m = /^\/api\/admin\/orders\/(BELA-\d{6})$/.exec(p);
  if (m && method === 'PATCH') {
    const body = await readBody(req, 4 * 1024);
    if (!STATUSES.includes(body.status)) throw httpError(400, 'Unknown status');
    const orders = readJson('orders.json', []);
    const o = orders.find((x) => x.id === m[1]);
    if (!o) throw httpError(404, 'Order not found');
    o.status = body.status;
    o.updatedAt = new Date().toISOString();
    writeJson('orders.json', orders);
    return send(res, 200, o);
  }
  if (method === 'GET' && p === '/api/admin/products') return send(res, 200, readJson('products.json', []));
  if (method === 'POST' && p === '/api/admin/products') {
    const body = await readBody(req, 20 * 1024);
    const products = readJson('products.json', []);
    const prod = Object.assign({ id: slug(String(body.name || '')) + '-' + crypto.randomBytes(2).toString('hex') }, cleanProduct(body));
    products.push(prod);
    writeJson('products.json', products);
    return send(res, 201, prod);
  }
  m = /^\/api\/admin\/products\/([a-z0-9-]{1,40})$/.exec(p);
  if (m && method === 'PUT') {
    const body = await readBody(req, 20 * 1024);
    const products = readJson('products.json', []);
    const i = products.findIndex((x) => x.id === m[1]);
    if (i < 0) throw httpError(404, 'Product not found');
    products[i] = Object.assign({ id: m[1] }, cleanProduct(body));
    writeJson('products.json', products);
    return send(res, 200, products[i]);
  }
  if (m && method === 'DELETE') {
    const products = readJson('products.json', []);
    const next = products.filter((x) => x.id !== m[1]);
    if (next.length === products.length) throw httpError(404, 'Product not found');
    writeJson('products.json', next);
    return send(res, 200, { ok: true });
  }
  if (method === 'POST' && p === '/api/admin/upload') {
    const body = await readBody(req, 6 * 1024 * 1024);
    return send(res, 201, { url: saveUpload(body.dataUrl) });
  }
  if (method === 'GET' && p === '/api/admin/settings') {
    const s = readJson('settings.json', {});
    return send(res, 200, { upiId: s.upiId || '', payeeName: s.payeeName || 'BELA', whatsapp: s.whatsapp || '' });
  }
  if (method === 'PUT' && p === '/api/admin/settings') {
    const body = await readBody(req, 4 * 1024);
    const s = cleanSettings(body);
    writeJson('settings.json', s);
    return send(res, 200, { upiId: s.upiId, payeeName: s.payeeName, whatsapp: s.whatsapp });
  }
  if (method === 'POST' && p === '/api/admin/password') {
    const body = await readBody(req, 4 * 1024);
    if (!checkAdminPassword(body.current || '')) throw httpError(401, 'Current password is wrong');
    const next = String(body.next || '');
    if (next.length < 8 || next.length > 100) throw httpError(400, 'New password must be 8 to 100 characters');
    setAdminPassword(next);
    return send(res, 200, { ok: true });
  }
  throw httpError(404, 'Not found');
}

/* ---------- static files ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};
function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin') pathname = '/admin.html';
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (e) { return send(res, 400, 'Bad request'); }
  if (rel.includes('\0')) return send(res, 400, 'Bad request');
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 404, 'Not found');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext];
    if (!type) return send(res, 404, 'Not found');
    const isImage = type.startsWith('image/');
    res.writeHead(200, Object.assign({}, baseHeaders, {
      'Content-Type': type,
      'Content-Length': st.size,
      'Cache-Control': isImage ? 'public, max-age=86400' : 'no-cache'
    }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) send(res, status, { error: status === 500 ? 'Something went wrong' : e.message });
  }
});
server.listen(PORT, () => {
  console.log('BELA store running:  http://localhost:' + PORT);
  console.log('Admin page:          http://localhost:' + PORT + '/admin');
});
