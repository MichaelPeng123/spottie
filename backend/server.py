from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

SPOTIFY_API_BASE = "https://api.spotify.com/v1"


def get_auth_header(token):
    """Helper function to create authorization header"""
    return {"Authorization": f"Bearer {token}"}


@app.route('/api/profile', methods=['GET'])
def get_profile():
    """Get user profile"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token:
        return jsonify({"error": "No token provided"}), 401
    
    try:
        response = requests.get(
            f"{SPOTIFY_API_BASE}/me",
            headers=get_auth_header(token)
        )
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), response.status_code if hasattr(response, 'status_code') else 500


@app.route('/api/top-tracks', methods=['GET'])
def get_top_tracks():
    """Get user's top tracks"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token:
        return jsonify({"error": "No token provided"}), 401
    
    limit = request.args.get('limit', 5)
    time_range = request.args.get('time_range', 'medium_term')
    
    try:
        response = requests.get(
            f"{SPOTIFY_API_BASE}/me/top/tracks",
            headers=get_auth_header(token),
            params={'limit': limit, 'time_range': time_range}
        )
        response.raise_for_status()
        data = response.json()
        return jsonify(data.get('items', []))
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), response.status_code if hasattr(response, 'status_code') else 500


@app.route('/api/saved-tracks', methods=['GET'])
def get_saved_tracks():
    """Get user's saved tracks (liked songs)"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token:
        return jsonify({"error": "No token provided"}), 401
    
    limit = request.args.get('limit', 20, type=int)
    
    try:
        response = requests.get(
            f"{SPOTIFY_API_BASE}/me/tracks",
            headers=get_auth_header(token),
            params={'limit': limit}
        )
        response.raise_for_status()
        data = response.json()
        
        # Transform data to include track + added_at
        tracks = []
        for item in data.get('items', []):
            track = item.get('track', {})
            track['added_at'] = item.get('added_at')
            tracks.append(track)
        
        return jsonify(tracks)
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), response.status_code if hasattr(response, 'status_code') else 500


@app.route('/api/artists', methods=['POST'])
def get_artists():
    """Get multiple artists by IDs"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token:
        return jsonify({"error": "No token provided"}), 401
    
    data = request.get_json()
    artist_ids = data.get('artist_ids', [])
    
    if not artist_ids:
        return jsonify({"error": "No artist IDs provided"}), 400
    
    try:
        # Spotify API allows up to 50 artists per request
        all_artists = []
        
        for i in range(0, len(artist_ids), 50):
            chunk = artist_ids[i:i + 50]
            response = requests.get(
                f"{SPOTIFY_API_BASE}/artists",
                headers=get_auth_header(token),
                params={'ids': ','.join(chunk)}
            )
            response.raise_for_status()
            data = response.json()
            all_artists.extend(data.get('artists', []))
        
        # Create artist ID to genres map
        artist_genre_map = {}
        for artist in all_artists:
            if artist:
                artist_genre_map[artist['id']] = artist.get('genres', [])
        
        return jsonify(artist_genre_map)
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), response.status_code if hasattr(response, 'status_code') else 500


@app.route('/api/categorized-tracks', methods=['POST'])
def get_categorized_tracks():
    """Get saved tracks categorized by genre"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token:
        return jsonify({"error": "No token provided"}), 401
    
    data = request.get_json()
    limit = data.get('limit', 5)
    
    try:
        # 1. Fetch saved tracks
        tracks_response = requests.get(
            f"{SPOTIFY_API_BASE}/me/tracks",
            headers=get_auth_header(token),
            params={'limit': limit}
        )
        tracks_response.raise_for_status()
        tracks_data = tracks_response.json()
        
        # Transform tracks
        tracks = []
        for item in tracks_data.get('items', []):
            track = item.get('track', {})
            track['added_at'] = item.get('added_at')
            tracks.append(track)
        
        # 2. Get all unique artist IDs
        artist_ids = list(set([
            artist['id']
            for track in tracks
            for artist in track.get('artists', [])
        ]))
        
        # 3. Fetch artist genres
        artist_genre_map = {}
        for i in range(0, len(artist_ids), 5):
            chunk = artist_ids[i:i + 5]
            artists_response = requests.get(
                f"{SPOTIFY_API_BASE}/artists",
                headers=get_auth_header(token),
                params={'ids': ','.join(chunk)}
            )
            artists_response.raise_for_status()
            artists_data = artists_response.json()
            
            for artist in artists_data.get('artists', []):
                if artist:
                    artist_genre_map[artist['id']] = artist.get('genres', [])
        
        # 4. Enrich tracks with genres
        for track in tracks:
            genres = set()
            for artist in track.get('artists', []):
                artist_genres = artist_genre_map.get(artist['id'], [])
                genres.update(artist_genres)
            track['genres'] = list(genres)
        
        # 5. Categorize by genre
        categorized = {}
        for track in tracks:
            if track.get('genres'):
                for genre in track['genres']:
                    if genre not in categorized:
                        categorized[genre] = []
                    categorized[genre].append(track)
            else:
                if 'Uncategorized' not in categorized:
                    categorized['Uncategorized'] = []
                categorized['Uncategorized'].append(track)
        
        # 6. Sort by number of tracks and get top 5 genres
        sorted_categorized = dict(
            sorted(categorized.items(), key=lambda x: len(x[1]), reverse=True)
        )
        
        # Get only top 5 genres
        top_5_genres = dict(list(sorted_categorized.items())[:5])
        
        return jsonify(top_5_genres)
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "Spotify Backend API"})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

