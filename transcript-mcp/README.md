# Transcript MCP Server

An MCP server that gives Claude Code tools to process YouTube transcripts into blog posts.

## Tools Available

| Tool | Description |
|------|-------------|
| `list_transcripts` | List all transcript files |
| `read_transcript` | Read a specific transcript |
| `get_formatting_guide` | Get instructions for processing transcripts |
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

**Process a transcript into a blog post:**
> "Read the formatting guide, then process the transcript 'My_Video_Title.md' into a polished blog post with proper paragraphs, headers, and tags."

**List your transcripts:**
> "What transcripts do I have available?"

**Batch processing:**
> "Get the formatting guide first, then process all my transcripts into blog posts."

**Get summaries:**
> "Give me a summary of all my transcripts including word counts"

The `get_formatting_guide` tool provides Claude with detailed instructions on how to:
- Break text into paragraphs
- Add section headers
- Clean up filler words and false starts
- Preserve the author's voice
- Choose appropriate categories and tags

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
