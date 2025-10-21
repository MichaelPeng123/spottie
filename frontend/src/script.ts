const clientId = import.meta.env.CLIENT_ID;
const BACKEND_URL = "http://127.0.0.1:5000"; // Backend API URL

// Main initialization
async function init() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    
    // Check if we have a stored access token
    const storedToken = localStorage.getItem("access_token");
    const tokenExpiry = localStorage.getItem("token_expiry");
    
    // Check if stored token is still valid
    if (storedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
        console.log("Using stored access token");
        await loadUserData(storedToken);
        return;
    }
    
    // If we have a code, exchange it for a token
    if (code) {
        try {
            const accessToken = await getAccessToken(clientId, code);
            
            // Store the token with 1 hour expiry (Spotify tokens typically last 1 hour)
            localStorage.setItem("access_token", accessToken);
            localStorage.setItem("token_expiry", (Date.now() + 3600000).toString()); // 1 hour
            
            // Clean up the URL (remove the code parameter)
            window.history.replaceState({}, document.title, "/");
            
            await loadUserData(accessToken);
        } catch (error) {
            console.error("Error getting access token:", error);
            // Clear any stored tokens and redirect to auth
            localStorage.removeItem("access_token");
            localStorage.removeItem("token_expiry");
            localStorage.removeItem("verifier");
            redirectToAuthCodeFlow(clientId);
        }
    } else {
        // No code and no valid token, start auth flow
        console.log("No code or valid token found, redirecting to auth code flow");
        redirectToAuthCodeFlow(clientId);
    }
}

async function loadUserData(accessToken: string) {
    try {
        const profile = await fetchProfile(accessToken);
        console.log("Profile:", profile);
        
        // Display top tracks
        // const topTracks = await fetchTopTracks(accessToken);
        // console.log("Top 5 Songs:", topTracks);
        // displayTopTracks(topTracks);
        
        // Fetch and categorize saved tracks by genre (using backend)
        const categorizedTracks = await fetchCategorizedTracks(accessToken, 50);
        console.log("Categorized Tracks:", categorizedTracks);
        displayCategorizedTracks(categorizedTracks);
    } catch (error) {
        console.error("Error loading user data:", error);
        // If we get an auth error, clear tokens and restart auth flow
        localStorage.removeItem("access_token");
        localStorage.removeItem("token_expiry");
        localStorage.removeItem("verifier");
        redirectToAuthCodeFlow(clientId);
    }
}

// Start the app
init();

async function redirectToAuthCodeFlow(clientId: string) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", "http://127.0.0.1:5173/callback");
    params.append("scope", "user-read-private user-read-email user-top-read user-library-read");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateCodeVerifier(length: number) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier: string) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function getAccessToken(clientId: string, code: string) {
    const verifier = localStorage.getItem("verifier");

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", "http://127.0.0.1:5173/callback");
    params.append("code_verifier", verifier!);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const { access_token } = await result.json();
    return access_token;
}

async function fetchProfile(token: string): Promise<any> {
    const result = await fetch(`${BACKEND_URL}/api/profile`, {
        method: "GET", 
        headers: { Authorization: `Bearer ${token}` }
    });

    return await result.json();
}

async function fetchTopTracks(token: string, limit: number = 5, timeRange: string = 'medium_term'): Promise<any> {
    const result = await fetch(`${BACKEND_URL}/api/top-tracks?limit=${limit}&time_range=${timeRange}`, {
        method: "GET", 
        headers: { Authorization: `Bearer ${token}` }
    });

    return await result.json();
}

async function fetchSavedTracks(token: string, limit: number = 20): Promise<any> {
    const result = await fetch(`${BACKEND_URL}/api/saved-tracks?limit=${limit}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
    });

    return await result.json();
}

async function fetchArtistGenres(token: string, artistIds: string[]): Promise<any> {
    const result = await fetch(`${BACKEND_URL}/api/artists`, {
        method: "POST",
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ artist_ids: artistIds })
    });

    return await result.json();
}

async function fetchCategorizedTracks(token: string, limit: number = 50): Promise<any> {
    const result = await fetch(`${BACKEND_URL}/api/categorized-tracks`, {
        method: "POST",
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit })
    });

    return await result.json();
}

// Keep these helper functions for potential local use
async function enrichTracksWithGenres(token: string, tracks: any[]): Promise<any[]> {
    // Get all unique artist IDs
    const artistIds = [...new Set(tracks.flatMap((track: any) => 
        track.artists.map((artist: any) => artist.id)
    ))];

    // Fetch genres for all artists
    const artistGenreMap = await fetchArtistGenres(token, artistIds);

    // Add genres to each track
    return tracks.map((track: any) => ({
        ...track,
        genres: [...new Set(track.artists.flatMap((artist: any) => 
            artistGenreMap[artist.id] || []
        ))]
    }));
}

function categorizeTracksByGenre(tracks: any[]): { [genre: string]: any[] } {
    const categorized: { [genre: string]: any[] } = {};

    tracks.forEach((track: any) => {
        if (track.genres && track.genres.length > 0) {
            // Add track to each of its genres
            track.genres.forEach((genre: string) => {
                if (!categorized[genre]) {
                    categorized[genre] = [];
                }
                categorized[genre].push(track);
            });
        } else {
            // Tracks without genres go to "Uncategorized"
            if (!categorized['Uncategorized']) {
                categorized['Uncategorized'] = [];
            }
            categorized['Uncategorized'].push(track);
        }
    });

    // Sort genres by number of tracks (descending)
    const sortedCategories: { [genre: string]: any[] } = {};
    Object.keys(categorized)
        .sort((a, b) => categorized[b].length - categorized[a].length)
        .forEach(genre => {
            sortedCategories[genre] = categorized[genre];
        });

    return sortedCategories;
}

function displayTopTracks(tracks: any[]) {
    console.log("\n🎵 Your Top 5 Songs:");
    tracks.forEach((track, index) => {
        const artists = track.artists.map((artist: any) => artist.name).join(", ");
        console.log(`${index + 1}. ${track.name} by ${artists}`);
        console.log(`   Album: ${track.album.name}`);
        console.log(`   Popularity: ${track.popularity}/100`);
        console.log(`   Preview: ${track.preview_url || 'Not available'}\n`);
    });
    
    // Also display on the page
    const app = document.querySelector<HTMLDivElement>('#app');
    if (app) {
        const html = `
            <h1>🎵 Your Top 5 Songs</h1>
            ${tracks.map((track, index) => {
                const artists = track.artists.map((artist: any) => artist.name).join(", ");
                return `
                    <div class="track-container">
                        <div>
                            <span class="track-number">${index + 1}</span>
                            <span class="track-name">${track.name}</span>
                        </div>
                        <div class="track-info">
                            <div class="track-details">
                                <p><strong>Artist:</strong> ${artists}</p>
                                <p><strong>Album:</strong> ${track.album.name}</p>
                                <p><strong>Popularity:</strong> ${track.popularity}/100</p>
                            </div>
                            ${track.preview_url ? `<audio controls><source src="${track.preview_url}" type="audio/mpeg">Your browser does not support the audio element.</audio>` : '<p style="margin-top: 10px; opacity: 0.7;">No preview available</p>'}
                        </div>
                    </div>
                `;
            }).join('')}
        `;
        app.innerHTML = html;
    }
}

function displaySavedTracks(tracks: any[]) {
    console.log("\n💚 Your Saved Tracks (Liked Songs):");
    tracks.forEach((track, index) => {
        const artists = track.artists.map((artist: any) => artist.name).join(", ");
        console.log(`${index + 1}. ${track.name} by ${artists}`);
        console.log(`   Album: ${track.album.name}`);
        console.log(`   Added: ${new Date(track.added_at).toLocaleDateString()}`);
        console.log(`   Popularity: ${track.popularity}/100\n`);
    });
    
    // Also display on the page
    const app = document.querySelector<HTMLDivElement>('#app');
    if (app) {
        const html = `
            <h1>💚 Your Saved Tracks</h1>
            <p style="text-align: center; margin-bottom: 30px; opacity: 0.9;">Your liked songs library (${tracks.length} shown)</p>
            ${tracks.map((track, index) => {
                const artists = track.artists.map((artist: any) => artist.name).join(", ");
                const addedDate = new Date(track.added_at).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
                return `
                    <div class="track-container">
                        <div>
                            <span class="track-number">${index + 1}</span>
                            <span class="track-name">${track.name}</span>
                        </div>
                        <div class="track-info">
                            <div class="track-details">
                                <p><strong>Artist:</strong> ${artists}</p>
                                <p><strong>Album:</strong> ${track.album.name}</p>
                                <p><strong>Added:</strong> ${addedDate}</p>
                                <p><strong>Popularity:</strong> ${track.popularity}/100</p>
                            </div>
                            ${track.preview_url ? `<audio controls><source src="${track.preview_url}" type="audio/mpeg">Your browser does not support the audio element.</audio>` : '<p style="margin-top: 10px; opacity: 0.7;">No preview available</p>'}
                        </div>
                    </div>
                `;
            }).join('')}
        `;
        app.innerHTML = html;
    }
}

function displayCategorizedTracks(categorizedTracks: { [genre: string]: any[] }) {
    console.log("\n🎭 Your Saved Tracks by Genre:");
    
    Object.entries(categorizedTracks).forEach(([genre, tracks]) => {
        console.log(`\n${genre.toUpperCase()} (${tracks.length} tracks):`);
        tracks.slice(0, 3).forEach((track: any) => {
            const artists = track.artists.map((artist: any) => artist.name).join(", ");
            console.log(`  - ${track.name} by ${artists}`);
        });
    });

    // Display on the page
    const app = document.querySelector<HTMLDivElement>('#app');
    if (app) {
        const totalTracks = Object.values(categorizedTracks).reduce((sum, tracks) => sum + tracks.length, 0);
        const genreCount = Object.keys(categorizedTracks).length;
        
        const html = `
            <h1>🎭 Your Music by Genre</h1>
            <p style="text-align: center; margin-bottom: 30px; opacity: 0.9;">
                ${totalTracks} tracks across ${genreCount} genres
            </p>
            
            ${Object.entries(categorizedTracks).map(([genre, tracks]) => {
                const genreEmoji = getGenreEmoji(genre);
                return `
                    <div class="genre-section">
                        <h2 style="color: #1db954; font-size: 1.3rem;">
                            ${genreEmoji} ${capitalizeGenre(genre)} 
                            <span style="font-size: 0.9rem; opacity: 0.8;">(${tracks.length})</span>
                        </h2>
                        ${tracks.map((track: any, index: number) => {
                            const artists = track.artists.map((artist: any) => artist.name).join(", ");
                            const addedDate = new Date(track.added_at).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric'
                            });
                            return `
                                <div class="track-container">
                                    <span class="track-number">${index + 1}</span>
                                    <div class="track-info">
                                        <div class="track-header">
                                            <span class="track-name">${track.name}</span>
                                        </div>
                                        <div class="track-details">
                                            <span><strong>Artist:</strong> ${artists}</span>
                                            <span><strong>Album:</strong> ${track.album.name}</span>
                                            <span><strong>Added:</strong> ${addedDate}</span>
                                            <span><strong>♥</strong> ${track.popularity}/100</span>
                                        </div>
                                        ${track.preview_url ? `<div class="audio-container"><audio controls><source src="${track.preview_url}" type="audio/mpeg"></audio></div>` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }).join('')}
        `;
        app.innerHTML = html;
    }
}

function capitalizeGenre(genre: string): string {
    return genre.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function getGenreEmoji(genre: string): string {
    const genreLower = genre.toLowerCase();
    
    if (genreLower.includes('rock')) return '🎸';
    if (genreLower.includes('pop')) return '🎤';
    if (genreLower.includes('hip hop') || genreLower.includes('rap')) return '🎧';
    if (genreLower.includes('jazz')) return '🎷';
    if (genreLower.includes('classical')) return '🎻';
    if (genreLower.includes('electronic') || genreLower.includes('edm')) return '🎹';
    if (genreLower.includes('country')) return '🤠';
    if (genreLower.includes('r&b') || genreLower.includes('soul')) return '💜';
    if (genreLower.includes('metal')) return '🤘';
    if (genreLower.includes('indie')) return '🌟';
    if (genreLower.includes('folk')) return '🪕';
    if (genreLower.includes('latin')) return '💃';
    if (genreLower.includes('reggae')) return '🌴';
    if (genreLower.includes('blues')) return '🎺';
    if (genreLower.includes('punk')) return '⚡';
    if (genreLower.includes('disco')) return '🕺';
    if (genreLower.includes('funk')) return '🎵';
    
    return '🎵';
}