const express = require('express');
const pool    = require('../config/db');
const auth    = require('../middleware/auth');
const router  = express.Router();

// ─────────────────────────────────────────────
//  GET /api/songs/liked  — user's liked songs
// ─────────────────────────────────────────────
router.get('/liked', auth, async (req, res) => {
    try {
        const [songs] = await pool.query(
            `SELECT s.* FROM songs s
             JOIN liked_songs ls ON s.id = ls.song_id
             WHERE ls.user_id = ?
             ORDER BY ls.liked_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, songs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
//  POST /api/songs/like  — like a song
// ─────────────────────────────────────────────
router.post('/like', auth, async (req, res) => {
    const { itunes_id, title, artist, album, artwork_url, preview_url, duration_ms } = req.body;
    try {
        await pool.query(
            `INSERT INTO songs (itunes_id, title, artist, album, artwork_url, preview_url, duration_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title=VALUES(title)`,
            [itunes_id, title, artist, album, artwork_url, preview_url, duration_ms]
        );
        const [[song]] = await pool.query('SELECT id FROM songs WHERE itunes_id = ?', [itunes_id]);
        await pool.query(
            'INSERT IGNORE INTO liked_songs (user_id, song_id) VALUES (?, ?)',
            [req.user.id, song.id]
        );
        res.json({ success: true, message: 'Song liked!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
//  DELETE /api/songs/like/:itunesId  — unlike
// ─────────────────────────────────────────────
router.delete('/like/:itunesId', auth, async (req, res) => {
    try {
        const [[song]] = await pool.query('SELECT id FROM songs WHERE itunes_id = ?', [req.params.itunesId]);
        if (!song) return res.status(404).json({ success: false, message: 'Song not found.' });
        await pool.query('DELETE FROM liked_songs WHERE user_id = ? AND song_id = ?', [req.user.id, song.id]);
        res.json({ success: true, message: 'Song unliked.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
//  POST /api/songs/played  — log recently played
// ─────────────────────────────────────────────
router.post('/played', auth, async (req, res) => {
    const { itunes_id, title, artist, album, artwork_url, preview_url, duration_ms } = req.body;
    try {
        await pool.query(
            `INSERT INTO songs (itunes_id, title, artist, album, artwork_url, preview_url, duration_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title=VALUES(title)`,
            [itunes_id, title, artist, album, artwork_url, preview_url, duration_ms]
        );
        const [[song]] = await pool.query('SELECT id FROM songs WHERE itunes_id = ?', [itunes_id]);
        await pool.query(
            'INSERT INTO recently_played (user_id, song_id) VALUES (?, ?)',
            [req.user.id, song.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
//  GET /api/songs/recent  — recently played
// ─────────────────────────────────────────────
router.get('/recent', auth, async (req, res) => {
    try {
        const [songs] = await pool.query(
            `SELECT s.*, rp.played_at FROM songs s
             JOIN recently_played rp ON s.id = rp.song_id
             WHERE rp.user_id = ?
             ORDER BY rp.played_at DESC
             LIMIT 20`,
            [req.user.id]
        );
        res.json({ success: true, songs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
