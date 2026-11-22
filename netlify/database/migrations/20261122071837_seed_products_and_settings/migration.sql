INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('kvc', 'Vitamin C Face Wash', 'cosmetics', 'Simply natural glowing, 100 ml', 349, '["/images/kriya-vitamin-c-face-wash.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('wbs', 'Whitening and Brightening Face Serum', 'cosmetics', '3% alpha arbutin, vitamin C, AHA and licorice extract, 30 ml', 699, '["/images/whitening-serum.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('agf', 'Aqua Glow Face Wash', 'cosmetics', 'Hydrates deeply, reveals a fresh glow, 100 ml', 299, '["/images/aqua-glow-face-wash.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('chc', 'Charcoal Face Wash', 'cosmetics', 'Purifies pores, removes dirt and excess oil, 100 ml', 299, '["/images/charcoal-face-wash.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('bgs', 'Beard Growth Face Serum', 'cosmetics', '30 ml', 599, '["/images/beard-growth-serum.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('adc', 'Almond Day Cream', 'cosmetics', 'Nourishes and protects skin with lasting hydration and a radiant finish', 499, '["/images/almond-day-cream.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('ebr', 'Eyebrow Growth Roll On', 'cosmetics', 'Stimulates fuller, denser brows naturally, 10 ml', 349, '["/images/eyebrow-roll-on.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('uer', 'Under Eye Roll On', 'cosmetics', 'Cooling care to depuff and refresh tired eyes, 10 ml', 349, '["/images/under-eye-roll-on.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('gtl', 'Green Tea Body Lotion', 'cosmetics', 'Calms, hydrates and refreshes sensitive skin, 200 ml', 399, '["/images/green-tea-body-lotion.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('abl', 'Almond Body Lotion', 'cosmetics', 'Softens and nourishes dry, rough skin, 200 ml', 399, '["/images/almond-body-lotion.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('egs', 'Egg Protein Shampoo', 'cosmetics', 'Repairs and strengthens weak, damaged hair, 200 ml', 349, '["/images/egg-protein-shampoo.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('krs', 'Korean Rice Shampoo', 'cosmetics', 'Strengthens and softens with rice protein, 200 ml', 349, '["/images/korean-rice-shampoo.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('hbs', 'Hibiscus Shampoo', 'cosmetics', 'Promotes growth and adds silky shine, 200 ml', 349, '["/images/hibiscus-shampoo.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('skb', 'Shikakai Bhringraj Shampoo', 'cosmetics', 'Cleanses and strengthens for healthy roots, 200 ml', 349, '["/images/shikakai-bhringraj-shampoo.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('has', 'Honey and Almond Shampoo', 'cosmetics', '300 ml', 449, '["/images/honey-almond-shampoo.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('ajs', 'Aloe Jojoba Shampoo', 'cosmetics', '300 ml', 449, '["/images/aloe-jojoba-shampoo.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('jho', 'Jadibuti Hair Oil', 'cosmetics', 'Herbal repair oil for long, strong hair, 100 ml', 399, '["/images/jadibuti-hair-oil.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('hbo', 'Hair Booster Hair Oil', 'cosmetics', 'Multi-oil blend for intense hair nourishment, 100 ml', 399, '["/images/hair-booster-oil.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('jhk', 'Temple Jhumka Earrings', 'jewellery', 'Gold-tone finish with ruby-red and green stones', 1899, '["/images/jhumka-studio.jpg", "/images/jhumka-cloth.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('pnk', 'Pearl and Ruby Necklace Set', 'jewellery', 'Pearl chain with ruby-red pendant, matching studs included', 2299, '["/images/necklace-white.jpg", "/images/necklace-model.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('brc', 'Pearl and Gemstone Bracelet', 'jewellery', 'Gold-tone chain, pearl, green and red stones, adjustable clasp', 1299, '["/images/bracelet-white.jpg", "/images/bracelet-brown.jpg"]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('cos', 'Linen Co-ord Set', 'clothing', 'Top and trousers, S to XL', 2499, '[]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('drs', 'Wrap Midi Dress', 'clothing', 'Soft crepe, S to XL', 1899, '[]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO products (id, name, category, note, price, images, active, in_stock) VALUES ('kur', 'Everyday Cotton Kurti', 'clothing', 'Straight cut, S to XL', 1099, '[]'::jsonb, true, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO settings (id, upi_id, payee_name, whatsapp) VALUES (1, 'roshanbalar0@oksbi', 'BELA', '919016252650') ON CONFLICT (id) DO NOTHING;
