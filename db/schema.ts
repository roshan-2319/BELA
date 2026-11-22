import { pgTable, text, integer, boolean, jsonb, timestamp, serial, index } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: text().primaryKey(),
  name: text().notNull(),
  category: text().notNull(),
  note: text().notNull().default(""),
  price: integer().notNull(),
  images: jsonb().$type<string[]>().notNull().default([]),
  active: boolean().notNull().default(true),
  inStock: boolean("in_stock").notNull().default(true),
  position: serial().notNull(),
});

export const orders = pgTable(
  "orders",
  {
    id: text().primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    status: text().notNull().default("pending"),
    name: text().notNull(),
    phone: text().notNull(),
    address: text().notNull(),
    items: jsonb().$type<{ id: string; name: string; price: number; qty: number }[]>().notNull(),
    total: integer().notNull(),
    txn: text().notNull(),
    method: text().notNull(),
  },
  (t) => [index("orders_txn_idx").on(t.txn)]
);

/* single-row tables keyed by id = 1 */
export const settings = pgTable("settings", {
  id: integer().primaryKey(),
  upiId: text("upi_id").notNull().default(""),
  payeeName: text("payee_name").notNull().default("BELA"),
  whatsapp: text().notNull().default(""),
});

export const admin = pgTable("admin", {
  id: integer().primaryKey(),
  salt: text().notNull(),
  hash: text().notNull(),
});

export const sessions = pgTable("sessions", {
  token: text().primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const rateHits = pgTable(
  "rate_hits",
  {
    id: serial().primaryKey(),
    key: text().notNull(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rate_hits_key_at_idx").on(t.key, t.at)]
);
