// ─── YouTube Full Song Player ─────────────────────────────────────────────────
// Uses YouTube Data API v3 to search for a song and play the full video
// via a hidden YouTube IFrame Player.

const YT_API_KEY = 'AIzaSyABXqVTB72ePWJvCzypmNTgdxUIrImP4do';

window.youtubePlayer = null;
window.isYoutubeReady = false;

// ─── Setup ────────────────────────────────────────────────────────────────────

function initYouTubeAPI() {
    // Inject YouTube IFrame API script
    if (!document.getElementById('youtube-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
    }

    // Create an invisible 1×1 player div (must be in DOM and non-zero size)
    if (!document.getElementById('youtube-player-container')) {
        const wrap = document.createElement('div');
        wrap.id = 'youtube-player-container';
        wrap.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;';
        const inner = document.createElement('div');
        inner.id = 'youtube-player';
        wrap.appendChild(inner);
        document.body.appendChild(wrap);
    }
}

// Called automatically by the YouTube IFrame API script when it is ready
window.onYouTubeIframeAPIReady = function () {
    window.youtubePlayer = new YT.Player('youtube-player', {
        height: '1',
        width: '1',
        playerVars: {
            autoplay: 1,
            playsinline: 1,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            origin: window.location.origin
        },
        events: {
            onReady: () => {
                window.isYoutubeReady = true;
                console.log('[YouTube] IFrame Player Ready ✓');
            },
            onStateChange: onYTStateChange,
            onError: onYTError
        }
    });
};

// ─── Player Events ────────────────────────────────────────────────────────────

function onYTStateChange(event) {
    if (!window.Player?.currentTrack?.isYoutube) return;

    if (event.data === YT.PlayerState.PLAYING) {
        window.Player.setPlayingConfig(true);

        // Poll getDuration() until YouTube has loaded the metadata (returns > 0)
        // YouTube often reports 0 duration for the first few hundred ms
        let pollAttempts = 0;
        const pollDuration = setInterval(() => {
            pollAttempts++;
            const dur = window.youtubePlayer.getDuration();
            if (dur > 0) {
                clearInterval(pollDuration);
                const pb  = document.getElementById('progress-bar');
                const tot = document.querySelector('.tot-time');
                if (pb)  pb.max = dur;
                if (tot) tot.textContent = window.Player.fmtTime(dur);
                console.log(`[YouTube] Duration resolved: ${window.Player.fmtTime(dur)} (after ${pollAttempts * 300}ms)`);
            } else if (pollAttempts > 33) {
                // Give up after ~10 seconds
                clearInterval(pollDuration);
                console.warn('[YouTube] Duration never resolved.');
            }
        }, 300);

    } else if (event.data === YT.PlayerState.PAUSED) {
        window.Player.setPlayingConfig(false);

    } else if (event.data === YT.PlayerState.ENDED) {
        window.Player.setPlayingConfig(false);
        window.Player.handleEnded?.();
    }
}


function onYTError(event) {
    console.error('[YouTube] Player error code:', event.data);
    // error 2 = bad videoId, 100 = video not found, 101/150 = embed blocked
    if (window.showToast) window.showToast('YouTube error. Falling back to 30s preview...');

    const ct = window.Player?.currentTrack;
    if (ct?._fallbackPreviewUrl) {
        window.Player.audio.src = ct._fallbackPreviewUrl;
        window.Player.audio
            .play()
            .then(() => window.Player.setPlayingConfig(true))
            .catch(() => {});
    }
}

// ─── YouTube Data API v3 Search ───────────────────────────────────────────────

async function findYouTubeVideoId(songName, artistName) {
    const query = `${songName} ${artistName} official audio`;
    const url =
        `https://www.googleapis.com/youtube/v3/search` +
        `?part=snippet&type=video&maxResults=1&videoCategoryId=10` +
        `&q=${encodeURIComponent(query)}&key=${YT_API_KEY}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json();
            console.error('[YouTube] API error:', err?.error?.message);
            return null;
        }
        const data = await res.json();
        const videoId = data?.items?.[0]?.id?.videoId;
        if (videoId) {
            console.log(`[YouTube] Found: ${videoId} for "${query}"`);
        } else {
            console.warn('[YouTube] No results for:', query);
        }
        return videoId || null;
    } catch (e) {
        console.error('[YouTube] Search fetch failed:', e.message);
        return null;
    }
}

// ─── Internal play helpers ────────────────────────────────────────────────────

function waitForYT(fn, retries = 15) {
    if (window.isYoutubeReady && window.youtubePlayer) {
        fn();
    } else if (retries > 0) {
        setTimeout(() => waitForYT(fn, retries - 1), 500);
    } else {
        if (window.showToast) window.showToast('YouTube player not ready. Try again.');
    }
}

function registerYTTrack(trackObj) {
    window.Player.currentTrack = trackObj;
    Storage.set('last_played', trackObj);

    // Add to recently played
    let rec = Storage.get('recently_played') || [];
    rec = rec.filter(x => x.id !== trackObj.id);
    rec.unshift(trackObj);
    if (rec.length > 20) rec.pop();
    Storage.set('recently_played', rec);

    // Update UI immediately (album art, title, artist)
    window.Player.audio.pause(); // mute any HTML5 audio playing
    window.Player.updatePlayerUI(trackObj);

    // Reset progress bar until real duration comes in
    const pb = document.getElementById('progress-bar');
    const tot = document.querySelector('.tot-time');
    if (pb) { pb.max = 0; pb.value = 0; }
    if (tot) tot.textContent = '--:--';
}

// ─── Public API ───────────────────────────────────────────────────────────────

window.YouTubeAPI = {
    init: initYouTubeAPI,

    /**
     * Play a YouTube video by a known video ID (used by hardcoded demo cards).
     */
    playVideo: (videoId, title, artist, artwork) => {
        const trackObj = {
            id: 'yt-' + videoId,
            videoId,
            name: title || 'YouTube Song',
            artist: artist || '',
            artwork: artwork || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            previewUrl: 'youtube',
            isYoutube: true
        };

        registerYTTrack(trackObj);
        waitForYT(() => {
            window.youtubePlayer.loadVideoById({ videoId, startSeconds: 0 });
        });
    },

    /**
     * Search YouTube Data API v3 for a song and play the full version.
     * Falls back to the iTunes 30-second preview if nothing is found.
     * @param {Object} track  - { name, artist, artwork, previewUrl }
     * @param {Function} fallbackFn - Called if YouTube search fails
     */
    searchAndPlay: async (track, fallbackFn) => {
        if (window.showToast) window.showToast(`🔍 Finding: ${track.name}...`);

        const videoId = await findYouTubeVideoId(track.name, track.artist);

        if (!videoId) {
            if (window.showToast) window.showToast('Not on YouTube — playing 30s preview.');
            if (typeof fallbackFn === 'function') fallbackFn();
            return;
        }

        const trackObj = {
            id: 'yt-' + videoId,
            videoId,
            name: track.name,
            artist: track.artist,
            artwork: track.artwork || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            previewUrl: 'youtube',
            isYoutube: true,
            _fallbackPreviewUrl: track.previewUrl || track.preview_url || null,
            _fallbackFn: fallbackFn
        };

        registerYTTrack(trackObj);
        waitForYT(() => {
            window.youtubePlayer.loadVideoById({ videoId, startSeconds: 0 });
            if (window.showToast) window.showToast(`▶ Now playing full song — ${track.name}`);
        });
    }
};

// Boot
initYouTubeAPI();
