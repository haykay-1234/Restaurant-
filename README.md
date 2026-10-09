# Jollof House ordering backend

This project now runs as a small Node.js app with persistent order storage, a browser-persisted cart, checkout, and an administrator dashboard.

## Run locally

1. Install Node.js 20.19+ (or Node.js 22.12+).
2. In this folder, run `npm install`.
3. A local `.env` is included for development. Run `npm start` and open `http://localhost:3000`.
4. Open `http://localhost:3000/admin`; the generated local admin password is in `.env`.

The `.env` file is ignored by Git. Never deploy with the local development credentials.

Orders are stored in `data/orders.json`. The data directory is ignored by Git and writes are atomic. The menu prices and allowed items are enforced by the server, not trusted from the browser. This file-backed store suits a single small server; use managed PostgreSQL for concurrent or multi-instance production deployments.

## Paystack payments

Checkout initializes a Paystack hosted payment page from the server. The server calculates the amount from its own menu prices, stores an order as unpaid, and marks it paid only after server-to-server Paystack verification. Card details are never sent to or stored by this app.

1. Create a Paystack account and copy its **Secret Key** from the API Keys & Webhooks settings. Start with a test key (`sk_test_...`).
2. Add `PAYSTACK_SECRET_KEY=sk_test_...` to your local `.env`. Never put a secret key in browser JavaScript, commit it, or share it in chat. Restart `npm start` after changing `.env`.
3. In Paystack's dashboard, configure the webhook URL as `https://your-public-site/api/paystack/webhook`. For a custom domain or a deployment whose request host differs from the public URL, set `PUBLIC_APP_URL` to the public site base URL (for example, `https://orders.example.com`).
4. Test a complete order using Paystack test mode. Switch to the live secret key only after completing Paystack's account activation and testing; keep it in the host's secret environment settings.

The customer's browser returns to the site and the server verifies the transaction reference, amount, and currency with Paystack. The signed webhook provides a second confirmation path if the customer closes the browser before returning.

## Publish the website

The included `render.yaml` deploys both the website and its API together, so customers use one public URL and the cart does not need a separate API address.

1. Push this project to a GitHub repository. Keep `.env` and `data/` out of Git; they are ignored.
2. In Render, create a **Blueprint** and connect that GitHub repository. Render will read `render.yaml` and create the Node web service plus a persistent disk for orders.
3. When prompted, enter a unique `ADMIN_PASSWORD` of at least 12 characters and the Paystack `PAYSTACK_SECRET_KEY`. Render generates `ADMIN_SESSION_SECRET` for you. Do not use local credentials or a test key for live payments.
4. Wait for the service health check to pass, then open the `onrender.com` URL Render assigns. The admin dashboard is at that URL followed by `/admin`.
5. In Render's service settings, add your own domain if desired and follow its DNS/HTTPS instructions.

The Render `starter` service and persistent disk may incur charges; check current Render pricing before deploying. Keep the disk attached and back up its `/var/data/orders.json` file. The admin login uses rate limiting and a signed, HttpOnly, same-site cookie. The service only accepts orders when it is deployed and healthy; its health endpoint is `/api/health`.
