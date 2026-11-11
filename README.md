# Spotify Clone

A Spotify-inspired web app with an HTML/CSS/JavaScript frontend and an Express/MySQL backend. It includes signup/login, playlists, liked songs and recently played metadata.

## Run with Docker

Requirements: Docker Desktop with Docker Compose.

1. Copy .env.example to .env.
2. Set unique, strong values for DB_PASSWORD, MYSQL_ROOT_PASSWORD and JWT_SECRET (at least 32 random characters).
3. Run: docker compose up --build -d
4. Open http://localhost:3000 and create an account using Sign Up.

MySQL initializes the spotify_clone database from backend/schema.sql on first startup. Data persists in the spotify_db volume. View logs with docker compose logs -f app. Stop with docker compose down. The command docker compose down -v also deletes the database volume.

## Run locally

Install Node.js 20+ and MySQL 8+. Create the database using backend/schema.sql, configure the DB_* and JWT_* environment variables, then run npm ci and npm start from the backend directory. Open http://localhost:3000.

## Security and limitations

Secrets are environment variables; never commit .env. Playlist endpoints must enforce ownership. This is a learning project, not an official Spotify client; it uses third-party music metadata and preview sources. Review API terms, privacy, rate limits and security before public production use.
