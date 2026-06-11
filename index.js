console.log('>>> index.js STARTING');
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs = require('fs');

console.log(`\n████████ SERVER START ${new Date().toISOString()} ████████\n`);

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5500'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── API Routes ───────────────────────────────────────────────
console.log('>>> Loading routes...');
app.use('/api/auth',    require('./routes/auth'));
console.log('>>> auth route mounted');
app.use('/api/menu',    require('./routes/menu'));
console.log('>>> menu route mounted');
app.use('/api/orders',  require('./routes/orders'));
console.log('>>> orders route mounted');
app.use('/api/payment', require('./routes/payment'));
console.log('>>> payment route mounted');

// ─── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() }));

// ─── Serve frontend (production) ─────────────────────────────
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀  Saveur server running → http://localhost:${PORT}`));
