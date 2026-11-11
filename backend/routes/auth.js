const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool     = require('../config/db');
const router   = express.Router();

// Helper: generate JWT
const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// ─────────────────────────────────────────────
//  POST /api/auth/signup
// ─────────────────────────────────────────────
router.post('/signup', [
    body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, email, password } = req.body;

    try {
        // Check if user already exists
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        if (existing.length) {
            return res.status(409).json({ success: false, message: 'Email or username already taken.' });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 12);

        // Insert user
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, password_hash]
        );

        const token = signToken(result.insertId);

        return res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            token,
            user: { id: result.insertId, username, email, plan: 'free' }
        });
    } catch (err) {
        console.error('Signup error:', err);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// ─────────────────────────────────────────────
//  POST /api/auth/login
// ─────────────────────────────────────────────
router.post('/login', [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE email = ?', [email]
        );
        if (!rows.length) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const user = rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const token = signToken(user.id);

        return res.json({
            success: true,
            message: 'Logged in successfully!',
            token,
            user: { id: user.id, username: user.username, email: user.email, plan: user.plan }
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// ─────────────────────────────────────────────
//  GET /api/auth/me  (protected)
// ─────────────────────────────────────────────
const authMiddleware = require('../middleware/auth');
router.get('/me', authMiddleware, (req, res) => {
    res.json({ success: true, user: req.user });
});

// ─────────────────────────────────────────────
//  POST /api/auth/logout
// ─────────────────────────────────────────────
router.post('/logout', (req, res) => {
    // JWT is stateless — client deletes token
    res.json({ success: true, message: 'Logged out successfully.' });
});

// ─────────────────────────────────────────────
//  GET /api/auth/users (Admin / Debug out)
// ─────────────────────────────────────────────
router.get('/users', async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT id, username, email, plan, created_at FROM users ORDER BY created_at DESC'
        );
        res.json({ success: true, count: users.length, users });
    } catch (err) {
        console.error('Fetch users error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
