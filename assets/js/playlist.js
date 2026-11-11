const Playlist = {
    create: (name) => {
        const p = Storage.get('playlists') || [];
        const newPlaylist = { id: Date.now(), name, songs: [] };
        p.push(newPlaylist);
        Storage.set('playlists', p);
        if (window.showToast) window.showToast('Playlist created');
        Playlist.renderSidebar();
    },
    rename: (id, newName) => {
        const p = Storage.get('playlists') || [];
        const pl = p.find(x => x.id === id);
        if (pl) {
            pl.name = newName;
            Storage.set('playlists', p);
            if (window.showToast) window.showToast('Playlist renamed');
            Playlist.renderSidebar();
            // Upate UI if currently viewing this playlist
            const title = document.getElementById('playlist-view-title');
            if (title && window.currentPlaylistId === id) title.textContent = newName;
        }
    },
    delete: (id) => {
        let p = Storage.get('playlists') || [];
        p = p.filter(x => x.id !== id);
        Storage.set('playlists', p);
        if (window.showToast) window.showToast('Playlist deleted');
        Playlist.renderSidebar();
        
        // Hide view if looking at it
        if (window.currentPlaylistId === id) {
            document.getElementById('playlist-view-section').style.display = 'none';
        }
    },
    addSong: (id, song) => {
        const p = Storage.get('playlists') || [];
        const pl = p.find(x => x.id === id);
        if (pl) {
            pl.songs.push(song);
            Storage.set('playlists', p);
            if (window.showToast) window.showToast(`Added to ${pl.name}`);
        }
    },
    removeSong: (id, songId) => {
        const p = Storage.get('playlists') || [];
        const pl = p.find(x => x.id === id);
        if (pl) {
            pl.songs = pl.songs.filter(s => String(s.id || s.itunes_id) !== String(songId));
            Storage.set('playlists', p);
            if (window.showToast) window.showToast('Removed from playlist');
            // Re-render if viewing
            if (window.currentPlaylistId === id) Playlist.view(id);
        }
    },
    moveSong: (id, fromIndex, toIndex) => {
        const p = Storage.get('playlists') || [];
        const pl = p.find(x => x.id === id);
        if (pl && pl.songs.length > 0) {
            if (toIndex < 0) toIndex = 0;
            if (toIndex >= pl.songs.length) toIndex = pl.songs.length - 1;
            const song = pl.songs.splice(fromIndex, 1)[0];
            pl.songs.splice(toIndex, 0, song);
            Storage.set('playlists', p);
            if (window.currentPlaylistId === id) Playlist.view(id);
        }
    },
    getPlaylists: () => Storage.get('playlists') || [],
    renderSidebar: () => {
        const listContainer = document.getElementById('user-playlists');
        const noBox = document.getElementById('no-playlists-box');
        if (!listContainer) return;
        
        const playlists = Playlist.getPlaylists();
        if (playlists.length > 0) {
            if (noBox) noBox.style.display = 'none';
            listContainer.innerHTML = playlists.map(p => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem; background:#121212; border-radius:4px; font-size:0.9rem; font-weight:600; cursor:pointer;"
                     onmouseover="this.style.background='#282828'" onmouseout="this.style.background='#121212'">
                    <div style="flex:1;" onclick="Playlist.view(${p.id})">
                        <i class="fa-solid fa-music" style="color:#b3b3b3; margin-right:8px;"></i> ${p.name}
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <i class="fa-solid fa-pen" style="color:#b3b3b3; font-size:0.85rem;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#b3b3b3'" 
                            onclick="event.stopPropagation(); const n=prompt('New name', '${p.name.replace(/'/g, "\\'")}'); if(n) Playlist.rename(${p.id}, n);"></i>
                        <i class="fa-solid fa-trash" title="Delete playlist" style="color:#b3b3b3; font-size:0.85rem;" onmouseover="this.style.color='#ff5757'" onmouseout="this.style.color='#b3b3b3'" 
                            onclick="event.stopPropagation(); if(confirm('Delete playlist?')) Playlist.delete(${p.id});"></i>
                    </div>
                </div>
            `).join('');
        } else {
            if (noBox) noBox.style.display = 'block';
            listContainer.innerHTML = '';
        }
    },
    view: (id) => {
        const p = Storage.get('playlists') || [];
        const pl = p.find(x => x.id === id);
        if (!pl) return;
        
        window.currentPlaylistId = id;
        
        // Hide default sections
        document.querySelectorAll('.default-section').forEach(s => s.style.display = 'none');
        const sr = document.getElementById('search-results-section');
        if(sr) sr.style.display = 'none';
        
        const pv = document.getElementById('playlist-view-section');
        if (pv) pv.style.display = 'block';
        
        document.getElementById('playlist-view-title').textContent = pl.name;
        document.getElementById('playlist-view-info').textContent = `${pl.songs.length} songs`;
        
        const container = document.getElementById('playlist-songs-container');
        window.currentPlaylistSongs = pl.songs;
        
        if (pl.songs.length === 0) {
            container.innerHTML = '<p style="color:#b3b3b3; padding:1rem 0;">No songs in this playlist yet. Search for songs to add them!</p>';
            return;
        }
        
        container.innerHTML = pl.songs.map((s, i) => `
            <div class="track-row" style="display:flex; align-items:center; gap:1rem; padding:0.6rem 0.75rem; border-radius:6px; cursor:pointer; transition:background 0.15s; margin-bottom: 0.25rem;" 
                 onmouseenter="this.style.background='#2a2a2a'" onmouseleave="this.style.background='transparent'"
                 oncontextmenu="window.ContextMenu.show(event, window.currentPlaylistSongs[${i}], 'playlist', ${id}, ${i})">
                <span style="color:#b3b3b3; font-size:0.85rem; width:18px; text-align:center;">${i + 1}</span>
                <div style="position:relative; flex-shrink:0;">
                    <img src="${s.artwork || s.artwork_url || ''}" alt="${s.name || s.title}" style="width:44px; height:44px; border-radius:4px; object-fit:cover; background:#333;">
                </div>
                <div style="flex:1; overflow:hidden;" onclick="window.Player.play(window.currentPlaylistSongs[${i}], true, window.currentPlaylistSongs, ${i})">
                    <p style="font-size:0.9rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:2px;">${s.name || s.title}</p>
                    <p style="font-size:0.78rem; color:#b3b3b3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.artist}</p>
                </div>
                <span style="color:#b3b3b3; font-size:0.8rem; flex-shrink:0; display:flex; align-items:center; gap:0.75rem;">
                    ${s.previewUrl || s.preview_url ? '<i class="fa-solid fa-headphones" title="Preview available" style="color:#1DB954;"></i>' : '<i class="fa-solid fa-ban" title="No preview" style="opacity:0.4;"></i>'}
                    0:30
                    <i class="fa-solid fa-trash-can" style="font-size:1rem; cursor:pointer;" title="Remove from Playlist" onmouseover="this.style.color='#ff5757'" onmouseout="this.style.color='#b3b3b3'" onclick="Playlist.removeSong(${id}, '${s.id || s.itunes_id}')"></i>
                </span>
            </div>
        `).join('');
    }
};

window.Playlist = Playlist;
