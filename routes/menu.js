const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

/* ─────────────── CATEGORIES ─────────────── */

router.get('/categories', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM categories ORDER BY name');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/categories', auth, auth.adminOnly, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const [r] = await db.query('INSERT INTO categories (name) VALUES (?)', [name]);
    res.status(201).json({ id: r.insertId, name });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Category exists' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/categories/:id', auth, auth.adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ─────────────── MENU ITEMS ─────────────── */

// GET /api/menu  — full menu with category name
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT m.*, c.name AS category
      FROM   menu_items m
      JOIN   categories c ON c.id = m.category_id
      WHERE  m.available = 1
      ORDER  BY c.name, m.name
    `);
    // tags are already parsed by mysql2 from JSON type
    const items = rows.map(r => ({
      ...r,
      tags: Array.isArray(r.tags) ? r.tags : (r.tags ? JSON.parse(r.tags) : [])
    }));
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET all (admin — includes unavailable)
router.get('/all', auth, auth.adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT m.*, c.name AS category
      FROM   menu_items m
      JOIN   categories c ON c.id = m.category_id
      ORDER  BY c.name, m.name
    `);
    res.json(rows.map(r => ({
      ...r,
      tags: Array.isArray(r.tags) ? r.tags : (r.tags ? JSON.parse(r.tags) : [])
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/menu
router.post('/', auth, auth.adminOnly, async (req, res) => {
  const { name, description, category_id, price, emoji, tags } = req.body;
  if (!name || !category_id || !price)
    return res.status(400).json({ error: 'name, category_id, price required' });
  try {
    const [r] = await db.query(
      'INSERT INTO menu_items (name, description, category_id, price, emoji, tags) VALUES (?,?,?,?,?,?)',
      [name, description || '', category_id, price, emoji || '🍽️', JSON.stringify(tags || [])]
    );
    res.status(201).json({ id: r.insertId, name, category_id, price });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/menu/:id
router.put('/:id', auth, auth.adminOnly, async (req, res) => {
  const { name, description, category_id, price, emoji, tags, available } = req.body;
  try {
    await db.query(
      `UPDATE menu_items
       SET name=COALESCE(?,name), description=COALESCE(?,description),
           category_id=COALESCE(?,category_id), price=COALESCE(?,price),
           emoji=COALESCE(?,emoji), tags=COALESCE(?,tags),
           available=COALESCE(?,available)
       WHERE id=?`,
      [name, description, category_id, price, emoji,
       tags ? JSON.stringify(tags) : null, available, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/menu/:id
router.delete('/:id', auth, auth.adminOnly, async (req, res) => {
  try {
    await db.query('UPDATE menu_items SET available = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
