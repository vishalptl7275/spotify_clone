const jwt  = require('jsonwebtoken');
const pool = require('../config/db');

module.exports = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [rows] = await pool.query('SELECT id, username, email, plan FROM users WHERE id = ?', [decoded.id]);

        if (!rows.length) {
            return res.status(401).json({ success: false, message: 'User not found.' });
        }

        req.user = rows[0];
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
};
