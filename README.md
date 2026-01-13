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
Also includes a MCP for turning transcripts into astro blog posts:

# Transcript MCP Server

An MCP server that gives Claude Code tools to process YouTube transcripts into blog posts.

## Tools Available

| Tool | Description |
|------|-------------|
| `list_transcripts` | List all transcript files |
| `read_transcript` | Read a specific transcript |
| `get_transcript_summary` | Get metadata and word count |
| `save_blog_post` | Save processed content with frontmatter |
| `list_blog_posts` | List saved blog posts |
| `read_blog_post` | Read an existing blog post |

## Setup

### 1. Install the MCP server

```bash
cd transcript-mcp
npm install
```

### 2. Configure Claude Code in VS Code

Open your Claude Code MCP settings. You can do this by:
- Opening the command palette (Cmd+Shift+P / Ctrl+Shift+P)
- Typing "Claude: Open MCP Settings"

Or manually edit the config file at:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Add this to your `mcpServers` section:

```json
{
  "mcpServers": {
    "transcript-mcp": {
      "command": "node",
      "args": ["/FULL/PATH/TO/transcript-mcp/index.js"],
      "env": {
        "TRANSCRIPTS_DIR": "/FULL/PATH/TO/your/transcripts",
        "BLOG_OUTPUT_DIR": "/FULL/PATH/TO/your/blog-posts"
      }
    }
  }
}
```

**Important:** Replace the paths with your actual full paths. For example:

```json
{
  "mcpServers": {
    "transcript-mcp": {
      "command": "node",
      "args": ["/Users/mattglbrt/Documents/dev/transcriptor/transcript-mcp/index.js"],
      "env": {
        "TRANSCRIPTS_DIR": "/Users/mattglbrt/Documents/dev/transcriptor/transcripts",
        "BLOG_OUTPUT_DIR": "/Users/mattglbrt/Documents/dev/transcriptor/blog-posts"
      }
    }
  }
}
```

### 3. Restart Claude Code

After saving the config, restart VS Code or reload the Claude Code extension.

## Usage Examples

Once configured, you can ask Claude Code things like:

**List your transcripts:**
> "What transcripts do I have available?"

**Process a transcript into a blog post:**
> "Read the transcript 'My_Video_Title.md' and turn it into a polished blog post. Extract appropriate categories and tags based on the content."

**Batch processing:**
> "List all my transcripts, then process each one into a blog post with proper frontmatter including title, description, categories, and tags."

**Get summaries:**
> "Give me a summary of all my transcripts including word counts"

## Blog Post Output Format

The `save_blog_post` tool creates `.mdx` files in your Astro blog format:

```mdx
---
title: "How to Paint Miniatures"
description: "A beginner's guide to miniature painting techniques"
pubDate: "2025-01-13 19:30:00"
category: "Tutorials"
youtubeId: "dQw4w9WgXcQ"
project: "motley-crews"
tags: ["miniatures", "painting", "tabletop gaming", "tutorial"]
---

import YouTubeEmbed from '../../../components/YouTubeEmbed.astro';

<YouTubeEmbed videoId="dQw4w9WgXcQ" title="How to Paint Miniatures" />

## Transcript

Your cleaned up transcript content here...
```

### Frontmatter Fields

| Field | Description |
|-------|-------------|
| `title` | Blog post title |
| `description` | Short description for SEO/previews |
| `pubDate` | Publication date (`YYYY-MM-DD HH:MM:SS`) |
| `category` | Single category (e.g., "Vlogs", "Tutorials") |
| `youtubeId` | YouTube video ID for embedding |
| `project` | Project slug if applicable |
| `tags` | Array of tags |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSCRIPTS_DIR` | `./transcripts` | Where to read transcripts from |
| `BLOG_OUTPUT_DIR` | `./blog-posts` | Where to save processed blog posts |

## Troubleshooting

### MCP server not showing up

1. Check the config file path is correct
2. Make sure you used full absolute paths (no `~` or relative paths)
3. Restart VS Code completely
4. Check the Claude Code output panel for errors

### Permission errors

Make sure the MCP server has read/write access to both directories.

### Test the server manually

```bash
cd transcript-mcp
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node index.js
```

You should see a JSON response listing the available tools.
