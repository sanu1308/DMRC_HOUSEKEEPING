const express = require('express');
const authController = require('../controllers/authController');
const { verifyToken, verifySuperAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Authentication Routes
 */

// Public routes
router.post('/login', authController.login);
router.post('/signup', verifyToken, verifySuperAdmin, authController.signup);

// Protected routes
router.get('/me', verifyToken, authController.getCurrentUser);

module.exports = router;
