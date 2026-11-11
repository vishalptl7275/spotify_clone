const ContextMenu = {
    init: () => {
        let menu = document.getElementById('custom-context-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'custom-context-menu';
            menu.style.cssText = `
                position: fixed;
                z-index: 10000;
                background: #282828;
                border-radius: 4px;
                box-shadow: 0 16px 24px rgba(0,0,0,0.5), 0 6px 8px rgba(0,0,0,0.3);
                display: none;
                flex-direction: column;
                min-width: 180px;
                padding: 4px;
                border: 1px solid #3e3e3e;
                color: #fff;
                font-size: 0.85rem;
                font-weight: 500;
                font-family: inherit;
            `;
            document.body.appendChild(menu);

            // Hide menu on any click
            document.addEventListener('click', () => {
                menu.style.display = 'none';
            });
            
            // Hide menu on scroll
            window.addEventListener('scroll', () => {
                menu.style.display = 'none';
            }, true);
        }
    },

    show: (e, song, source, playlistId = null, index = null) => {
        e.preventDefault();
        e.stopPropagation();

        ContextMenu.init();
        const menu = document.getElementById('custom-context-menu');
        menu.innerHTML = '';

        // Option: Play
        menu.appendChild(ContextMenu.createItem('fa-play', 'Play', () => {
            if (source === 'playlist') {
                window.Player.play(song, true, window.currentPlaylistSongs, index);
            } else if (source === 'search') {
                window.Player.play(song, true, window.currentSearchResults, index);
            } else {
                window.Player.play(song);
            }
        }));

        // Option: Add to Queue
        menu.appendChild(ContextMenu.createItem('fa-list', 'Add to Queue', () => {
            window.Queue.add(song);
        }));

        // Option: Add to Playlist (re-uses existing picker)
        menu.appendChild(ContextMenu.createItem('fa-circle-plus', 'Add to Playlist', (e) => {
            if (window.showPlaylistPickerLocal) {
                // If it's a search result, it expects an index. If not, we can simulate a fake array.
                if (source === 'search') {
                    window.showPlaylistPickerLocal(index, e);
                } else {
                    // Temporarily set it to the search array so our existing method works perfectly
                    const prev = window.currentSearchResults;
                    window.currentSearchResults = [song];
                    window.showPlaylistPickerLocal(0, e);
                    setTimeout(() => window.currentSearchResults = prev, 500);
                }
            }
        }));
        
        // Option: Like Song
        menu.appendChild(ContextMenu.createItem('fa-heart', 'Like / Unlike', () => {
            let liked = window.Storage.get('liked_songs') || [];
            const trackId = song.id || song.itunes_id;
            const isLiked = liked.some(x => (x.id || x.itunes_id) === trackId);
            
            if (isLiked) {
                liked = liked.filter(x => (x.id || x.itunes_id) !== trackId);
                if (window.showToast) window.showToast('Removed from Liked Songs');
            } else {
                liked.push(song);
                if (window.showToast) window.showToast('Added to Liked Songs');
            }
            window.Storage.set('liked_songs', liked);
        }));

        // Playlist specific options
        if (source === 'playlist' && playlistId) {
            menu.appendChild(ContextMenu.createDivider());

            if (index > 0) {
                menu.appendChild(ContextMenu.createItem('fa-arrow-up', 'Move Up', () => {
                    Playlist.moveSong(playlistId, index, index - 1);
                }));
            }
            if (index < window.currentPlaylistSongs.length - 1) {
                menu.appendChild(ContextMenu.createItem('fa-arrow-down', 'Move Down', () => {
                    Playlist.moveSong(playlistId, index, index + 1);
                }));
            }

            menu.appendChild(ContextMenu.createDivider());

            menu.appendChild(ContextMenu.createItem('fa-trash-can', 'Remove from this Playlist', () => {
                Playlist.removeSong(playlistId, song.id || song.itunes_id);
            }, '#ff5757'));
        }

        // Display Menu
        menu.style.display = 'flex';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;

        // Adjust bounds
        const rect = menu.getBoundingClientRect();
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${window.innerHeight - rect.height - 10}px`;
        }
        if (rect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
    },

    createItem: (iconClass, text, onClick, color = '#fff') => {
        const div = document.createElement('div');
        div.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 12px;
            cursor: pointer;
            border-radius: 3px;
            color: ${color};
            transition: background 0.1s;
        `;
        div.onmouseenter = () => div.style.background = '#3e3e3e';
        div.onmouseleave = () => div.style.background = 'transparent';
        div.onclick = (e) => {
            e.stopPropagation();
            document.getElementById('custom-context-menu').style.display = 'none';
            onClick(e);
        };

        div.innerHTML = `<i class="fa-solid ${iconClass}" style="width: 14px; text-align:center;"></i> <span>${text}</span>`;
        return div;
    },

    createDivider: () => {
        const div = document.createElement('div');
        div.style.cssText = `
            height: 1px;
            background: #3e3e3e;
            margin: 4px 0;
        `;
        return div;
    }
};

window.ContextMenu = ContextMenu;
