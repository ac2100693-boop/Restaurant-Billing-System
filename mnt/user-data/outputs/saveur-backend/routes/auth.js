const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const auth    = require('../middleware/auth');

/* ── POST /api/auth/login ── */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  try {
    const [rows] = await db.query('SELECT * FROM staff WHERE email = ? AND active = 1', [email]);
    const staff  = rows[0];
    if (!staff) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, staff.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: staff.id, name: staff.name, role: staff.role, email: staff.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      staff: { id: staff.id, name: staff.name, role: staff.role, email: staff.email }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /api/auth/me ── */
router.get('/me', auth, (req, res) => res.json({ staff: req.staff }));

/* ── POST /api/auth/register  (admin only) ── */
router.post('/register', auth, auth.adminOnly, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email, password required' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO staff (name, email, password, role) VALUES (?,?,?,?)',
      [name, email, hash, role || 'cashier']
    );
    res.status(201).json({ id: result.insertId, name, email, role: role || 'cashier' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /api/auth/staff  (list) ── */
router.get('/staff', auth, auth.adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id,name,email,role,active,created_at FROM staff ORDER BY id');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── PATCH /api/auth/staff/:id ── */
router.patch('/staff/:id', auth, auth.adminOnly, async (req, res) => {
  const { name, role, active } = req.body;
  try {
    await db.query('UPDATE staff SET name=COALESCE(?,name), role=COALESCE(?,role), active=COALESCE(?,active) WHERE id=?',
      [name, role, active, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
