const Queue = {
    add: (song) => {
        const q = Storage.get('queue') || [];
        q.push(song);
        Storage.set('queue', q);
        window.showToast && window.showToast('Song added to queue');
    },
    remove: (index) => {
        const q = Storage.get('queue') || [];
        q.splice(index, 1);
        Storage.set('queue', q);
        window.showToast && window.showToast('Song removed from queue');
    },
    next: () => {
        const q = Storage.get('queue') || [];
        if (q.length === 0) return null;
        const song = q.shift();
        Storage.set('queue', q);
        return song;
    },
    get: () => Storage.get('queue') || [],
    clear: () => {
        Storage.set('queue', []);
        window.showToast && window.showToast('Queue cleared');
    }
};

window.Queue = Queue;
