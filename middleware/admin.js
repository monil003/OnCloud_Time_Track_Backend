module.exports = function(req, res, next) {
  // Check if req.user exists (set by auth middleware)
  if (!req.user) {
    return res.status(401).json({ message: 'No user info, authorization denied' });
  }

  // Check if role is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admin only' });
  }

  next();
};
