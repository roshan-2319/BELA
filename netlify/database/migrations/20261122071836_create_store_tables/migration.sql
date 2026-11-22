CREATE TABLE "admin" (
	"id" integer PRIMARY KEY,
	"salt" text NOT NULL,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"items" jsonb NOT NULL,
	"total" integer NOT NULL,
	"txn" text NOT NULL,
	"method" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"images" jsonb DEFAULT '[]' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"in_stock" boolean DEFAULT true NOT NULL,
	"position" serial
);
--> statement-breakpoint
CREATE TABLE "rate_hits" (
	"id" serial PRIMARY KEY,
	"key" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY,
	"upi_id" text DEFAULT '' NOT NULL,
	"payee_name" text DEFAULT 'BELA' NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "orders_txn_idx" ON "orders" ("txn");--> statement-breakpoint
CREATE INDEX "rate_hits_key_at_idx" ON "rate_hits" ("key","at");