const jwt = require('jsonwebtoken');

/**
 * Verify JWT Token
 * Middleware to check if request has valid JWT token
 */
const verifyToken = (req, res, next) => {
  try {
    // Get token from header
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Access denied.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
};

/**
 * Verify Super Admin Role
 * Middleware to check if user has super admin role
 */
const verifySuperAdmin = (req, res, next) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super Admin privileges required.'
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authorization error.'
    });
  }
};

/**
 * Verify User Role
 * Middleware to check if user has user role
 */
const verifyUser = (req, res, next) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. User privileges required.'
      });
    }

    if (!req.user.station_id) {
      return res.status(403).json({
        success: false,
        message: 'Station assignment missing. Contact an administrator.'
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authorization error.'
    });
  }
};

module.exports = {
  verifyToken,
  verifySuperAdmin,
  verifyUser
};
