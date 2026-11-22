/*
 * BELA store API on Netlify.
 * Orders, products, settings, the admin password and login sessions live in Netlify Database.
 * Uploaded product photos live in Netlify Blobs and are served from /uploads/<file>.
 */
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import crypto from "node:crypto";
import { and, asc, desc, eq, gt, lt, ne, sql } from "drizzle-orm";
import { getStore } from "@netlify/blobs";
import { db } from "../../db/index.ts";
import { admin, orders, products, rateHits, sessions, settings } from "../../db/schema.ts";

export const config = {
  path: ["/api/*", "/uploads/*"],
};

type HttpError = Error & { status?: number };
const httpError = (status: number, message: string): HttpError => Object.assign(new Error(message), { status });
const CATEGORIES = ["cosmetics", "jewellery", "clothing"];
const STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"];
const SESSION_MS = 8 * 3600 * 1000;

const uploads = () => getStore({ name: "uploads", consistency: "strong" });

/* ---------- admin password (stored hashed, never in plain text) ---------- */
const hashPassword = (pw: string, salt: Buffer) => crypto.scryptSync(String(pw), salt, 32);

async function setAdminPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  const row = { id: 1, salt: salt.toString("hex"), hash: hashPassword(pw, salt).toString("hex") };
  await db.insert(admin).values(row).onConflictDoUpdate({ target: admin.id, set: { salt: row.salt, hash: row.hash } });
}

async function checkAdminPassword(pw: string) {
  let [a] = await db.select().from(admin).where(eq(admin.id, 1));
  if (!a) {
    /* first login: the starting password comes from the ADMIN_PASSWORD environment variable */
    const first = process.env.ADMIN_PASSWORD;
    if (!first) throw httpError(503, "Admin password is not set up yet. Add ADMIN_PASSWORD in the Netlify project settings.");
    await setAdminPassword(first);
    [a] = await db.select().from(admin).where(eq(admin.id, 1));
  }
  const got = hashPassword(pw, Buffer.from(a.salt, "hex"));
  const want = Buffer.from(a.hash, "hex");
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

/* ---------- sessions and rate limits ---------- */
async function newSession() {
  const token = crypto.randomBytes(32).toString("hex");
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.insert(sessions).values({ token, expiresAt: new Date(Date.now() + SESSION_MS) });
  return token;
}

async function sessionToken(req: IncomingMessage) {
  const m = /(?:^|;\s*)bela_admin=([a-f0-9]{64})/.exec(req.headers.cookie || "");
  if (!m) return null;
  const [s] = await db.select().from(sessions).where(and(eq(sessions.token, m[1]), gt(sessions.expiresAt, new Date())));
  return s ? s.token : null;
}

async function limited(key: string, max: number, windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  await db.delete(rateHits).where(lt(rateHits.at, new Date(Date.now() - 24 * 3600 * 1000)));
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(rateHits)
    .where(and(eq(rateHits.key, key), gt(rateHits.at, since)));
  if (n >= max) return true;
  await db.insert(rateHits).values({ key });
  return false;
}

const clientIp = (req: IncomingMessage) =>
  String(req.headers["x-nf-client-connection-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();

/* ---------- request / response helpers ---------- */
function readBody(req: IncomingMessage, limit: number): Promise<any> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(httpError(413, "Request is too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(httpError(400, "Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const baseHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
};

function send(res: ServerResponse, status: number, body: unknown, extra?: Record<string, string>) {
  const isObj = typeof body === "object" && !Buffer.isBuffer(body);
  const payload = isObj ? JSON.stringify(body) : (body as string);
  res.writeHead(status, {
    ...baseHeaders,
    "Content-Type": isObj ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    ...(extra || {}),
  });
  res.end(payload);
}

/* ---------- validation ---------- */
function cleanText(v: unknown, min: number, max: number, label: string) {
  const s = String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (s.length < min) throw httpError(400, label + " is required");
  if (s.length > max) throw httpError(400, label + " is too long");
  return s;
}
const IMAGE_PATH = /^\/(images|uploads)\/[A-Za-z0-9._-]{1,120}$/;
function cleanProduct(b: any) {
  const name = cleanText(b.name, 2, 120, "Name");
  const note = cleanText(b.note || "", 0, 300, "Description");
  const category = String(b.category);
  if (!CATEGORIES.includes(category)) throw httpError(400, "Choose a category");
  const price = Math.round(Number(b.price));
  if (!(price >= 1 && price <= 1000000)) throw httpError(400, "Price must be between 1 and 1,000,000");
  const images = (Array.isArray(b.images) ? b.images : []).slice(0, 6).map(String);
  if (!images.every((u: string) => IMAGE_PATH.test(u))) throw httpError(400, "Invalid image path");
  return { name, note, category, price, images, active: b.active !== false, inStock: b.inStock !== false };
}
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "item";

function cleanSettings(b: any) {
  const upiId = String(b.upiId || "").trim();
  if (upiId && !/^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,30}$/.test(upiId))
    throw httpError(400, "UPI ID looks wrong. It should look like name@bank");
  const payeeName = cleanText(b.payeeName || "BELA", 1, 60, "Payee name").replace(/[&=?#%]/g, "");
  const whatsapp = String(b.whatsapp || "").replace(/\D/g, "");
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15))
    throw httpError(400, "WhatsApp number must be 10 to 15 digits, with country code (for India start with 91)");
  return { upiId, payeeName, whatsapp };
}

async function getSettings() {
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));
  return s || { id: 1, upiId: "", payeeName: "BELA", whatsapp: "" };
}

const publicProduct = (p: typeof products.$inferSelect) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  note: p.note,
  price: p.price,
  images: p.images,
  active: p.active,
  inStock: p.inStock,
});

const publicOrder = (o: typeof orders.$inferSelect) => ({
  ...o,
  createdAt: o.createdAt.toISOString(),
  updatedAt: o.updatedAt ? o.updatedAt.toISOString() : undefined,
});

/* ---------- orders ---------- */
async function createOrder(body: any, ip: string) {
  if (await limited("order:" + ip, 20, 3600 * 1000)) throw httpError(429, "Too many orders from this device. Please try again later.");
  const s = await getSettings();
  if (!s.upiId) throw httpError(503, "Payments are not set up yet. Please contact the store.");
  const name = cleanText(body.name, 2, 80, "Name");
  const phone = String(body.phone || "").replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 15) throw httpError(400, "Enter a valid mobile number");
  const address = cleanText(body.address, 6, 400, "Delivery address");
  const txn = cleanText(body.txn, 6, 40, "UPI transaction ID").toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(txn)) throw httpError(400, "Transaction ID can only have letters and numbers");
  const method = body.method === "phonepe" ? "phonepe" : "gpay";
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) throw httpError(400, "Your bag is empty");

  const all = await db.select().from(products);
  const items: { id: string; name: string; price: number; qty: number }[] = [];
  let total = 0;
  for (const it of body.items) {
    const p = all.find((x) => x.id === String(it.id));
    const qty = Math.floor(Number(it.qty));
    if (!p || !p.active) throw httpError(400, "An item in your bag is no longer available");
    if (!p.inStock) throw httpError(400, p.name + " is sold out");
    if (!(qty >= 1 && qty <= 20)) throw httpError(400, "Quantity must be between 1 and 20");
    items.push({ id: p.id, name: p.name, price: p.price, qty });
    total += p.price * qty;
  }
  const used = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.txn, txn), ne(orders.status, "cancelled")));
  if (used.length) throw httpError(409, "This transaction ID was already used for another order");

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = "BELA-" + crypto.randomInt(100000, 999999);
    const inserted = await db
      .insert(orders)
      .values({ id, status: "pending", name, phone, address, items, total, txn, method })
      .onConflictDoNothing()
      .returning({ id: orders.id });
    if (inserted.length) return { id, total, wa: s.whatsapp || "" };
  }
  throw httpError(500, "Could not create order");
}

/* ---------- image upload ---------- */
async function saveUpload(dataUrl: unknown) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) throw httpError(400, "Use a PNG, JPG or WebP image");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 4 * 1024 * 1024) throw httpError(413, "Image must be under 4 MB");
  const isPng = buf.length > 8 && buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isJpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isWebp = buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
  if (!((m[1] === "png" && isPng) || (m[1] === "jpeg" && isJpg) || (m[1] === "webp" && isWebp)))
    throw httpError(400, "That file is not a valid image");
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  const name = crypto.randomBytes(10).toString("hex") + "." + ext;
  const bytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  await uploads().set(name, bytes, { metadata: { type: "image/" + m[1] } });
  return "/uploads/" + name;
}

async function serveUpload(req: IncomingMessage, res: ServerResponse, pathname: string) {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
  const m = /^\/uploads\/([a-f0-9]{20}\.(png|jpg|webp))$/.exec(pathname);
  if (!m) return send(res, 404, "Not found");
  const blob = await uploads().getWithMetadata(m[1], { type: "arrayBuffer" });
  if (!blob) return send(res, 404, "Not found");
  const data = Buffer.from(blob.data);
  res.writeHead(200, {
    ...baseHeaders,
    "Content-Type": m[2] === "jpg" ? "image/jpeg" : "image/" + m[2],
    "Content-Length": String(data.length),
    "Cache-Control": "public, max-age=86400",
  });
  res.end(req.method === "HEAD" ? undefined : data);
}

/* ---------- API ---------- */
async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL) {
  const method = req.method;
  const p = url.pathname;
  const ip = clientIp(req);

  if (method !== "GET" && method !== "HEAD") {
    if (!/^application\/json/i.test(req.headers["content-type"] || "")) throw httpError(415, "JSON only");
  }

  if (method === "GET" && p === "/api/store") {
    const s = await getSettings();
    const list = await db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.position));
    return send(res, 200, { name: "BELA", upiId: s.upiId || "", payeeName: s.payeeName || "BELA", products: list.map(publicProduct) });
  }
  if (method === "POST" && p === "/api/orders") {
    const body = await readBody(req, 100 * 1024);
    return send(res, 201, await createOrder(body, ip));
  }
  if (method === "POST" && p === "/api/admin/login") {
    if (await limited("login:" + ip, 10, 10 * 60 * 1000)) throw httpError(429, "Too many attempts. Wait 10 minutes and try again.");
    const body = await readBody(req, 4 * 1024);
    if (!(await checkAdminPassword(body.password || ""))) throw httpError(401, "Wrong password");
    const token = await newSession();
    const cookie = "bela_admin=" + token + "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800";
    return send(res, 200, { ok: true }, { "Set-Cookie": cookie });
  }

  /* everything below needs a logged-in admin */
  if (!p.startsWith("/api/admin/")) throw httpError(404, "Not found");
  const token = await sessionToken(req);
  if (!token) throw httpError(401, "Please log in");

  if (method === "POST" && p === "/api/admin/logout") {
    await db.delete(sessions).where(eq(sessions.token, token));
    return send(res, 200, { ok: true }, { "Set-Cookie": "bela_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" });
  }
  if (method === "GET" && p === "/api/admin/orders") {
    const list = await db.select().from(orders).orderBy(desc(orders.createdAt));
    return send(res, 200, list.map(publicOrder));
  }
  let m = /^\/api\/admin\/orders\/(BELA-\d{6})$/.exec(p);
  if (m && method === "PATCH") {
    const body = await readBody(req, 4 * 1024);
    if (!STATUSES.includes(body.status)) throw httpError(400, "Unknown status");
    const [o] = await db.update(orders).set({ status: body.status, updatedAt: new Date() }).where(eq(orders.id, m[1])).returning();
    if (!o) throw httpError(404, "Order not found");
    return send(res, 200, publicOrder(o));
  }
  if (method === "GET" && p === "/api/admin/products") {
    const list = await db.select().from(products).orderBy(asc(products.position));
    return send(res, 200, list.map(publicProduct));
  }
  if (method === "POST" && p === "/api/admin/products") {
    const body = await readBody(req, 20 * 1024);
    const values = { id: slug(String(body.name || "")) + "-" + crypto.randomBytes(2).toString("hex"), ...cleanProduct(body) };
    const [prod] = await db.insert(products).values(values).returning();
    return send(res, 201, publicProduct(prod));
  }
  m = /^\/api\/admin\/products\/([a-z0-9-]{1,40})$/.exec(p);
  if (m && method === "PUT") {
    const body = await readBody(req, 20 * 1024);
    const [prod] = await db.update(products).set(cleanProduct(body)).where(eq(products.id, m[1])).returning();
    if (!prod) throw httpError(404, "Product not found");
    return send(res, 200, publicProduct(prod));
  }
  if (m && method === "DELETE") {
    const gone = await db.delete(products).where(eq(products.id, m[1])).returning({ id: products.id });
    if (!gone.length) throw httpError(404, "Product not found");
    return send(res, 200, { ok: true });
  }
  if (method === "POST" && p === "/api/admin/upload") {
    const body = await readBody(req, 6 * 1024 * 1024);
    return send(res, 201, { url: await saveUpload(body.dataUrl) });
  }
  if (method === "GET" && p === "/api/admin/settings") {
    const s = await getSettings();
    return send(res, 200, { upiId: s.upiId || "", payeeName: s.payeeName || "BELA", whatsapp: s.whatsapp || "" });
  }
  if (method === "PUT" && p === "/api/admin/settings") {
    const body = await readBody(req, 4 * 1024);
    const s = cleanSettings(body);
    await db.insert(settings).values({ id: 1, ...s }).onConflictDoUpdate({ target: settings.id, set: s });
    return send(res, 200, s);
  }
  if (method === "POST" && p === "/api/admin/password") {
    const body = await readBody(req, 4 * 1024);
    if (!(await checkAdminPassword(body.current || ""))) throw httpError(401, "Current password is wrong");
    const next = String(body.next || "");
    if (next.length < 8 || next.length > 100) throw httpError(400, "New password must be 8 to 100 characters");
    await setAdminPassword(next);
    /* log out every other session after a password change */
    await db.delete(sessions).where(ne(sessions.token, token));
    return send(res, 200, { ok: true });
  }
  throw httpError(404, "Not found");
}

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    if (url.pathname.startsWith("/uploads/")) return await serveUpload(req, res, url.pathname);
    return send(res, 404, "Not found");
  } catch (e) {
    const err = e as HttpError;
    const status = err.status || 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) send(res, status, { error: status === 500 ? "Something went wrong" : err.message });
  }
});

export default server;
