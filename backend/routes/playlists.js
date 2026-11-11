const express  = require('express');
const pool     = require('../config/db');
const auth     = require('../middleware/auth');
const router   = express.Router();

// ─────────────────────────────────────────────
//  GET /api/playlists  — get user's playlists
// ─────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
    try {
        const [playlists] = await pool.query(
            `SELECT p.*, COUNT(ps.song_id) AS song_count
             FROM playlists p
             LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
             WHERE p.user_id = ?
             GROUP BY p.id
             ORDER BY p.created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, playlists });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
//  POST /api/playlists — create a playlist
// ─────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
    const { name, description = '', is_public = true } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Playlist name is required.' });

    try {
        const [result] = await pool.query(
            'INSERT INTO playlists (user_id, name, description, is_public) VALUES (?, ?, ?, ?)',
            [req.user.id, name, description, is_public]
        );
        res.status(201).json({ success: true, message: 'Playlist created!', playlistId: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
//  DELETE /api/playlists/:id
// ─────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
    try {
        const [result] = await pool.query(
            'DELETE FROM playlists WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Playlist not found.' });
        res.json({ success: true, message: 'Playlist deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
//  POST /api/playlists/:id/songs — add song
// ─────────────────────────────────────────────
router.post('/:id/songs', auth, async (req, res) => {
    const { itunes_id, title, artist, album, artwork_url, preview_url, duration_ms } = req.body;
    try {
        // Upsert song
        await pool.query(
            `INSERT INTO songs (itunes_id, title, artist, album, artwork_url, preview_url, duration_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title=VALUES(title), artist=VALUES(artist)`,
            [itunes_id, title, artist, album, artwork_url, preview_url, duration_ms]
        );
        const [[song]] = await pool.query('SELECT id FROM songs WHERE itunes_id = ?', [itunes_id]);
        await pool.query(
            'INSERT IGNORE INTO playlist_songs (playlist_id, song_id) VALUES (?, ?)',
            [req.params.id, song.id]
        );
        res.json({ success: true, message: 'Song added to playlist!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
//  GET /api/playlists/:id/songs — get playlist songs
// ─────────────────────────────────────────────
router.get('/:id/songs', auth, async (req, res) => {
    try {
        const [songs] = await pool.query(
            `SELECT s.*, ps.id as ps_id FROM playlist_songs ps
             JOIN songs s ON ps.song_id = s.id
             WHERE ps.playlist_id = ?
             ORDER BY ps.added_at ASC`,
            [req.params.id]
        );
        res.json({ success: true, songs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
//  DELETE /api/playlists/:id/songs/:songId — remove song
// ─────────────────────────────────────────────
router.delete('/:id/songs/:songId', auth, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
            [req.params.id, req.params.songId]
        );
        res.json({ success: true, message: 'Song removed from playlist.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
