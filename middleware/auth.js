const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    req.staff = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Admin-only gate
module.exports.adminOnly = (req, res, next) => {
  if (req.staff.role !== 'admin' && req.staff.role !== 'manager')
    return res.status(403).json({ error: 'Admin access required' });
  next();
};
