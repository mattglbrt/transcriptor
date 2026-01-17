const fs = require('fs');
const path = require('path');

const TRANSCRIPTS_DIR = './transcripts';
const DESCRIPTIONS_DIR = './descriptions';
const LOG_FILE = './descriptions_processed.json';

const CHANNEL_INFO = {
  website: 'https://hobbynomicon.com',
  channelName: 'Hobby Nomicon'
};

// Load existing log
function loadLog() {
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
  } catch {
    return { description: 'Tracks which transcripts have been processed into YouTube descriptions', processed: {} };
  }
}

// Save log
function saveLog(log) {
  log.lastUpdated = new Date().toISOString();
  log.totalProcessed = Object.keys(log.processed).length;
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
}

// Decode HTML entities
function decodeHtml(text) {
  return text
    .replace(/&amp;#39;/g, "'")
    .replace(/&amp;quot;/g, '"')
    .replace(/&amp;gt;/g, '>')
    .replace(/&amp;lt;/g, '<')
    .replace(/&amp;amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<');
}

// Extract metadata from transcript
function parseTranscript(content) {
  const lines = content.split('\n');
  const title = lines[0]?.replace(/^#\s*/, '').trim() || 'Unknown';

  const videoIdMatch = content.match(/\*\*Video ID:\*\*\s*(\S+)/);
  const urlMatch = content.match(/\*\*URL:\*\*\s*\[.*?\]\((.*?)\)/);

  const transcriptStart = content.indexOf('## Transcript');
  const transcript = transcriptStart !== -1 ? content.slice(transcriptStart + 14).trim() : '';

  return {
    title: decodeHtml(title),
    videoId: videoIdMatch?.[1] || null,
    url: urlMatch?.[1] || null,
    transcript: decodeHtml(transcript)
  };
}

// Determine category and tags based on title and content
function categorizeVideo(title, transcript) {
  const titleLower = title.toLowerCase();
  const contentLower = transcript.toLowerCase().slice(0, 2000); // First 2000 chars

  let tags = ['miniaturepainting', 'hobbypainting'];
  let category = 'vlog';

  // Detect tutorials
  if (titleLower.includes('how to') || titleLower.includes('tutorial') ||
      titleLower.includes('recipe') || titleLower.includes('guide')) {
    category = 'tutorial';
    tags.push('hobbytutorial');
  }

  // Detect vlogs
  if (titleLower.includes('vlog') || titleLower.includes('rambl') ||
      titleLower.includes('update') || titleLower.includes('day ')) {
    category = 'vlog';
    tags.push('hobbyvlog');
  }

  // Detect specific games/systems
  if (contentLower.includes('warmachine') || contentLower.includes('crucible guard') ||
      contentLower.includes('fifth division') || titleLower.includes('warmachine')) {
    tags.push('warmachine');
  }
  if (contentLower.includes('trench crusade') || titleLower.includes('trench crusade')) {
    tags.push('trenchcrusade');
  }
  if (contentLower.includes('dolmenwood') || titleLower.includes('dolmenwood')) {
    tags.push('dolmenwood', 'ttrpg');
  }
  if (contentLower.includes('warhammer') || contentLower.includes('40k') ||
      contentLower.includes('old world')) {
    tags.push('warhammer');
  }
  if (contentLower.includes('speed paint') || contentLower.includes('speedpaint') ||
      contentLower.includes('contrast paint')) {
    tags.push('speedpaint');
  }
  if (contentLower.includes('nmm') || contentLower.includes('non-metal') ||
      contentLower.includes('nonmetal')) {
    tags.push('nmm');
  }
  if (contentLower.includes('dry brush') || contentLower.includes('drybrush')) {
    tags.push('drybrushing');
  }
  if (contentLower.includes('3d print') || contentLower.includes('resin')) {
    tags.push('3dprinting');
  }
  if (contentLower.includes('terrain') || contentLower.includes('board')) {
    tags.push('wargamingterrain');
  }
  if (contentLower.includes('airbrush')) {
    tags.push('airbrush');
  }
  if (contentLower.includes('goblin') || contentLower.includes('orc')) {
    tags.push('orcsandgoblins');
  }

  // Limit to 5 most relevant tags
  return { category, tags: [...new Set(tags)].slice(0, 5) };
}

// Generate a summary hook from the transcript
function generateSummary(title, transcript, category) {
  const words = transcript.split(/\s+/).slice(0, 150).join(' ');

  // Clean up the title for the summary
  const cleanTitle = title.replace(/\.$/, '').replace(/\.\.$/, '');

  // Generate different hooks based on category
  if (category === 'tutorial') {
    return `Learn ${cleanTitle.toLowerCase().replace('how to ', '')} in this step-by-step hobby tutorial. Quick tips and techniques you can apply to your own miniatures today.`;
  }

  // For vlogs and other content, create a general hook
  return `${cleanTitle} - Join me in today's hobby session as I share tips, progress, and thoughts on miniature painting and tabletop gaming.`;
}

// Generate description for a transcript
function generateDescription(metadata, category, tags, summary) {
  let description = '';

  // Hook/Summary
  description += summary + '\n\n';

  // Links section
  description += '---\n';
  description += `🌐 Website & Blog: ${CHANNEL_INFO.website}\n`;
  description += '---\n\n';

  // Hashtags
  const hashtags = tags.map(t => `#${t}`).join(' ');
  description += hashtags + '\n';

  return description;
}

// Main processing function
async function main() {
  // Ensure descriptions directory exists
  if (!fs.existsSync(DESCRIPTIONS_DIR)) {
    fs.mkdirSync(DESCRIPTIONS_DIR, { recursive: true });
  }

  const log = loadLog();
  const files = fs.readdirSync(TRANSCRIPTS_DIR).filter(f => f.endsWith('.md'));

  console.log(`Found ${files.length} transcripts to process`);

  let processed = 0;
  let skipped = 0;

  for (const file of files) {
    // Skip if already processed
    if (log.processed[file]) {
      skipped++;
      continue;
    }

    try {
      const content = fs.readFileSync(path.join(TRANSCRIPTS_DIR, file), 'utf-8');
      const metadata = parseTranscript(content);
      const { category, tags } = categorizeVideo(metadata.title, metadata.transcript);
      const summary = generateSummary(metadata.title, metadata.transcript, category);
      const description = generateDescription(metadata, category, tags, summary);

      // Save description
      const descFilename = file.replace('.md', '_description.txt');
      fs.writeFileSync(path.join(DESCRIPTIONS_DIR, descFilename), description, 'utf-8');

      // Update log
      log.processed[file] = {
        descriptionFile: descFilename,
        category: category,
        tags: tags,
        processedAt: new Date().toISOString()
      };

      processed++;
      console.log(`[${processed}] Processed: ${file}`);
    } catch (err) {
      console.error(`Error processing ${file}:`, err.message);
    }
  }

  // Save final log
  log.totalTranscripts = files.length;
  saveLog(log);

  console.log(`\nDone! Processed: ${processed}, Skipped: ${skipped}, Total: ${files.length}`);
}

main().catch(console.error);
