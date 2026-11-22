# BELA store

A complete online store: shop, bag, Google Pay / PhonePe checkout, and an admin page to manage orders, products and payment details. No packages to install. You only need Node.js 18 or newer (free, from nodejs.org).

## Run it on your computer

1. Install Node.js from https://nodejs.org
2. Open a terminal in this folder and run:

       node server.js

3. The first time, the terminal prints your admin password. Write it down.
4. Store:  http://localhost:3000
   Admin:  http://localhost:3000/admin

## Set up payments (do this first)

1. Open the admin page and log in.
2. Go to **Settings**.
3. Enter **your own UPI ID** (the one linked to your Google Pay or PhonePe account, like `name@okhdfcbank`), the name to show when paying, and your **WhatsApp number with country code** (for India start with 91).
4. Press **Save settings**. Customers can now pay.
5. Change the admin password in the same page.

Until a UPI ID is saved, the store refuses orders.

## How a customer pays, and how you get the money

1. The customer adds items to the bag and enters name, mobile and address.
2. They tap **Open Google Pay** or **Open PhonePe**. Their app opens with your UPI ID and the exact amount filled in.
3. They pay. The money goes **straight to your bank account**. This website never touches the money.
4. They type the UPI transaction ID from their payment and press **Place order**.
5. You see the order in **Admin > Orders** with that transaction ID.
6. Open your Google Pay or PhonePe app, find the payment with the same transaction ID, then set the order to **paid**. Ship only after you have seen the payment.

Important: this is a manual check. The website cannot confirm a payment by itself, because UPI apps do not tell a website that a payment happened. A customer could type a wrong or made-up ID, so always match it in your own app before shipping.
If you later want automatic payment confirmation, you need a payment gateway such as Razorpay, Cashfree or PhonePe Business, which needs a registered business account. I can add that when you have an account.

The "Open Google Pay / PhonePe" buttons work on phones. On a computer the customer can pay by sending the amount to your UPI ID.

## What you can do in Admin

- **Orders:** see every order, change its status (pending, paid, shipped, delivered, cancelled), download all orders as a CSV file for Excel.
- **Products:** add, edit, hide or delete products, change prices, mark sold out, upload photos (the second photo shows when a customer hovers).
- **Settings:** UPI ID, payee name, WhatsApp number, admin password.

Your data is saved in the `data` folder (orders.json, products.json, settings.json). Photos you upload go in `public/uploads`. **Back up both folders regularly.**

## Put it on the internet

The store needs a server that runs Node.js. Any of these work: a small VPS (DigitalOcean, Hostinger, AWS Lightsail), Render, Railway. Use a plan with a **persistent disk**, otherwise orders disappear when it restarts.

Settings you can give the server as environment variables:

| Name | What it does |
| --- | --- |
| `PORT` | Port to listen on (default 3000) |
| `ADMIN_PASSWORD` | Sets the admin password at start (use this on hosts where you cannot see the terminal) |
| `COOKIE_SECURE=1` | Turn on once the site uses https |
| `TRUST_PROXY=1` | Turn on when the host puts a proxy in front (Render, Railway, nginx) so login limits count real visitors |

Always serve the real site over **https**. Most hosts give this free. Without it, passwords and customer details travel unprotected.

## Folder guide

    server.js          the whole backend (orders, admin login, uploads)
    public/index.html  the store page
    public/app.js      store logic (bag, checkout)
    public/admin.html  admin page
    public/admin.js    admin logic
    public/style.css   cocoa dark theme
    public/images/     product photos and logo
    data/              products, orders, settings (created automatically)

## Things to know

- The prices, descriptions and the three clothing items are examples. Change them in Admin > Products.
- Customers' bag is kept in their own browser. Totals are always re-checked on the server from your prices, so nobody can change a price.
- Forgot the admin password? Stop the server, delete `data/admin.json`, start again. A new password is printed.
