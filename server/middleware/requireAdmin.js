
const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Admin login is required.',
    });
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Admin login is required.',
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'Authentication is not configured.',
      });
    }

    const decoded = jwt.verify(token, jwtSecret, {
  algorithms: ['HS256'],
});

    const configuredEmail = process.env.ADMIN_EMAIL
      ?.trim()
      .toLowerCase();

    if (
      decoded.role !== 'admin' ||
      !configuredEmail ||
      decoded.email !== configuredEmail
    ) {
      return res.status(403).json({
        success: false,
        message: 'Admin access denied.',
      });
    }

    req.admin = {
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Your session is invalid or expired. Please log in again.',
    });
  }
}

module.exports = requireAdmin;
