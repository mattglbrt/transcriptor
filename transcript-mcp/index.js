#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";

// Configure your paths here
const TRANSCRIPTS_DIR = process.env.TRANSCRIPTS_DIR || "./transcripts";
const BLOG_OUTPUT_DIR = process.env.BLOG_OUTPUT_DIR || "./blog-posts";
const PROCESSED_LOG = process.env.PROCESSED_LOG || "./processed.json";
const DESCRIPTIONS_DIR = process.env.DESCRIPTIONS_DIR || "./descriptions";

// Channel info for video descriptions
const CHANNEL_INFO = {
  website: "https://hobbynomicon.com",
  channelName: "Hobby Nomicon",
};

/**
 * Load the processed log
 */
async function loadProcessedLog() {
  try {
    const data = await fs.readFile(PROCESSED_LOG, "utf-8");
    return JSON.parse(data);
  } catch {
    return {
      description: "Tracks which transcripts have been processed into blog posts",
      lastUpdated: new Date().toISOString(),
      totalTranscripts: 0,
      totalProcessed: 0,
      processed: {}
    };
  }
}

/**
 * Save the processed log
 */
async function saveProcessedLog(log) {
  log.lastUpdated = new Date().toISOString();
  log.totalProcessed = Object.keys(log.processed).length;
  await fs.writeFile(PROCESSED_LOG, JSON.stringify(log, null, 2), "utf-8");
}

const server = new Server(
  {
    name: "transcript-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_transcripts",
        description: "List all available transcript files in the transcripts directory. Before processing transcripts, use get_formatting_guide to learn how to properly format them.",
        inputSchema: {
          type: "object",
          properties: {
            unprocessed_only: {
              type: "boolean",
              description: "If true, only list transcripts that haven't been processed into blog posts yet",
            },
          },
          required: [],
        },
      },
      {
        name: "read_transcript",
        description: "Read the full content of a specific transcript file. The transcript will be raw, unformatted text that needs to be cleaned up and structured into paragraphs, sections, and readable prose before saving as a blog post.",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The filename of the transcript to read (e.g., 'My_Video_Title.md')",
            },
          },
          required: ["filename"],
        },
      },
      {
        name: "get_formatting_guide",
        description: "Get the formatting guide for processing transcripts into blog posts. READ THIS BEFORE processing any transcripts.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "save_blog_post",
        description: "Save a processed blog post to the blog-posts directory in Astro format with YouTube embed. The content should already be cleaned up and formatted with paragraphs, headers, and proper structure - NOT raw transcript text.",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The filename for the blog post (e.g., 'my-blog-post.mdx')",
            },
            content: {
              type: "string",
              description: "The cleaned up transcript content (without frontmatter or headers)",
            },
            sourceTranscript: {
              type: "string",
              description: "The original transcript filename (e.g., 'My_Video.md') - used to update the processed log",
            },
            frontmatter: {
              type: "object",
              description: "Frontmatter metadata for the Astro blog post",
              properties: {
                title: { type: "string", description: "The blog post title" },
                description: { type: "string", description: "Short description for SEO/previews" },
                pubDate: { type: "string", description: "Publication date in 'YYYY-MM-DD HH:MM:SS' format" },
                category: { type: "string", description: "Single category (e.g., 'Vlogs', 'Tutorials', 'Reviews')" },
                youtubeId: { type: "string", description: "The YouTube video ID for embedding" },
                project: { type: "string", description: "Project slug if applicable (e.g., 'motley-crews')" },
                tags: { type: "array", items: { type: "string" }, description: "Array of tags for the post" },
              },
            },
          },
          required: ["filename", "content"],
        },
      },
      {
        name: "list_blog_posts",
        description: "List all saved blog posts",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "read_blog_post",
        description: "Read an existing blog post",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The filename of the blog post to read",
            },
          },
          required: ["filename"],
        },
      },
      {
        name: "get_transcript_summary",
        description: "Get a quick summary of a transcript including word count and video metadata",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The filename of the transcript",
            },
          },
          required: ["filename"],
        },
      },
      {
        name: "get_description_guide",
        description: "Get the guide for creating optimized YouTube video descriptions. READ THIS BEFORE generating descriptions.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "generate_description",
        description: "Generate an optimized YouTube video description from a transcript. Returns the description text ready to copy-paste into YouTube.",
        inputSchema: {
          type: "object",
          properties: {
            sourceTranscript: {
              type: "string",
              description: "The transcript filename to generate a description from (e.g., 'My_Video.md')",
            },
            title: {
              type: "string",
              description: "The video title",
            },
            summary: {
              type: "string",
              description: "A 2-3 sentence summary of the video content (hook for viewers)",
            },
            timestamps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  time: { type: "string", description: "Timestamp in MM:SS or HH:MM:SS format" },
                  label: { type: "string", description: "What happens at this timestamp" },
                },
              },
              description: "Optional chapter timestamps for the video",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Relevant hashtags (without #) for the video",
            },
            save: {
              type: "boolean",
              description: "If true, save the description to a file in the descriptions directory",
            },
          },
          required: ["sourceTranscript", "title", "summary"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_transcripts": {
        await fs.mkdir(TRANSCRIPTS_DIR, { recursive: true });
        const files = await fs.readdir(TRANSCRIPTS_DIR);
        let transcripts = files.filter(f => f.endsWith(".md") && !f.startsWith("_"));

        // Filter to unprocessed only if requested
        if (args.unprocessed_only) {
          const log = await loadProcessedLog();
          transcripts = transcripts.filter(t => !log.processed[t]);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                directory: TRANSCRIPTS_DIR,
                count: transcripts.length,
                unprocessedOnly: args.unprocessed_only || false,
                files: transcripts,
              }, null, 2),
            },
          ],
        };
      }

      case "read_transcript": {
        const filepath = path.join(TRANSCRIPTS_DIR, args.filename);
        const content = await fs.readFile(filepath, "utf-8");
        
        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      }

      case "get_formatting_guide": {
        const guide = `# Transcript to Blog Post Formatting Guide

## Overview
Raw YouTube transcripts are unstructured speech-to-text output. Your job is to transform them into polished, readable blog posts while preserving the author's voice and all information.

## Content Processing Rules

### 1. Paragraph Structure
- Break the wall of text into logical paragraphs (3-5 sentences each)
- Start a new paragraph when:
  - The topic shifts
  - There's a natural pause or transition ("So...", "Anyway...", "Now...")
  - The speaker moves to a new step or concept

### 2. Add Section Headers
- Identify major topics or steps and add markdown headers (##, ###)
- Use descriptive headers based on content, not generic ones
- Good: "## Preparing the Miniature for Priming"
- Bad: "## Section 1" or "## Next Steps"

### 3. Clean Up Speech Patterns
- Remove filler words: "um", "uh", "like", "you know", "basically"
- Remove false starts: "I'm going to— what I mean is..."
- Remove repetition unless it's for emphasis
- Fix incomplete sentences
- Keep the conversational tone but make it readable

### 4. Preserve Voice & Personality
- Keep the author's unique phrases and humor
- Maintain their enthusiasm and personality
- Don't make it sound robotic or overly formal
- Keep casual language if that's their style

### 5. Format Lists When Appropriate
- If the speaker lists items or steps, format as a markdown list
- Don't overuse lists - prose is often better for flow

### 6. Technical Content
- Keep all technical details accurate
- Format product names, tools, and materials consistently
- Add clarity where the speaker assumes visual context ("this" → describe what "this" is)

## Frontmatter Guidelines

### Title
- Use the video title or create a clearer one based on content

### Description  
- Write a 1-2 sentence summary of what the reader will learn

### Category
Choose ONE that best fits:
- "Tutorials" - How-to content, step-by-step guides
- "Vlogs" - Personal updates, rambling, day-in-the-life
- "Reviews" - Product or tool reviews
- "Tips" - Quick tips and tricks
- "Projects" - Project showcases or progress updates

### Tags
- Extract 5-10 relevant tags from the content
- Include: techniques mentioned, tools used, materials, project names
- Use lowercase, hyphenate multi-word tags
- Always include the project name if mentioned

### Project
- Only include if the video is part of an ongoing project/series
- Use lowercase with hyphens (e.g., "motley-crews")

## Example Transformation

### Before (raw transcript):
"so um yeah we're gonna start with the base coat here and I'm using this yellow ochre from scale 75 it's really good paint um and you want to thin it down quite a bit like really thin like almost like a wash but not quite"

### After (processed):
"We're starting with the base coat using Yellow Ochre from Scale 75. This is a really good paint, and you'll want to thin it down significantly—almost to a wash consistency, but not quite that thin."

## Final Checklist
- [ ] Broke into logical paragraphs
- [ ] Added descriptive section headers
- [ ] Removed filler words and false starts
- [ ] Preserved personality and voice
- [ ] Fixed incomplete sentences
- [ ] All technical details accurate
- [ ] Frontmatter complete with appropriate tags
`;
        
        return {
          content: [
            {
              type: "text",
              text: guide,
            },
          ],
        };
      }

      case "save_blog_post": {
        await fs.mkdir(BLOG_OUTPUT_DIR, { recursive: true });

        let finalContent = "";

        // Add YAML frontmatter in Astro format
        if (args.frontmatter) {
          finalContent += "---\n";
          if (args.frontmatter.title) finalContent += `title: "${args.frontmatter.title}"\n`;
          if (args.frontmatter.description) finalContent += `description: "${args.frontmatter.description}"\n`;
          if (args.frontmatter.pubDate) {
            finalContent += `pubDate: "${args.frontmatter.pubDate}"\n`;
          } else {
            // Default to current date/time
            const now = new Date();
            const dateStr = now.toISOString().replace('T', ' ').slice(0, 19);
            finalContent += `pubDate: "${dateStr}"\n`;
          }
          if (args.frontmatter.category) finalContent += `category: "${args.frontmatter.category}"\n`;
          if (args.frontmatter.youtubeId) finalContent += `youtubeId: "${args.frontmatter.youtubeId}"\n`;
          if (args.frontmatter.project) finalContent += `project: "${args.frontmatter.project}"\n`;
          if (args.frontmatter.tags?.length) {
            const tagsStr = args.frontmatter.tags.map(t => `"${t}"`).join(", ");
            finalContent += `tags: [${tagsStr}]\n`;
          }
          finalContent += "---\n\n";
        }

        // Add Astro YouTube component import and embed
        if (args.frontmatter?.youtubeId) {
          finalContent += "import YouTubeEmbed from '../../../components/YouTubeEmbed.astro';\n\n";
          finalContent += `<YouTubeEmbed videoId="${args.frontmatter.youtubeId}" title="${args.frontmatter.title || ''}" />\n\n`;
        }

        // Add transcript header and content
        finalContent += "## Transcript\n\n";
        finalContent += args.content;

        const filepath = path.join(BLOG_OUTPUT_DIR, args.filename);
        await fs.writeFile(filepath, finalContent, "utf-8");

        // Update the processed log if sourceTranscript is provided
        if (args.sourceTranscript) {
          const log = await loadProcessedLog();
          log.processed[args.sourceTranscript] = {
            blogPost: args.filename,
            processedAt: new Date().toISOString()
          };
          await saveProcessedLog(log);
        }

        return {
          content: [
            {
              type: "text",
              text: `Blog post saved to: ${filepath}${args.sourceTranscript ? ` (logged as processed from ${args.sourceTranscript})` : ''}`,
            },
          ],
        };
      }

      case "list_blog_posts": {
        await fs.mkdir(BLOG_OUTPUT_DIR, { recursive: true });
        const files = await fs.readdir(BLOG_OUTPUT_DIR);
        const posts = files.filter(f => f.endsWith(".md"));
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                directory: BLOG_OUTPUT_DIR,
                count: posts.length,
                files: posts,
              }, null, 2),
            },
          ],
        };
      }

      case "read_blog_post": {
        const filepath = path.join(BLOG_OUTPUT_DIR, args.filename);
        const content = await fs.readFile(filepath, "utf-8");
        
        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      }

      case "get_transcript_summary": {
        const filepath = path.join(TRANSCRIPTS_DIR, args.filename);
        const content = await fs.readFile(filepath, "utf-8");

        // Parse metadata from the markdown
        const lines = content.split("\n");
        const title = lines[0]?.replace(/^#\s*/, "") || "Unknown";

        // Extract video ID and URL
        const videoIdMatch = content.match(/\*\*Video ID:\*\*\s*(\S+)/);
        const urlMatch = content.match(/\*\*URL:\*\*\s*\[.*?\]\((.*?)\)/);
        const publishedMatch = content.match(/\*\*Published:\*\*\s*(.+)/);

        // Get transcript section
        const transcriptStart = content.indexOf("## Transcript");
        const transcript = transcriptStart !== -1 ? content.slice(transcriptStart) : "";
        const wordCount = transcript.split(/\s+/).filter(w => w.length > 0).length;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                filename: args.filename,
                title: title,
                videoId: videoIdMatch?.[1] || null,
                url: urlMatch?.[1] || null,
                published: publishedMatch?.[1] || null,
                wordCount: wordCount,
                estimatedReadTime: `${Math.ceil(wordCount / 200)} min`,
              }, null, 2),
            },
          ],
        };
      }

      case "get_description_guide": {
        const guide = `# YouTube Description Best Practices Guide (2025)

## Overview
Optimized YouTube descriptions should be 200-300 words, focusing on human readability, keyword-rich summaries, and clear, clickable links. Prioritize the first 100-200 characters for visibility, include timestamps for engagement, and use natural language rather than keyword stuffing to maximize searchability and viewer retention.

## The Critical First 100-200 Characters

This is the most important part of your description:
- Only ~100-200 characters appear in search results and above the fold
- Front-load your primary keywords here naturally
- Make it compelling enough to encourage "Show more" clicks
- Write for humans first, algorithms second

**Example:** "Learn miniature painting basics with this beginner-friendly NMM gold tutorial. I'll show you the exact 3-color technique I use for all my Warhammer minis."

## Description Structure

### 1. Compelling Summary (100-250 words)
- Provide a clear, engaging overview of the video content
- Write naturally—avoid robotic keyword lists
- Include 2-3 targeted keywords woven into natural sentences
- Explain what viewers will learn or experience
- Keep paragraphs short and scannable

### 2. Timestamps/Chapters (for videos 5+ minutes)
- Format: 0:00 Introduction
- First timestamp MUST be 0:00
- YouTube auto-generates chapters from these
- Significantly improves engagement and watch time
- Include 3-8 meaningful chapter markers

### 3. Call-to-Action & Links
- Include your website link prominently
- Keep links clean and clickable (full URLs, properly formatted)
- Don't bury important links at the bottom

**Standard links:**
---
🌐 Website & Blog: ${CHANNEL_INFO.website}
---

### 4. Hashtags (2-3 maximum)
- Place at the very end of the description
- Use only 2-3 highly relevant hashtags
- First 3 hashtags appear above your video title
- Mix one broad + one specific tag
- Example: #miniaturepainting #trenchcrusade

## Keyword Strategy

### Do This:
- Include primary keyword in first 25 words
- Use natural sentence structures
- Include keyword variations organically (miniature painting, painting miniatures, mini painting)
- Write 2-3 keyword-rich sentences that actually read well

### Avoid This:
- Keyword stuffing or unnatural repetition
- Lists of random keywords
- Clickbait or misleading descriptions
- Generic copy-paste descriptions
- Excessive hashtags (more than 3 looks spammy)
- ALL CAPS sections
- Walls of text without breaks

## Optimal Length
- **Target: 200-300 words** (sweet spot for readability + SEO)
- YouTube indexes up to 5000 characters but viewers won't read walls of text
- Quality over quantity—every word should add value

## Final Checklist
- [ ] First 100-200 characters are compelling and keyword-rich
- [ ] Summary is 100-250 words, naturally written
- [ ] Timestamps included (if video is 5+ minutes)
- [ ] Website link is prominent and clickable
- [ ] Only 2-3 relevant hashtags at the end
- [ ] Reads naturally—would you want to read this?
`;

        return {
          content: [
            {
              type: "text",
              text: guide,
            },
          ],
        };
      }

      case "generate_description": {
        // Build the description following 2025 best practices
        let description = "";

        // Hook/Summary at the top (should be 100-250 words, keyword-rich)
        description += args.summary + "\n\n";

        // Timestamps if provided (for videos 5+ minutes)
        if (args.timestamps && args.timestamps.length > 0) {
          description += "TIMESTAMPS\n";
          for (const ts of args.timestamps) {
            description += `${ts.time} ${ts.label}\n`;
          }
          description += "\n";
        }

        // Links section - prominent and clickable
        description += "---\n";
        description += `🌐 Website & Blog: ${CHANNEL_INFO.website}\n`;
        description += "---\n\n";

        // Hashtags - only 2-3, placed at the end
        if (args.tags && args.tags.length > 0) {
          // Limit to 3 hashtags max per 2025 best practices
          const limitedTags = args.tags.slice(0, 3);
          const hashtags = limitedTags.map(t => `#${t.replace(/\s+/g, '').toLowerCase()}`).join(" ");
          description += hashtags + "\n";
        } else {
          // Default to 2 hashtags (broad + specific)
          description += "#miniaturepainting #hobbypainting\n";
        }

        // Save to file if requested
        let savedPath = null;
        if (args.save) {
          await fs.mkdir(DESCRIPTIONS_DIR, { recursive: true });
          const filename = args.sourceTranscript.replace(".md", "_description.txt");
          savedPath = path.join(DESCRIPTIONS_DIR, filename);
          await fs.writeFile(savedPath, description, "utf-8");
        }

        return {
          content: [
            {
              type: "text",
              text: savedPath
                ? `Description saved to: ${savedPath}\n\n---\n\n${description}`
                : description,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// List resources (transcripts as readable resources)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    await fs.mkdir(TRANSCRIPTS_DIR, { recursive: true });
    const files = await fs.readdir(TRANSCRIPTS_DIR);
    const transcripts = files.filter(f => f.endsWith(".md") && !f.startsWith("_"));
    
    return {
      resources: transcripts.map(filename => ({
        uri: `transcript://${filename}`,
        mimeType: "text/markdown",
        name: filename.replace(".md", "").replace(/_/g, " "),
        description: `Transcript: ${filename}`,
      })),
    };
  } catch {
    return { resources: [] };
  }
});

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  if (uri.startsWith("transcript://")) {
    const filename = uri.replace("transcript://", "");
    const filepath = path.join(TRANSCRIPTS_DIR, filename);
    const content = await fs.readFile(filepath, "utf-8");
    
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: content,
        },
      ],
    };
  }
  
  throw new Error(`Unknown resource: ${uri}`);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Transcript MCP server running on stdio");
}

main().catch(console.error);
