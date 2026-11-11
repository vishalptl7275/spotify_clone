// Spotify API Integration
const SPOTIFY_TOKEN = 'BQDMXq-xTmEw9mh_W4lFXHeXjN8MBBmrvawYWZvb7w0WjF3YHUoi-oSuyliL1qmwXkuhKAC3MboPf97UukH8_apeHfo_DZWeKytePmlEnCr2oBZr-6zHM4TgI9pI2VWWsnY3kRezL66NdjTzHCrP4_HKpul80ULn7NqbeYOYsiPKzR9e_X3qBzXVeLn3k2UUI0VqHT-ydVZ2nmHIK8QQaZh0UlXfX4tP-LbDsuLNgU0stErOLz6PHpXkhNQlUZ5qtw4NB2MkwOLlN-I7URS9nzvEWxQDx7vqNPZgS1BYnFciElw_t34se8luGBc9gUzCW8tO';

async function fetchWebApi(endpoint, method, body) {
  const res = await fetch(`https://api.spotify.com/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${SPOTIFY_TOKEN}`,
    },
    method,
    body: body ? JSON.stringify(body) : undefined
  });
  return await res.json();
}

async function getTopTracks(){
  try {
    const data = await fetchWebApi('v1/me/top/tracks?time_range=long_term&limit=5', 'GET');
    return data.items || [];
  } catch (error) {
    console.error("Error fetching Spotify Top Tracks:", error);
    return [];
  }
}

window.SpotifyAPI = {
    getTopTracks,
    init: async () => {
        // Fetch top tracks
        const topTracks = await getTopTracks();
        if (!topTracks || topTracks.length === 0) return;

        // Render to "Recently Played" section if found
        const firstSection = document.querySelector('.default-section .cards-container');
        if (firstSection) {
            const heading = firstSection.previousElementSibling;
            if (heading && heading.tagName === 'H2') {
                heading.textContent = 'Your Top Tracks (Spotify)';
            }
            // Use Spotify mapping...
            firstSection.innerHTML = topTracks.map((track) => {
                const imageUrl = track.album?.images?.[0]?.url || './assets/images/card1img.jpeg';
                const trackName = track.name.replace(/'/g, "\\'");
                const artists = (track.artists?.map(a => a.name).join(', ') || 'Unknown Artist').replace(/'/g, "\\'");
                const previewUrl = track.preview_url || '';
                
                return `
                    <div class="card" onclick="window.playSpotifySong('${trackName}', '${artists}', '${imageUrl}', '${previewUrl}')">
                        <div class="card-img-wrapper">
                            <img src="${imageUrl}" class="card-img" alt="${trackName}">
                            <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
                        </div>
                        <p class="card-tittle" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${trackName}">${trackName}</p>
                        <p class="card-info" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${artists}">${artists}</p>
                    </div>
                `;
            }).join('');
        }

        // Demo YouTube Full Songs implementation on the second section
        const sections = document.querySelectorAll('.default-section .cards-container');
        if (sections.length > 1) {
             const ytSection = sections[1];
             const heading = ytSection.previousElementSibling;
             if (heading && heading.tagName === 'H2') {
                 heading.textContent = 'Full Songs (YouTube Powered)';
             }
             
             // Hardcoded demonstration of famous songs matched manually to YouTube audio-only or lyric videos.
             const ytTracks = [
                 { id: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi', img: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg' },
                 { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', img: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg' },
                 { id: 'kffacxfA7G4', title: 'Baby', artist: 'Justin Bieber', img: 'https://i.ytimg.com/vi/kffacxfA7G4/hqdefault.jpg' }
             ];

             ytSection.innerHTML = ytTracks.map((track) => {
                 const tName = track.title.replace(/'/g, "\\'");
                 const tArtist = track.artist.replace(/'/g, "\\'");
                 return `
                     <div class="card" onclick="if(window.YouTubeAPI) window.YouTubeAPI.playVideo('${track.id}', '${tName}', '${tArtist}', '${track.img}')">
                         <div class="card-img-wrapper">
                             <img src="${track.img}" class="card-img" alt="${track.title}" style="object-fit:cover;">
                             <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
                         </div>
                         <p class="card-tittle" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${track.title}">${track.title}</p>
                         <p class="card-info" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${track.artist}">${track.artist}</p>
                     </div>
                 `;
             }).join('');
        }
    }
};

window.playSpotifySong = (name, artist, image, previewUrl) => {
    // We map Spotify track format to the expected format for our Player (similar to iTunes)
    const trackObj = {
        name: name,
        artist: artist,
        artwork: image,
        previewUrl: previewUrl || null, // null if no preview
        id: 'spotify-' + Date.now()
    };
    
    if (window.Player && typeof window.Player.play === 'function') {
        if (!previewUrl) {
            window.showToast("No 30s preview available for this track on Spotify.");
        }
        window.Player.play(trackObj, true, [trackObj], 0);
    }
};
