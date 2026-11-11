-- =============================================
--  SPOTIFY CLONE DATABASE SCHEMA
-- =============================================

CREATE DATABASE IF NOT EXISTS spotify_clone;
USE spotify_clone;

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url    VARCHAR(500) DEFAULT NULL,
    plan          ENUM('free', 'premium') DEFAULT 'free',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- PLAYLISTS TABLE
CREATE TABLE IF NOT EXISTS playlists (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    cover_url   VARCHAR(500) DEFAULT NULL,
    is_public   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- SONGS TABLE (from iTunes API metadata)
CREATE TABLE IF NOT EXISTS songs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    itunes_id   BIGINT UNIQUE,
    title       VARCHAR(255) NOT NULL,
    artist      VARCHAR(255),
    album       VARCHAR(255),
    artwork_url VARCHAR(500),
    preview_url VARCHAR(500),
    duration_ms INT,
    genre       VARCHAR(100),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PLAYLIST_SONGS
CREATE TABLE IF NOT EXISTS playlist_songs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    playlist_id INT NOT NULL,
    song_id     INT NOT NULL,
    position    INT DEFAULT 0,
    added_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id)     REFERENCES songs(id)     ON DELETE CASCADE,
    UNIQUE KEY unique_song_in_playlist (playlist_id, song_id)
);

-- LIKED SONGS
CREATE TABLE IF NOT EXISTS liked_songs (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    song_id    INT NOT NULL,
    liked_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    UNIQUE KEY unique_liked (user_id, song_id)
);

-- RECENTLY PLAYED
CREATE TABLE IF NOT EXISTS recently_played (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    song_id    INT NOT NULL,
    played_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

SELECT 'Database schema created successfully!' AS status;
