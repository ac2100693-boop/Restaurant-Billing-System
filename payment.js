const router = require('express').Router();
const QRCode = require('qrcode');
const auth   = require('../middleware/auth');

/**
 * POST /api/payment/upi-qr
 * Body: { amount, bill_no }
 * Returns: { qr_data_url }  — base64 PNG ready for <img src="">
 */
router.post('/upi-qr', auth, async (req, res) => {
  const { amount, bill_no } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount required' });

  const upiId   = process.env.UPI_ID   || 'restaurant@upi';
  const upiName = process.env.UPI_NAME || 'Saveur Restaurant';

  // UPI deep-link standard (NPCI spec)
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${parseFloat(amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent('Bill ' + (bill_no || ''))}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: 'H',
      width: 280,
      margin: 2,
      color: { dark: '#1A1209', light: '#FBF7EE' }
    });
    res.json({ qr_data_url: qrDataUrl, upi_uri: upiUri, upi_id: upiId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
