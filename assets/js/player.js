const Player = {
    audio: new Audio(),
    isPlaying: false,
    isShuffle: false,
    isRepeat: false,
    currentTrack: null,
    contextQueue: [],
    contextIndex: 0,
    animationFrameId: null,
    
    init: () => {
        // Recover last played song if exists
        const last = Storage.get('last_played');
        if (last) {
            Player.currentTrack = last;
            Player.updatePlayerUI(last);
        }

        // Add auto play next song on ended
        Player.audio.addEventListener('ended', Player.handleEnded);

        // Bind basic toggles
        const shuffleBtn = document.querySelector('.fa-shuffle');
        if(shuffleBtn) shuffleBtn.addEventListener('click', () => {
            Player.isShuffle = !Player.isShuffle;
            shuffleBtn.style.color = Player.isShuffle ? '#1DB954' : '#b3b3b3';
        });

        const repeatBtn = document.querySelector('.fa-repeat');
        if(repeatBtn) repeatBtn.addEventListener('click', () => {
            Player.isRepeat = !Player.isRepeat;
            repeatBtn.style.color = Player.isRepeat ? '#1DB954' : '#b3b3b3';
        });

        // Add like button logic
        const heart = document.querySelector('.album-heart');
        if (heart) {
            heart.addEventListener('click', () => {
                if (!Player.currentTrack) return;
                const trackId = Player.currentTrack.id || Player.currentTrack.itunes_id;
                let liked = Storage.get('liked_songs') || [];
                const isLiked = liked.some(x => (x.id || x.itunes_id) === trackId);
                
                if (isLiked) {
                    liked = liked.filter(x => (x.id || x.itunes_id) !== trackId);
                    heart.className = 'fa-regular fa-heart album-heart';
                    heart.style.color = '';
                } else {
                    liked.push(Player.currentTrack);
                    heart.className = 'fa-solid fa-heart album-heart';
                    heart.style.color = '#1DB954';
                }
                Storage.set('liked_songs', liked);
            });
        }
    },

    play: (track, forceReset = true, context = null, index = 0) => {
        const previewUrl = track.previewUrl || track.preview_url;
        if (!track || (!previewUrl && !track.isYoutube)) {
            if (window.showToast) window.showToast('No audio available');
            return;
        }

        // Optional Context update
        if (context) {
            Player.contextQueue = context;
            Player.contextIndex = index;
        }

        Player.currentTrack = track;
        Storage.set('last_played', track);
        
        // Add to recently played
        let rec = Storage.get('recently_played') || [];
        rec = rec.filter(x => (x.id || x.itunes_id) !== (track.id || track.itunes_id));
        rec.unshift(track);
        if (rec.length > 20) rec.pop();
        Storage.set('recently_played', rec);

        const volBar = document.getElementById('vol-bar');
        const vol = volBar ? volBar.value / 100 : 0.7;
        
        // Handle YouTube completely differently
        if (track.isYoutube) {
             Player.audio.pause(); // stop standard audio
             
             if (window.youtubePlayer && typeof window.youtubePlayer.loadVideoById === 'function') {
                 Player.updatePlayerUI(track);
                 if (window.youtubePlayer.setVolume) {
                     window.youtubePlayer.setVolume(vol * 100);
                 }
                 window.youtubePlayer.loadVideoById({
                     videoId: track.videoId,
                     startSeconds: 0
                 });
             } else {
                 if (window.showToast) window.showToast("YouTube player not ready yet.");
             }
             return;
        }

        // Handle standard HTML5 audio
        if (window.youtubePlayer && typeof window.youtubePlayer.pauseVideo === 'function') {
             window.youtubePlayer.pauseVideo();
        }

        if (forceReset || Player.audio.src !== previewUrl) {
            Player.audio.src = previewUrl;
        }

        Player.audio.volume = vol;
        Player.updatePlayerUI(track);
        Player.audio.play().then(() => {
            Player.setPlayingConfig(true);
        }).catch(() => {
            if (window.showToast) window.showToast('Playback blocked. Click Play manually.');
        });
    },

    pause: () => {
        if (Player.currentTrack && Player.currentTrack.isYoutube && window.youtubePlayer) {
             if (typeof window.youtubePlayer.pauseVideo === 'function') window.youtubePlayer.pauseVideo();
        } else {
             Player.audio.pause();
        }
        Player.setPlayingConfig(false);
    },

    togglePlay: () => {
        if (!Player.currentTrack) return;
        
        if (Player.currentTrack.isYoutube && window.youtubePlayer) {
             const state = window.youtubePlayer.getPlayerState();
             if (state === 1) { // PLAYING
                 window.youtubePlayer.pauseVideo();
                 Player.setPlayingConfig(false);
             } else {
                 window.youtubePlayer.playVideo();
                 Player.setPlayingConfig(true);
             }
             return;
        }

        if (Player.isPlaying) Player.pause();
        else Player.play(Player.currentTrack, false);
    },

    next: () => {
        // Try playing next from manual queue first
        const queuedNext = Queue.next();
        if (queuedNext) {
            // Route through YouTube if it's not a YouTube track already
            if (window.YouTubeAPI && typeof window.YouTubeAPI.searchAndPlay === 'function' && !queuedNext.isYoutube) {
                const fallback = () => Player.play(queuedNext, true);
                window.YouTubeAPI.searchAndPlay(queuedNext, fallback);
            } else {
                Player.play(queuedNext, true);
            }
            return;
        }

        // Play next from context queue (search results, playlist)
        if (Player.contextQueue.length > 0) {
            let nextIndex = Player.isShuffle
                ? Math.floor(Math.random() * Player.contextQueue.length)
                : (Player.contextIndex + 1) % Player.contextQueue.length;
            const nextTrack = Player.contextQueue[nextIndex];
            Player.contextIndex = nextIndex;
            if (window.YouTubeAPI && typeof window.YouTubeAPI.searchAndPlay === 'function' && !nextTrack.isYoutube) {
                const fallback = () => Player.play(nextTrack, true, Player.contextQueue, nextIndex);
                window.YouTubeAPI.searchAndPlay(nextTrack, fallback);
            } else {
                Player.play(nextTrack, true, Player.contextQueue, nextIndex);
            }
        } else {
            Player.pause();
        }
    },


    prev: () => {
        // For YouTube: check current playback time from the YT player itself
        const currentTime = (Player.currentTrack?.isYoutube && window.youtubePlayer)
            ? (window.youtubePlayer.getCurrentTime?.() || 0)
            : Player.audio.currentTime;

        if (currentTime > 3) {
            // Restart current song
            if (Player.currentTrack?.isYoutube && window.youtubePlayer) {
                window.youtubePlayer.seekTo(0, true);
            } else {
                Player.audio.currentTime = 0;
            }
            return;
        }

        if (Player.contextQueue.length > 0) {
            let prevIdx = (Player.contextIndex - 1 + Player.contextQueue.length) % Player.contextQueue.length;
            const prevTrack = Player.contextQueue[prevIdx];
            Player.contextIndex = prevIdx;
            if (window.YouTubeAPI && typeof window.YouTubeAPI.searchAndPlay === 'function' && !prevTrack.isYoutube) {
                const fallback = () => Player.play(prevTrack, true, Player.contextQueue, prevIdx);
                window.YouTubeAPI.searchAndPlay(prevTrack, fallback);
            } else {
                Player.play(prevTrack, true, Player.contextQueue, prevIdx);
            }
        }
    },


    seek: (time) => {
        if (Player.currentTrack && Player.currentTrack.isYoutube && window.youtubePlayer) {
             if (typeof window.youtubePlayer.seekTo === 'function') {
                 window.youtubePlayer.seekTo(time, true);
             }
        } else {
             Player.audio.currentTime = time;
        }
    },

    handleEnded: () => {
        if (Player.isRepeat) {
            if (Player.currentTrack?.isYoutube && window.youtubePlayer) {
                window.youtubePlayer.seekTo(0, true);
                window.youtubePlayer.playVideo();
            } else {
                Player.audio.currentTime = 0;
                Player.audio.play();
            }
        } else {
            Player.next();
        }
    },


    setPlayingConfig: (playing) => {
        Player.isPlaying = playing;
        const playIcon = document.getElementById('play-icon');
        if (playIcon) {
            playIcon.className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
            playIcon.style.marginLeft = playing ? '0' : '2px';
        }
        if (playing) {
            cancelAnimationFrame(Player.animationFrameId);
            Player.startAnimation();
        } else {
            cancelAnimationFrame(Player.animationFrameId);
        }
    },

    startAnimation: () => {
        const loop = () => {
            if (!Player.isPlaying) return;
            const pb = document.getElementById('progress-bar');
            const ct = document.querySelector('.curr-time');
            
            // Get current time depending on player type
            let currentTime = 0;
            if (Player.currentTrack && Player.currentTrack.isYoutube && window.youtubePlayer && typeof window.youtubePlayer.getCurrentTime === 'function') {
                 currentTime = window.youtubePlayer.getCurrentTime() || 0;
            } else {
                 currentTime = Player.audio.currentTime || 0;
            }

            if (pb && ct && !window.isDraggingBar) {
                pb.value = Math.floor(currentTime * 100) / 100;
                ct.textContent = Player.fmtTime(currentTime);
                const pct = pb.max > 0 ? (pb.value / pb.max) * 100 : 0;
                pb.style.setProperty('--progress', `${pct}%`);
            }
            Player.animationFrameId = requestAnimationFrame(loop);
        };
        Player.animationFrameId = requestAnimationFrame(loop);
    },

    fmtTime: s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`,

    updatePlayerUI: (t) => {
        const title   = document.querySelector('.album-title');
        const artist  = document.querySelector('.album-artist');
        const artEl   = document.querySelector('.album-art');
        const totTime = document.querySelector('.tot-time');
        const pb      = document.getElementById('progress-bar');
        
        if (title) title.textContent = t.name || t.title;
        if (artist) artist.textContent = t.artist;
        if (artEl) {
            const artwork = t.artwork || t.artwork_url;
            artEl.innerHTML = artwork
                ? `<img src="${artwork}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`
                : `<i class="fa-solid fa-music"></i>`;
        }
        
        // Mark like button
        const liked = Storage.get('liked_songs') || [];
        const trackId = t.id || t.itunes_id;
        const isLiked = liked.some(x => (x.id || x.itunes_id) === trackId);
        const heart = document.querySelector('.album-heart');
        if(heart) {
            heart.className = isLiked ? 'fa-solid fa-heart album-heart' : 'fa-regular fa-heart album-heart';
            heart.style.color = isLiked ? '#1DB954' : '';
        }

        // For YouTube tracks: set max to a large number so the progress bar
        // doesn't get stuck. The real duration is filled in by the polling loop
        // in onYTStateChange (youtube.js) as soon as YouTube provides it.
        if (t.isYoutube) {
            if (totTime) totTime.textContent = '--:--';
            if (pb) { pb.max = 9999; pb.value = 0; }
        } else {
            const durSec = t.duration ? Math.round(t.duration / 1000) : 30;
            if (totTime) totTime.textContent = Player.fmtTime(durSec);
            if (pb) { pb.max = durSec; pb.value = 0; }
        }
    }
};

window.Player = Player;
