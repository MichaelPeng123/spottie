# Spottie - Spotify Music Analyzer

A full-stack application that analyzes your Spotify music library and categorizes your saved tracks by genre.

## Architecture

- **Frontend**: Vite + TypeScript (handles OAuth authentication and UI)
- **Backend**: Flask + Python (handles Spotify API calls)

## Features

- 🎵 View your top tracks
- 💚 Browse your saved tracks (liked songs)
- 🎭 Categorize your music by genre
- 🎨 Beautiful, modern UI with glassmorphism design
- 🎧 Audio previews for tracks

## Setup

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment (optional but recommended):
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the Flask server:
```bash
python server.py
```

The backend will run on `http://127.0.0.1:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Update `src/script.ts` with your Spotify Client ID:
```typescript
const clientId = "YOUR_SPOTIFY_CLIENT_ID";
```

4. Run the development server:
```bash
npm run dev
```

The frontend will run on `http://127.0.0.1:5173`

### Spotify App Configuration

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `http://127.0.0.1:5173/callback` to the Redirect URIs
4. Copy your Client ID and paste it in `frontend/src/script.ts`

## API Endpoints

### Backend API

- `GET /api/profile` - Get user profile
- `GET /api/top-tracks?limit=5&time_range=medium_term` - Get user's top tracks
- `GET /api/saved-tracks?limit=20` - Get user's saved tracks
- `POST /api/artists` - Get artist information and genres
- `POST /api/categorized-tracks` - Get saved tracks categorized by genre
- `GET /health` - Health check

All endpoints require an `Authorization: Bearer <token>` header with the Spotify access token.

## How It Works

1. **Authentication Flow** (Frontend):
   - User clicks login
   - Redirected to Spotify OAuth
   - Returns with authorization code
   - Frontend exchanges code for access token

2. **Data Fetching** (Backend):
   - Frontend sends access token to backend
   - Backend makes requests to Spotify API
   - Backend processes and categorizes data
   - Returns formatted data to frontend

3. **Display** (Frontend):
   - Receives categorized data
   - Renders beautiful UI with genre sections
   - Shows track details and audio previews

## Tech Stack

### Frontend
- Vite
- TypeScript
- HTML5/CSS3

### Backend
- Flask
- Python 3
- Requests library
- Flask-CORS

## Development

To run both servers simultaneously:

```bash
# Terminal 1 - Backend
cd backend
python server.py

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Environment Variables

### Backend (Optional)
- `PORT` - Port for Flask server (default: 5000)

### Frontend
Update these in `src/script.ts`:
- `clientId` - Your Spotify Client ID
- `BACKEND_URL` - Backend API URL (default: http://127.0.0.1:5000)

## License

MIT

