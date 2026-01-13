import { fetchTranscript } from 'youtube-transcript-plus';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const OUTPUT_DIR = './transcripts';
const LOG_FILE = './downloaded.json';

/**
 * Load the download log
 */
async function loadLog() {
  try {
    const data = await fs.readFile(LOG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { downloaded: {} };
  }
}

/**
 * Save the download log
 */
async function saveLog(log) {
  await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
}

/**
 * Fetch data from YouTube Data API
 */
async function youtubeApiRequest(endpoint, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  url.searchParams.set('key', YOUTUBE_API_KEY);
  
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`YouTube API Error: ${JSON.stringify(error)}`);
  }
  
  return response.json();
}

/**
 * Get the uploads playlist ID for a channel
 */
async function getUploadsPlaylistId(channelId) {
  const data = await youtubeApiRequest('channels', {
    part: 'contentDetails',
    id: channelId
  });
  
  if (!data.items?.length) {
    throw new Error(`Channel not found: ${channelId}`);
  }
  
  return data.items[0].contentDetails.relatedPlaylists.uploads;
}

/**
 * Get all videos from a playlist (handles pagination)
 */
async function getPlaylistVideos(playlistId, maxResults = null) {
  const videos = [];
  let pageToken = null;
  
  do {
    const params = {
      part: 'snippet',
      playlistId: playlistId,
      maxResults: 50
    };
    
    if (pageToken) {
      params.pageToken = pageToken;
    }
    
    const data = await youtubeApiRequest('playlistItems', params);
    
    for (const item of data.items) {
      videos.push({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        description: item.snippet.description
      });
      
      if (maxResults && videos.length >= maxResults) {
        return videos.slice(0, maxResults);
      }
    }
    
    pageToken = data.nextPageToken;
  } while (pageToken);
  
  return videos;
}

/**
 * Fetch transcript for a single video
 */
async function getTranscript(videoId) {
  try {
    const transcript = await fetchTranscript(videoId);
    
    // Return null if empty array
    if (!transcript || transcript.length === 0) {
      return null;
    }
    
    return transcript;
  } catch (error) {
    return null; // Transcript not available
  }
}

/**
 * Format transcript to plain text
 * Handles different property names from various packages
 */
function formatTranscript(transcript) {
  return transcript.map(item => {
    return item.text || item.content || item.snippet || '';
  }).join(' ');
}

/**
 * Format transcript with timestamps
 */
function formatTranscriptWithTimestamps(transcript) {
  return transcript.map(item => {
    // offset is in seconds
    const offsetSec = item.offset ?? item.start ?? 0;
    const minutes = Math.floor(offsetSec / 60);
    const seconds = Math.floor(offsetSec % 60);
    const timestamp = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
    const text = item.text || item.content || item.snippet || '';
    return `${timestamp} ${text}`;
  }).join('\n');
}

/**
 * Sanitize filename
 */
function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 100);
}

/**
 * Main function
 */
async function main() {
  // Validate environment variables
  if (!YOUTUBE_API_KEY) {
    console.error('Error: YOUTUBE_API_KEY not set in .env file');
    process.exit(1);
  }
  
  if (!CHANNEL_ID) {
    console.error('Error: YOUTUBE_CHANNEL_ID not set in .env file');
    process.exit(1);
  }
  
  // Create output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  
  // Load download log
  const log = await loadLog();
  console.log(`Loaded log with ${Object.keys(log.downloaded).length} previously downloaded videos\n`);
  
  console.log('Fetching channel uploads...\n');
  
  // Get uploads playlist
  const uploadsPlaylistId = await getUploadsPlaylistId(CHANNEL_ID);
  console.log(`Uploads playlist ID: ${uploadsPlaylistId}`);
  
  // Get all videos (or limit with second parameter)
  const videos = await getPlaylistVideos(uploadsPlaylistId);
  console.log(`Found ${videos.length} videos\n`);
  
  // Process each video
  const results = [];
  let skipped = 0;
  let newDownloads = 0;
  
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    
    // Check if already downloaded
    if (log.downloaded[video.videoId]) {
      console.log(`[${i + 1}/${videos.length}] Skipping (already downloaded): ${video.title}`);
      skipped++;
      continue;
    }
    
    console.log(`[${i + 1}/${videos.length}] Processing: ${video.title}`);
    
    const transcript = await getTranscript(video.videoId);
    
    if (transcript) {
      const filename = `${sanitizeFilename(video.title)}.md`;
      const filepath = path.join(OUTPUT_DIR, filename);
      
      // Save transcript as markdown
      const content = [
        `# ${video.title}`,
        '',
        `- **Video ID:** ${video.videoId}`,
        `- **URL:** [Watch on YouTube](https://www.youtube.com/watch?v=${video.videoId})`,
        `- **Published:** ${new Date(video.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        '',
        '## Transcript',
        '',
        formatTranscript(transcript)
      ].join('\n');
      
      await fs.writeFile(filepath, content, 'utf-8');
      
      // Add to log
      log.downloaded[video.videoId] = {
        title: video.title,
        filename: filename,
        downloadedAt: new Date().toISOString()
      };
      
      results.push({
        videoId: video.videoId,
        title: video.title,
        hasTranscript: true,
        filepath: filepath
      });
      
      newDownloads++;
      console.log(`   ✓ Saved transcript`);
    } else {
      results.push({
        videoId: video.videoId,
        title: video.title,
        hasTranscript: false
      });
      
      console.log(`   ✗ No transcript available`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Save the updated log
  await saveLog(log);
  
  // Save summary
  const summary = {
    channelId: CHANNEL_ID,
    processedAt: new Date().toISOString(),
    totalVideos: videos.length,
    skipped: skipped,
    newDownloads: newDownloads,
    transcriptsFound: results.filter(r => r.hasTranscript).length,
    transcriptsNotFound: results.filter(r => !r.hasTranscript).length,
    videos: results
  };
  
  await fs.writeFile(
    path.join(OUTPUT_DIR, '_summary.json'),
    JSON.stringify(summary, null, 2),
    'utf-8'
  );
  
  console.log('\n--- SUMMARY ---');
  console.log(`Total videos: ${summary.totalVideos}`);
  console.log(`Skipped (already downloaded): ${skipped}`);
  console.log(`New transcripts downloaded: ${newDownloads}`);
  console.log(`No transcript available: ${summary.transcriptsNotFound}`);
  console.log(`\nTranscripts saved to: ${OUTPUT_DIR}/`);
  console.log(`Download log saved to: ${LOG_FILE}`);
}

main().catch(console.error);
