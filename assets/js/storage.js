const Storage = {
    get: (key) => {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch (e) {
            return null;
        }
    },
    set: (key, val) => {
        localStorage.setItem(key, JSON.stringify(val));
    },
    init: () => {
        if (!Storage.get('playlists')) Storage.set('playlists', []);
        if (!Storage.get('liked_songs')) Storage.set('liked_songs', []);
        if (!Storage.get('queue')) Storage.set('queue', []);
        if (!Storage.get('recently_played')) Storage.set('recently_played', []);
        if (!localStorage.getItem('last_played')) Storage.set('last_played', null);
    }
};

window.Storage = Storage;
