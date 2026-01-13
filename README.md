# YouTube Transcript Tool

A Node.js tool to pull transcripts from your YouTube channel uploads.

## Features

- Fetch all video uploads from your YouTube channel
- Download transcripts with timestamps
- Save as individual text files
- Generates summary JSON with metadata
- Single video mode for quick transcript grabs

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Get a YouTube Data API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **YouTube Data API v3**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy your API key

### 3. Find your Channel ID

Your channel ID can be found at:
- [youtube.com/account_advanced](https://www.youtube.com/account_advanced)
- Or from your channel URL: `youtube.com/channel/UC...`

> **Note:** If you have a custom URL (`youtube.com/c/YourName` or `youtube.com/@YourHandle`), you'll need to look up the actual channel ID.

### 4. Configure environment

Copy the example env file and add your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```
YOUTUBE_API_KEY=AIza...your_key_here
YOUTUBE_CHANNEL_ID=UC...your_channel_id
```

## Usage

### Fetch all channel transcripts

```bash
npm start
```

This will:
1. Fetch all videos from your channel's uploads
2. **Skip videos that were already downloaded** (tracked in `downloaded.json`)
3. Download available transcripts for new videos
4. Save each as a `.md` file in `./transcripts/`
5. Create a `_summary.json` with metadata
6. Update the download log

### Download Log

The tool maintains a `downloaded.json` file that tracks which videos have been downloaded. On subsequent runs, it will skip any videos already in this log.

```json
{
  "downloaded": {
    "dQw4w9WgXcQ": {
      "title": "My Video Title",
      "filename": "My_Video_Title.md",
      "downloadedAt": "2025-01-13T20:30:00.000Z"
    }
  }
}
```

To re-download a specific video, remove its entry from `downloaded.json`.

### Fetch a single video transcript

```bash
npm run single -- VIDEO_ID_OR_URL
```

Or directly:

```bash
node single-video.js dQw4w9WgXcQ
node single-video.js "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
node single-video.js "https://youtu.be/dQw4w9WgXcQ"
```

## Output Format

Each transcript file is saved as markdown:

```markdown
# My Video Title

- **Video ID:** dQw4w9WgXcQ
- **URL:** [Watch on YouTube](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
- **Published:** January 15, 2024

## Transcript

First line of transcript second line of transcript continues as flowing text...
```

## Limitations

- **Transcripts only work for videos with captions** (auto-generated or manual)
- Some videos may have captions disabled by the owner
- API quota: YouTube Data API has daily limits (~10,000 units/day)
  - Getting channel info: 1 unit
  - Getting playlist items: 1 unit per request (50 videos/request)
  
## Troubleshooting

### "Transcript not available"

- Video doesn't have captions enabled
- Captions are set to private
- Video is age-restricted or region-locked

### "API Error 403"

- API key is invalid or restricted
- YouTube Data API not enabled for your project
- Quota exceeded (try again tomorrow)

### Can't find Channel ID

If you only have a custom URL or handle:
1. Go to the channel page
2. Right-click → View Page Source
3. Search for `"channelId"` - you'll find it in the JSON data

## Extending

To limit the number of videos processed, modify `index.js`:

```javascript
// Get only the 10 most recent videos
const videos = await getPlaylistVideos(uploadsPlaylistId, 10);
```

To save transcripts in different formats, use the helper functions:

```javascript
// Plain text (no timestamps)
formatTranscript(transcript)

// With timestamps
formatTranscriptWithTimestamps(transcript)

// Raw data
transcript // Array of { text, offset, duration }
```
