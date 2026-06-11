const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

/* ─── POST /api/orders  (create new order) ─── */
router.post('/', auth, async (req, res) => {
  const {
    customer_name, customer_phone, order_type, table_no,
    items,                         // [{menu_item_id, name, price, qty}]
    discount, gst_pct, payment_mode
  } = req.body;

  if (!items || !items.length)
    return res.status(400).json({ error: 'No items in order' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Calculate totals
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const disc     = parseFloat(discount) || 0;
    const taxable  = subtotal - disc;
    const gst      = taxable * (parseFloat(gst_pct) || 0) / 100;
    const grand    = taxable + gst;

    // Generate bill number
    const d   = new Date();
    const rnd = Math.floor(Math.random() * 9000) + 1000;
    const bill_no = `SAV${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${rnd}`;

    // Insert order
    const [orderResult] = await conn.query(
      `INSERT INTO orders
         (bill_no,customer_name,customer_phone,order_type,table_no,
          subtotal,discount,gst,grand_total,payment_mode,staff_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [bill_no, customer_name || 'Guest', customer_phone || null,
       order_type || 'Dine In', table_no || null,
       subtotal, disc, gst, grand,
       payment_mode || 'Cash', req.staff.id]
    );

    const orderId = orderResult.insertId;

    // Insert order items
    for (const it of items) {
      await conn.query(
        'INSERT INTO order_items (order_id,menu_item_id,name,price,qty,total) VALUES (?,?,?,?,?,?)',
        [orderId, it.menu_item_id, it.name, it.price, it.qty, it.price * it.qty]
      );
    }

    await conn.commit();
    res.status(201).json({ id: orderId, bill_no, grand_total: grand.toFixed(2) });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/* ─── GET /api/orders  (paginated list) ─── */
router.get('/', auth, async (req, res) => {
  const { page = 1, limit = 20, date, search, payment_mode } = req.query;
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params = [];

  if (date) {
    where += ' AND DATE(o.created_at) = ?';
    params.push(date);
  }
  if (search) {
    where += ' AND (o.bill_no LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (payment_mode) {
    where += ' AND o.payment_mode = ?';
    params.push(payment_mode);
  }

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM orders o ${where}`, params);

    const [rows] = await db.query(
      `SELECT o.*, s.name AS staff_name
       FROM   orders o
       LEFT   JOIN staff s ON s.id = o.staff_id
       ${where}
       ORDER  BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({ total, page: +page, pages: Math.ceil(total / limit), orders: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ─── GET /api/orders/:id  (single with items) ─── */
router.get('/:id', auth, async (req, res) => {
  try {
    const [[order]] = await db.query(
      `SELECT o.*, s.name AS staff_name
       FROM orders o LEFT JOIN staff s ON s.id = o.staff_id
       WHERE o.id = ?`, [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const [items] = await db.query(
      'SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);

    res.json({ ...order, items });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ─── GET /api/orders/reports/summary  (dashboard stats) ─── */
router.get('/reports/summary', auth, auth.adminOnly, async (req, res) => {
  try {
    const [[today]] = await db.query(`
      SELECT
        COUNT(*)                                   AS total_orders,
        COALESCE(SUM(grand_total),0)               AS total_revenue,
        COALESCE(AVG(grand_total),0)               AS avg_order,
        SUM(payment_mode='Cash')                   AS cash_orders,
        SUM(payment_mode='Card')                   AS card_orders,
        SUM(payment_mode='UPI')                    AS upi_orders
      FROM orders
      WHERE DATE(created_at) = CURDATE()
    `);

    const [[month]] = await db.query(`
      SELECT
        COUNT(*)                    AS total_orders,
        COALESCE(SUM(grand_total),0) AS total_revenue
      FROM orders
      WHERE MONTH(created_at) = MONTH(CURDATE())
        AND YEAR(created_at)  = YEAR(CURDATE())
    `);

    // Last 7 days trend
    const [trend] = await db.query(`
      SELECT
        DATE(created_at)             AS date,
        COUNT(*)                     AS orders,
        COALESCE(SUM(grand_total),0) AS revenue
      FROM orders
      WHERE created_at >= CURDATE() - INTERVAL 6 DAY
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    // Top selling items
    const [topItems] = await db.query(`
      SELECT oi.name, SUM(oi.qty) AS total_qty, SUM(oi.total) AS total_revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at >= CURDATE() - INTERVAL 29 DAY
      GROUP BY oi.name
      ORDER BY total_qty DESC
      LIMIT 8
    `);

    res.json({ today, month, trend, topItems });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ─── GET /api/orders/reports/daily  (date range) ─── */
router.get('/reports/daily', auth, auth.adminOnly, async (req, res) => {
  const { from, to } = req.query;
  try {
    const [rows] = await db.query(`
      SELECT
        DATE(created_at) AS date,
        COUNT(*)         AS orders,
        SUM(subtotal)    AS subtotal,
        SUM(discount)    AS discount,
        SUM(gst)         AS gst,
        SUM(grand_total) AS revenue,
        SUM(payment_mode='Cash') AS cash,
        SUM(payment_mode='Card') AS card,
        SUM(payment_mode='UPI')  AS upi
      FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ?
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [from || '2024-01-01', to || new Date().toISOString().split('T')[0]]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
