// ==========================================
// DYNAMIC MODULE LOADER
// ==========================================
const scriptsToLoad = [
    './assets/js/storage.js',
    './assets/js/queue.js',
    './assets/js/playlist.js',
    './assets/js/player.js',
    './assets/js/contextmenu.js',
    './assets/js/spotify.js',
    './assets/js/youtube.js'
];

function loadScripts(scripts, callback) {
    if (scripts.length === 0) return callback();
    const s = document.createElement('script');
    s.src = scripts[0];
    s.onload = () => loadScripts(scripts.slice(1), callback);
    document.body.appendChild(s);
}

document.addEventListener('DOMContentLoaded', () => {
    loadScripts(scriptsToLoad, initApp);
});

function initApp() {
    // 1. Initialize sub-systems
    window.Storage.init();
    window.Player.init();
    window.Playlist.renderSidebar();
    if (window.SpotifyAPI) window.SpotifyAPI.init();

    // 2. DOM refs
    const searchInput     = document.getElementById('search-input');
    const sidebarSearch   = document.getElementById('sidebar-search');
    const playPauseBtn    = document.getElementById('play-pause-btn');
    const nextBtn         = document.querySelector('.fa-forward-step');
    const prevBtn         = document.querySelector('.fa-backward-step');
    const volBar          = document.getElementById('vol-bar');
    const progressBar     = document.getElementById('progress-bar');

    // ── Toast ───────────────────────────────────────────────────────────────
    window.showToast = function(msg) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.style.cssText = `
                position:fixed; bottom:110px; left:50%; transform:translateX(-50%);
                background:#282828; color:#fff; padding:0.75rem 1.5rem;
                border-radius:500px; font-size:0.85rem; font-weight:600;
                z-index:9999; opacity:0; transition:opacity 0.3s ease;
                box-shadow:0 8px 24px rgba(0,0,0,0.5); font-family:'Montserrat',sans-serif;
                white-space:nowrap; max-width:90vw; text-overflow:ellipsis; overflow:hidden;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.style.opacity = '0', 3000);
    };

    // ── Player Buttons ───────────────────────────────────────────────────────
    if (playPauseBtn) playPauseBtn.addEventListener('click', () => {
        playPauseBtn.style.transform = 'scale(0.88)';
        setTimeout(() => playPauseBtn.style.transform = 'scale(1)', 130);
        window.Player.togglePlay();
    });

    // Next / Prev — delegate to parent container to catch clicks on child <i> icons too
    const playerControls = document.querySelector('.player-controls');
    if (playerControls) {
        playerControls.addEventListener('click', (e) => {
            const el = e.target.closest('i') || e.target;
            if (el.classList.contains('fa-forward-step'))  window.Player.next();
            if (el.classList.contains('fa-backward-step')) window.Player.prev();
        });
    }
    // Fallback direct bindings
    if (nextBtn) nextBtn.addEventListener('click', window.Player.next);
    if (prevBtn) prevBtn.addEventListener('click', window.Player.prev);

    if (progressBar) {
        progressBar.addEventListener('mousedown', () => window.isDraggingBar = true);
        progressBar.addEventListener('touchstart', () => window.isDraggingBar = true, { passive: true });

        progressBar.addEventListener('input', (e) => {
            const ct = document.querySelector('.curr-time');
            if (ct) ct.textContent = window.Player.fmtTime(e.target.value);
            const pct = progressBar.max > 0 ? (e.target.value / progressBar.max) * 100 : 0;
            progressBar.style.setProperty('--progress', `${pct}%`);
        });

        // Seek on mouseup (drag release) OR direct click
        const doSeek = () => {
            window.Player.seek(parseFloat(progressBar.value));
            window.isDraggingBar = false;
        };
        progressBar.addEventListener('mouseup',  doSeek);
        progressBar.addEventListener('touchend', doSeek);
        progressBar.addEventListener('change',   doSeek); // fires on keyboard arrow keys too
    }

    if (volBar) {
        const updateVol = () => {
            const pct = volBar.value;
            volBar.style.setProperty('--progress', `${pct}%`);
            window.Player.audio.volume = pct / 100;
            if (window.youtubePlayer && typeof window.youtubePlayer.setVolume === 'function') {
                window.youtubePlayer.setVolume(pct);
            }
        };
        volBar.addEventListener('input', updateVol);
        updateVol();
    }

    // ── Recent Searches ──────────────────────────────────────────────────────
    function getRecentSearches() {
        return Storage.get('recent_searches') || [];
    }
    function saveRecentSearch(query) {
        if (!query || query.length < 2) return;
        let recents = getRecentSearches();
        recents = recents.filter(r => r.toLowerCase() !== query.toLowerCase());
        recents.unshift(query);
        if (recents.length > 8) recents = recents.slice(0, 8);
        Storage.set('recent_searches', recents);
    }
    function removeRecentSearch(query) {
        let recents = getRecentSearches().filter(r => r !== query);
        Storage.set('recent_searches', recents);
        renderSuggestionsDropdown(searchInput.value.trim());
    }

    // ── Suggestion Dropdown ──────────────────────────────────────────────────
    // YouTube autocomplete-style suggestions via YouTube Data API
    const YT_API_KEY = 'AIzaSyABXqVTB72ePWJvCzypmNTgdxUIrImP4do';
    let suggestTimeout = null;
    let suggestionsEl = null;

    function getSuggestionsEl() {
        if (!suggestionsEl) {
            suggestionsEl = document.createElement('div');
            suggestionsEl.id = 'search-suggestions';
            suggestionsEl.style.cssText = `
                position:absolute; top:calc(100% + 6px); left:0; right:0;
                background:#282828; border-radius:10px; border:1px solid #333;
                box-shadow:0 12px 32px rgba(0,0,0,0.6); z-index:9999;
                overflow:hidden; font-family:'Montserrat',sans-serif;
                animation:fadeInDown 0.15s ease;
            `;
            // Make search bar a positioned parent
            const bar = searchInput.closest('.search-bar') || searchInput.parentElement;
            bar.style.position = 'relative';
            bar.appendChild(suggestionsEl);
        }
        return suggestionsEl;
    }

    function hideSuggestions() {
        if (suggestionsEl) suggestionsEl.style.display = 'none';
    }

    async function fetchSuggestions(query) {
        // Use YouTube's search suggestions endpoint (no key needed, CORS-friendly via Google)
        try {
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=5&q=${encodeURIComponent(query + ' official audio')}&key=${YT_API_KEY}&fields=items(snippet(title))`;
            const res = await fetch(url);
            if (!res.ok) return [];
            const data = await res.json();
            // Extract clean song titles from snippet titles
            return (data.items || [])
                .map(item => {
                    let t = item.snippet.title;
                    // Remove common suffixes for cleaner display
                    t = t.replace(/\s*[\(\[].*(official|audio|video|lyrics|ft\.|feat\.).*/gi, '').trim();
                    return t;
                })
                .filter((t, i, arr) => t.length > 1 && arr.indexOf(t) === i)
                .slice(0, 5);
        } catch { return []; }
    }

    async function renderSuggestionsDropdown(query) {
        const el = getSuggestionsEl();
        const recents = getRecentSearches();
        let html = '';

        if (!query) {
            // Show recent searches
            if (recents.length === 0) { hideSuggestions(); return; }
            html += `<div style="padding:0.6rem 1rem 0.3rem; font-size:0.72rem; font-weight:700; color:#b3b3b3; letter-spacing:0.06em; text-transform:uppercase;">Recent Searches</div>`;
            html += recents.map(r => `
                <div class="suggest-item" data-query="${r.replace(/"/g, '&quot;')}"
                     style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 1rem; cursor:pointer; transition:background 0.15s;"
                     onmouseenter="this.style.background='#3a3a3a'" onmouseleave="this.style.background='transparent'">
                    <i class="fa-solid fa-clock-rotate-left" style="color:#b3b3b3; font-size:0.85rem; width:16px;"></i>
                    <span style="flex:1; font-size:0.88rem; font-weight:500;">${r}</span>
                    <i class="fa-solid fa-xmark" onclick="event.stopPropagation(); window._removeRecentSearch('${r.replace(/'/g, "\\'")}')"
                       style="color:#b3b3b3; font-size:0.8rem; padding:4px; border-radius:50%; transition:color 0.15s;"
                       onmouseenter="this.style.color='#fff'" onmouseleave="this.style.color='#b3b3b3'" title="Remove"></i>
                </div>
            `).join('');
        } else {
            // Fetch live song suggestions
            const suggestions = await fetchSuggestions(query);
            const combined = [];
            // Top matches from recents
            recents.filter(r => r.toLowerCase().includes(query.toLowerCase())).slice(0, 3).forEach(r => combined.push({ text: r, isRecent: true }));
            suggestions.forEach(s => { if (!combined.find(c => c.text === s)) combined.push({ text: s, isRecent: false }); });

            if (combined.length === 0) { hideSuggestions(); return; }

            html += combined.map(item => `
                <div class="suggest-item" data-query="${item.text.replace(/"/g, '&quot;')}"
                     style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 1rem; cursor:pointer; transition:background 0.15s;"
                     onmouseenter="this.style.background='#3a3a3a'" onmouseleave="this.style.background='transparent'">
                    <i class="fa-solid ${item.isRecent ? 'fa-clock-rotate-left' : 'fa-magnifying-glass'}" style="color:#b3b3b3; font-size:0.85rem; width:16px;"></i>
                    <span style="font-size:0.88rem; font-weight:500;">${item.text}</span>
                </div>
            `).join('');
        }

        el.innerHTML = html;
        el.style.display = 'block';

        // Bind click on suggestion rows
        el.querySelectorAll('.suggest-item').forEach(row => {
            row.addEventListener('click', () => {
                const q = row.dataset.query;
                searchInput.value = q;
                hideSuggestions();
                triggerSearch(q);
            });
        });
    }

    window._removeRecentSearch = removeRecentSearch;

    // ── Search Logic ─────────────────────────────────────────────────────────
    const searchResultsSection    = document.getElementById('search-results-section');
    const searchResultsContainer  = document.getElementById('search-results-container');
    const defaultSections         = document.querySelectorAll('.default-section');

    if (sidebarSearch && searchInput) {
        sidebarSearch.addEventListener('click', () => searchInput.focus());
    }

    async function searchTracks(query) {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=12&entity=song`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            return data.results.map(item => ({
                id:         item.trackId,
                name:       item.trackName,
                artist:     item.artistName,
                album:      item.collectionName,
                artwork:    item.artworkUrl100?.replace('100x100', '300x300'),
                previewUrl: item.previewUrl,
                duration:   item.trackTimeMillis
            }));
        } catch { return []; }
    }

    async function triggerSearch(query) {
        if (!query) return;
        saveRecentSearch(query);
        searchResultsContainer.innerHTML = `<div style="display:flex;align-items:center;gap:0.75rem;padding:1rem 0;color:#b3b3b3;"><i class="fa-solid fa-spinner fa-spin"></i> Searching for "${query}"...</div>`;
        searchResultsSection.style.display = 'block';
        defaultSections.forEach(s => s.style.display = 'none');
        document.getElementById('playlist-view-section').style.display = 'none';
        const tracks = await searchTracks(query);
        renderSearchResults(tracks, query);
    }

    window.currentSearchResults = [];

    window.playSearchSong = (i) => {
        const track = window.currentSearchResults[i];
        if (!track) return;
        if (window.YouTubeAPI && typeof window.YouTubeAPI.searchAndPlay === 'function') {
            const fallback = () => window.Player.play(track, true, window.currentSearchResults, i);
            window.YouTubeAPI.searchAndPlay(track, fallback);
        } else {
            window.Player.play(track, true, window.currentSearchResults, i);
        }
    };

    window.queueSearchSong = (i, e) => {
        e.stopPropagation();
        window.Queue.add(window.currentSearchResults[i]);
    };

    function renderSearchResults(tracks, query) {
        if (!searchResultsContainer) return;
        window.currentSearchResults = tracks;
        defaultSections.forEach(s => s.style.display = 'none');
        searchResultsSection.style.display = 'block';
        document.getElementById('search-results-heading').textContent =
            tracks.length ? `Results for "${query}"` : `No results for "${query}"`;

        if (!tracks.length) {
            searchResultsContainer.innerHTML = `<div style="color:#b3b3b3; padding:2rem 0;">No songs found. Try a different search.</div>`;
            return;
        }

        searchResultsContainer.innerHTML = tracks.map((t, i) => {
            const dur = t.duration ? window.Player.fmtTime(Math.floor(t.duration / 1000)) : '';
            return `
            <div class="track-row" style="display:flex; align-items:center; gap:1rem; padding:0.6rem 0.75rem; border-radius:6px; cursor:pointer; transition:background 0.15s;"
                 onmouseenter="this.style.background='#2a2a2a'" onmouseleave="this.style.background='transparent'"
                 oncontextmenu="window.ContextMenu.show(event, window.currentSearchResults[${i}], 'search', null, ${i})">
                <span style="color:#b3b3b3; font-size:0.85rem; width:18px; text-align:center; flex-shrink:0;">${i + 1}</span>
                <div style="position:relative; flex-shrink:0;">
                    <img src="${t.artwork || ''}" alt="${t.name}" style="width:44px; height:44px; border-radius:4px; object-fit:cover; background:#333;">
                </div>
                <div style="flex:1; overflow:hidden;" onclick="window.playSearchSong(${i})">
                    <p style="font-size:0.9rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:2px;">${t.name}</p>
                    <p style="font-size:0.78rem; color:#b3b3b3;">${t.artist}</p>
                </div>
                <span style="color:#b3b3b3; font-size:0.75rem; flex-shrink:0; min-width:36px; text-align:right;">${dur}</span>
                <span style="color:#b3b3b3; font-size:0.8rem; flex-shrink:0; display:flex; gap:0.75rem; align-items:center; margin-left:0.5rem;">
                    <i class="fa-brands fa-youtube" style="color:#ff0000; font-size:1rem;" title="Full song via YouTube"></i>
                    <i class="fa-solid fa-list" style="font-size:1.1rem; cursor:pointer;" title="Add to Queue"
                       onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#b3b3b3'"
                       onclick="window.queueSearchSong(${i}, event)"></i>
                    <i class="fa-solid fa-circle-plus" style="font-size:1.1rem; cursor:pointer;" title="Add to Playlist"
                       onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#b3b3b3'"
                       onclick="window.showPlaylistPickerLocal(${i}, event)"></i>
                </span>
            </div>`;
        }).join('');
    }

    if (searchInput) {
        let searchTimeout = null;
        searchInput.addEventListener('focus', () => {
            renderSuggestionsDropdown(searchInput.value.trim());
        });
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(searchTimeout);
            clearTimeout(suggestTimeout);

            if (!query) {
                searchResultsSection.style.display = 'none';
                document.getElementById('playlist-view-section').style.display = 'none';
                defaultSections.forEach(s => s.style.display = 'block');
                renderSuggestionsDropdown('');
                return;
            }

            // Show suggestions quickly
            suggestTimeout = setTimeout(() => renderSuggestionsDropdown(query), 200);
            // Trigger full search after pause
            searchTimeout = setTimeout(() => {
                hideSuggestions();
                triggerSearch(query);
            }, 600);
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = ''; searchInput.dispatchEvent(new Event('input')); searchInput.blur(); hideSuggestions();
            }
            if (e.key === 'Enter') {
                const q = searchInput.value.trim();
                if (q) { hideSuggestions(); clearTimeout(searchTimeout); clearTimeout(suggestTimeout); triggerSearch(q); }
            }
        });
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !(suggestionsEl && suggestionsEl.contains(e.target))) {
                hideSuggestions();
            }
        });
    }

    // ── Playlist creation ────────────────────────────────────────────────────
    const createBtn  = document.getElementById('create-playlist-btn');
    const createIcon = document.getElementById('create-playlist-icon');
    const createEvt  = () => { const name = prompt('Enter playlist name:', 'My Custom Playlist'); if (name) window.Playlist.create(name); };
    if (createBtn)  createBtn.addEventListener('click', createEvt);
    if (createIcon) createIcon.addEventListener('click', createEvt);

    // ── Playlist Picker popup ────────────────────────────────────────────────
    window.showPlaylistPickerLocal = (index, e) => {
        e.stopPropagation();
        const pls = window.Playlist.getPlaylists();
        if (pls.length === 0) { window.showToast('Create a playlist first!'); return; }
        let existing = document.getElementById('playlist-picker');
        if (existing) existing.remove();
        const picker = document.createElement('div');
        picker.id = 'playlist-picker';
        picker.style.cssText = `position:fixed; top:${e.clientY}px; left:${e.clientX - 160}px; background:#282828; border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.5); z-index:9999; padding:0.5rem; min-width:150px; border:1px solid #333;`;
        picker.innerHTML = `<div style="font-size:0.8rem; color:#b3b3b3; margin-bottom:0.5rem; padding:0 0.5rem;">Add to...</div>` +
            pls.map(p => `
                <div style="padding:0.5rem; font-size:0.85rem; font-weight:600; cursor:pointer; color:#fff; border-radius:4px;"
                     onmouseover="this.style.background='#3e3e3e'" onmouseout="this.style.background='transparent'"
                     onclick="window.Playlist.addSong(${p.id}, window.currentSearchResults[${index}]); document.getElementById('playlist-picker').remove();">${p.name}</div>
            `).join('');
        document.body.appendChild(picker);
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                const el = document.getElementById('playlist-picker'); if (el) el.remove();
                document.removeEventListener('click', closeMenu);
            });
        }, 100);
    };

    // ── Play All ─────────────────────────────────────────────────────────────
    const playAllBtn = document.getElementById('play-all-btn');
    if (playAllBtn) {
        playAllBtn.addEventListener('click', () => {
            if (window.currentPlaylistSongs && window.currentPlaylistSongs.length > 0) {
                window.Player.play(window.currentPlaylistSongs[0], true, window.currentPlaylistSongs, 0);
            } else { window.showToast('No songs to play!'); }
        });
    }

    // ── Browse Podcasts button ───────────────────────────────────────────────
    document.querySelectorAll('.badge').forEach(btn => {
        if (btn.textContent.trim() === 'Browse podcasts') {
            btn.addEventListener('click', () => {
                window.open('https://open.spotify.com/genre/podcasts-page', '_blank');
            });
        }
    });

    // ── Delegates ────────────────────────────────────────────────────────────
    window.viewPlaylistLocal   = window.Playlist.view;
    window.renamePlaylistLocal = window.Playlist.rename;
    window.deletePlaylistLocal = window.Playlist.delete;

    const navOptions = document.getElementById('nav-options');
    if (navOptions) navOptions.innerHTML = '';

    // ── Keyboard Shortcuts ────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        // Don't fire when user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.code === 'Space') {
            e.preventDefault();
            window.Player.togglePlay();
        }
        if (e.code === 'ArrowRight' && !e.shiftKey) {
            e.preventDefault();
            const pb = document.getElementById('progress-bar');
            const cur = parseFloat(pb?.value || 0);
            window.Player.seek(cur + 10);
        }
        if (e.code === 'ArrowLeft' && !e.shiftKey) {
            e.preventDefault();
            const pb = document.getElementById('progress-bar');
            const cur = parseFloat(pb?.value || 0);
            window.Player.seek(Math.max(0, cur - 10));
        }
        if (e.code === 'KeyN') window.Player.next();
        if (e.code === 'KeyP') window.Player.prev();
    });
}
