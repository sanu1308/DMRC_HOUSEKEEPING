const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * User Login
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    // Get connection from pool
    const connection = await pool.getConnection();

    try {
      // Check if user exists
      const [users] = await connection.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      const user = users[0];

      // Compare password
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      // Generate JWT Token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          station_id: user.station_id || null
        },
        process.env.JWT_SECRET || 'your_secret_key',
        {
          expiresIn: process.env.JWT_EXPIRE || '7d'
        }
      );

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          station_id: user.station_id || null
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.'
    });
  }
};

/**
 * User Signup (Super Admin Only)
 * POST /api/auth/signup
 */
const signup = async (req, res) => {
  try {
    const { name, email, password, role, station_id } = req.body;

    // Validate input
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required.'
      });
    }

    // Validate role
    if (!['superadmin', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role.'
      });
    }

    let stationIdValue = null;
    if (role === 'user') {
      if (!station_id) {
        return res.status(400).json({
          success: false,
          message: 'station_id is required when creating station users.'
        });
      }

      const parsedStation = Number(station_id);
      if (!Number.isInteger(parsedStation) || parsedStation <= 0) {
        return res.status(400).json({
          success: false,
          message: 'station_id must be a positive integer.'
        });
      }
      stationIdValue = parsedStation;
    }

    const connection = await pool.getConnection();

    try {
      // Check if user already exists
      const [existingUsers] = await connection.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists.'
        });
      }

      // Ensure referenced station exists for station-level users
      if (stationIdValue) {
        const [stations] = await connection.query(
          'SELECT id FROM stations WHERE id = ?',
          [stationIdValue]
        );

        if (!stations.length) {
          return res.status(404).json({
            success: false,
            message: 'Station not found.'
          });
        }

        const [stationUsers] = await connection.query(
          'SELECT id FROM users WHERE station_id = ? AND role = ?',
          [stationIdValue, 'user']
        );

        if (stationUsers.length) {
          return res.status(409).json({
            success: false,
            message: 'A station-level account already exists for this station.'
          });
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user
      const [result] = await connection.query(
        'INSERT INTO users (name, email, password, role, station_id) VALUES (?, ?, ?, ?, ?)',
        [name, email, hashedPassword, role, stationIdValue]
      );

      return res.status(201).json({
        success: true,
        message: 'User created successfully.',
        user: {
          id: result.insertId,
          name,
          email,
          role,
          station_id: stationIdValue
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during signup.'
    });
  }
};

/**
 * Get Current User
 * GET /api/auth/me
 */
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const connection = await pool.getConnection();

    try {
      const [users] = await connection.query(
        'SELECT id, name, email, role, station_id, created_at FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found.'
        });
      }

      return res.status(200).json({
        success: true,
        user: users[0]
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

module.exports = {
  login,
  signup,
  getCurrentUser
};
