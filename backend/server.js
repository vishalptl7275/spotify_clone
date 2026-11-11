const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const pool = require('./config/db');
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

const frontendDir = process.env.FRONTEND_DIR || path.join(__dirname, '..');
app.use(express.static(frontendDir, { dotfiles: 'deny', index: false }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/playlists', require('./routes/playlists'));
app.use('/api/songs', require('./routes/songs'));

app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Spotify Clone API is running' });
});
app.get('*', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

async function start() {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET must contain at least 32 characters.');
    }
    const connection = await pool.getConnection();
    connection.release();
    const port = Number(process.env.PORT || 3000);
    app.listen(port, '0.0.0.0', () => console.log('Spotify Clone listening on port ' + port));
}
start().catch((error) => {
    console.error('Startup failed:', error.message);
    process.exit(1);
});
process.once('SIGTERM', async () => { await pool.end(); process.exit(0); });
process.once('SIGINT', async () => { await pool.end(); process.exit(0); });
