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
          properties: {},
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
        const transcripts = files.filter(f => f.endsWith(".md") && !f.startsWith("_"));
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                directory: TRANSCRIPTS_DIR,
                count: transcripts.length,
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
        
        return {
          content: [
            {
              type: "text",
              text: `Blog post saved to: ${filepath}`,
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
