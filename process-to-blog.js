#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";

const TRANSCRIPTS_DIR = "./transcripts";
const BLOG_OUTPUT_DIR = "./blog-posts";
const SUMMARY_FILE = "./transcripts/_summary.json";

// HTML entity decoder
function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;#39;/g, "'")
    .replace(/&amp;quot;/g, '"')
    .replace(/&amp;gt;/g, ">")
    .replace(/&amp;lt;/g, "<")
    .replace(/&amp;amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

// Generate tags based on content keywords
function generateTags(title, transcript) {
  const tags = new Set();
  const combinedText = (title + " " + transcript).toLowerCase();

  const tagKeywords = {
    "miniature painting": ["paint", "painting", "miniature", "mini", "brush", "airbrush"],
    "warhammer": ["warhammer", "40k", "age of sigmar", "ageofsigmar"],
    "terrain": ["terrain", "board", "tile", "scenery", "foam"],
    "3d printing": ["3d print", "resin", "stl", "printer"],
    "kitbashing": ["kitbash", "convert", "conversion"],
    "tutorials": ["how to", "tutorial", "recipe", "guide"],
    "orcs and goblins": ["orc", "goblin", "ork", "grot"],
    "trench crusade": ["trench crusade", "trench pilgrim", "communicant"],
    "necromunda": ["necromunda"],
    "warmachine": ["warmachine", "crucible guard"],
    "dolmenwood": ["dolmenwood"],
    "mage knight": ["mage knight"],
    "basing": ["base", "basing"],
    "weathering": ["rust", "weathering", "dirty down"],
    "oil wash": ["oil wash", "oil paint"],
    "nmm": ["nmm", "non-metal metallic", "nonmetal metallic"],
    "drybrushing": ["drybrush", "dry brush"],
    "glazing": ["glaze", "glazing"],
    "solo rpg": ["solo", "roleplaying", "rpg", "session 0"],
    "vlog": ["vlog", "ramble", "update"],
    "motivation": ["motivat", "struggle", "progress", "fail"],
    "one piece tcg": ["one piece", "tcg", "card game"],
  };

  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (keywords.some((kw) => combinedText.includes(kw))) {
      tags.add(tag);
    }
  }

  // Limit to 5 most relevant tags
  return Array.from(tags).slice(0, 5);
}

// Parse date string to ISO format
function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString().slice(0, 19).replace("T", " ");

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return new Date().toISOString().slice(0, 19).replace("T", " ");
    }
    return date.toISOString().slice(0, 19).replace("T", " ");
  } catch {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
  }
}

// Convert title to URL-friendly slug
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .substring(0, 80);
}

// Generate description from transcript
function generateDescription(transcript, maxLength = 160) {
  const cleaned = decodeHtmlEntities(transcript)
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxLength) return cleaned;

  // Find a good break point
  let desc = cleaned.substring(0, maxLength);
  const lastSpace = desc.lastIndexOf(" ");
  if (lastSpace > maxLength - 30) {
    desc = desc.substring(0, lastSpace);
  }
  return desc + "...";
}

// Parse a single transcript file
async function parseTranscript(filepath) {
  const content = await fs.readFile(filepath, "utf-8");
  const lines = content.split("\n");

  // Extract title (first line, remove #)
  const title = lines[0]?.replace(/^#\s*/, "").trim() || "Untitled";

  // Extract metadata
  const videoIdMatch = content.match(/\*\*Video ID:\*\*\s*(\S+)/);
  const publishedMatch = content.match(/\*\*Published:\*\*\s*(.+)/);

  // Get transcript section
  const transcriptStart = content.indexOf("## Transcript");
  let transcript = "";
  if (transcriptStart !== -1) {
    transcript = content.slice(transcriptStart + "## Transcript".length).trim();
  }

  return {
    title,
    videoId: videoIdMatch?.[1] || null,
    published: publishedMatch?.[1]?.trim() || null,
    transcript,
  };
}

// Generate blog post content
function generateBlogPost(data) {
  const { title, videoId, published, transcript } = data;

  const cleanedTranscript = decodeHtmlEntities(transcript);
  const tags = generateTags(title, cleanedTranscript);
  const description = generateDescription(cleanedTranscript);
  const pubDate = parseDate(published);

  // Escape quotes in title and description for YAML
  const safeTitle = title.replace(/"/g, '\\"');
  const safeDescription = description.replace(/"/g, '\\"');

  let content = "---\n";
  content += `title: "${safeTitle}"\n`;
  content += `description: "${safeDescription}"\n`;
  content += `pubDate: "${pubDate}"\n`;
  content += `category: "Vlogs"\n`;
  if (videoId) content += `youtubeId: "${videoId}"\n`;
  if (tags.length > 0) {
    const tagsStr = tags.map((t) => `"${t}"`).join(", ");
    content += `tags: [${tagsStr}]\n`;
  }
  content += "---\n\n";

  // Add YouTube embed
  if (videoId) {
    content += "import YouTubeEmbed from '../../../components/YouTubeEmbed.astro';\n\n";
    content += `<YouTubeEmbed videoId="${videoId}" title="${safeTitle}" />\n\n`;
  }

  // Add transcript
  content += "## Transcript\n\n";
  content += cleanedTranscript;

  return content;
}

// Main processing function
async function processAllTranscripts() {
  console.log("Starting transcript to blog post conversion...\n");

  // Create output directory
  await fs.mkdir(BLOG_OUTPUT_DIR, { recursive: true });

  // Read summary file for list of transcripts
  const summaryContent = await fs.readFile(SUMMARY_FILE, "utf-8");
  const summary = JSON.parse(summaryContent);

  const videosWithTranscripts = summary.videos.filter((v) => v.hasTranscript && v.filepath);

  console.log(`Found ${videosWithTranscripts.length} transcripts to process\n`);

  let processed = 0;
  let failed = 0;
  const errors = [];

  for (const video of videosWithTranscripts) {
    try {
      const transcriptPath = path.join(".", video.filepath);
      const data = await parseTranscript(transcriptPath);

      const blogContent = generateBlogPost(data);
      const slug = slugify(data.title);
      const outputFilename = `${slug}.mdx`;
      const outputPath = path.join(BLOG_OUTPUT_DIR, outputFilename);

      await fs.writeFile(outputPath, blogContent, "utf-8");

      processed++;
      console.log(`✓ [${processed}/${videosWithTranscripts.length}] ${data.title}`);
    } catch (error) {
      failed++;
      errors.push({ video: video.title, error: error.message });
      console.log(`✗ Failed: ${video.title} - ${error.message}`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("Processing complete!");
  console.log(`✓ Processed: ${processed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Output directory: ${BLOG_OUTPUT_DIR}`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach((e) => console.log(`  - ${e.video}: ${e.error}`));
  }
}

// Run
processAllTranscripts().catch(console.error);
