require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const app = express();
const port = Number(process.env.PORT) || 3000;
const adminPassword = process.env.ADMIN_PASSWORD;
const sessionSecret = process.env.ADMIN_SESSION_SECRET;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) app.set('trust proxy', 1);

if (!adminPassword || adminPassword.length < 12) {
  throw new Error('Set ADMIN_PASSWORD in .env to a unique value of at least 12 characters.');
}
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('Set ADMIN_SESSION_SECRET in .env to a random value of at least 32 characters.');
}

const menu = [
  { id: 'party-jollof-rice', name: 'Party Jollof Rice', price: 8500 },
  { id: 'beef-suya-platter', name: 'Beef Suya Platter', price: 10500 },
  { id: 'egusi-pounded-yam', name: 'Egusi & Pounded Yam', price: 9500 },
  { id: 'pepper-soup', name: 'Pepper Soup', price: 7500 },
  { id: 'yam-and-egg', name: 'Yam and Egg', price: 6500 },
  { id: 'puff-puff', name: 'Puff Puff', price: 3500 },
  { id: 'peppered-gizzard', name: 'Peppered Gizzard', price: 5000 },
  { id: 'fried-plantain', name: 'Fried Plantain', price: 2500 },
  { id: 'chin-chin', name: 'Chin Chin', price: 3000 },
  { id: 'coleslaw', name: 'Coleslaw', price: 2000 },
  { id: 'zobo-cooler', name: 'Zobo Cooler', price: 2500 },
  { id: 'chapman', name: 'Chapman', price: 3500 },
  { id: 'ginger-pineapple-juice', name: 'Ginger Pineapple Juice', price: 3000 },
  { id: 'bottled-water', name: 'Bottled Water', price: 1000 },
  { id: 'nigerian-lager', name: 'Nigerian Lager', price: 3500 }
];
const menuById = new Map(menu.map((item) => [item.id, item]));

const dataDirectory = process.env.DATA_DIR || path.join(__dirname, 'data');
const ordersFile = path.join(dataDirectory, 'orders.json');
fs.mkdirSync(dataDirectory, { recursive: true });
let orders = [];
try {
  orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
  if (!Array.isArray(orders)) throw new Error('The orders data file must contain an array.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

function saveOrders() {
  const temporaryFile = `${ordersFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(orders, null, 2), 'utf8');
  fs.renameSync(temporaryFile, ordersFile);
}

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));
app.use((req, res, next) => {
  if (/\.(?:db|db-shm|db-wal|json)$/i.test(req.path) || /(?:^|\/)(?:data|server\.js|package(?:-lock)?\.json|README\.md)(?:\/|$)/i.test(req.path)) {
    return res.sendStatus(404);
  }
  next();
});
app.use(express.static(__dirname, { index: 'index.html' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
});
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Order limit reached. Please try again later.' }
});

function safeEqual(left, right) {
  const leftHash = crypto.createHash('sha256').update(String(left)).digest();
  const rightHash = crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function signSession(expiresAt) {
  const payload = Buffer.from(JSON.stringify({ admin: true, expiresAt })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function isAdmin(req) {
  const token = req.cookies?.jh_admin;
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session.admin === true && session.expiresAt > Date.now();
  } catch {
    return false;
  }
}

// Parse only the signed admin cookie; no session state or customer data is stored in it.
app.use((req, _res, next) => {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)jh_admin=([^;]+)/);
  req.cookies = { jh_admin: match ? decodeURIComponent(match[1]) : '' };
  next();
});

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Please sign in as an administrator.' });
  next();
}

app.get('/api/menu', (_req, res) => res.json(menu));

app.post('/api/orders', orderLimiter, (req, res) => {
  const { name, email, phone = '', address, notes = '', items } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 120) {
    return res.status(400).json({ error: 'Enter a valid name.' });
  }
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (typeof phone !== 'string' || phone.length > 40 || typeof address !== 'string' || address.trim().length < 5 || address.length > 500) {
    return res.status(400).json({ error: 'Enter a valid phone number and delivery address.' });
  }
  if (typeof notes !== 'string' || notes.length > 1000 || !Array.isArray(items) || items.length < 1 || items.length > menu.length) {
    return res.status(400).json({ error: 'Your cart or order notes are invalid.' });
  }

  const normalizedItems = [];
  const seen = new Set();
  for (const requested of items) {
    const product = menuById.get(requested?.id);
    const quantity = Number(requested?.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 50 || seen.has(product.id)) {
      return res.status(400).json({ error: 'Your cart contains an invalid item or quantity.' });
    }
    seen.add(product.id);
    normalizedItems.push({ ...product, quantity, lineTotal: product.price * quantity });
  }

  const total = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  if (!Number.isSafeInteger(total) || total > 100000000) {
    return res.status(400).json({ error: 'Order total is outside the allowed range.' });
  }

  const order = {
    id: orders.reduce((highest, existing) => Math.max(highest, existing.id), 0) + 1,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    address: address.trim(),
    notes: notes.trim(),
    items: normalizedItems,
    total,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  saveOrders();
  res.status(201).json({ orderId: order.id, total, status: order.status });
});

app.post('/api/admin/login', loginLimiter, (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!safeEqual(password, adminPassword)) return res.status(401).json({ error: 'Incorrect password.' });
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  res.cookie('jh_admin', signSession(expiresAt), {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
  });
  res.json({ ok: true });
});

app.get('/api/admin/session', requireAdmin, (_req, res) => res.json({ authenticated: true }));
app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('jh_admin', { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/' });
  res.json({ ok: true });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  res.json([...orders].sort((left, right) => right.id - left.id).slice(0, 500));
});

app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const allowedStatuses = new Set(['pending', 'preparing', 'ready', 'completed', 'cancelled']);
  const orderId = Number(req.params.id);
  const status = req.body?.status;
  if (!Number.isInteger(orderId) || !allowedStatuses.has(status)) {
    return res.status(400).json({ error: 'Invalid order ID or status.' });
  }
  const order = orders.find((existing) => existing.id === orderId);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  order.status = status;
  saveOrders();
  res.json({ ok: true, id: orderId, status });
});

app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.listen(port, () => {
  console.log(`Jollof House server listening on port ${port}`);
});
