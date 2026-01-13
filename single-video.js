import { fetchTranscript } from 'youtube-transcript-plus';

/**
 * Simple script to fetch transcript for a single YouTube video
 * Usage: node single-video.js VIDEO_ID_OR_URL
 */

function extractVideoId(input) {
  // Handle full URLs
  const urlPatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/  // Just the ID
  ];
  
  for (const pattern of urlPatterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

async function main() {
  const input = process.argv[2];
  
  if (!input) {
    console.log('Usage: node single-video.js <VIDEO_ID_OR_URL>');
    console.log('');
    console.log('Examples:');
    console.log('  node single-video.js dQw4w9WgXcQ');
    console.log('  node single-video.js https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log('  node single-video.js https://youtu.be/dQw4w9WgXcQ');
    process.exit(1);
  }
  
  const videoId = extractVideoId(input);
  
  if (!videoId) {
    console.error('Error: Could not extract video ID from input');
    process.exit(1);
  }
  
  console.log(`Fetching transcript for video: ${videoId}\n`);
  
  try {
    const transcript = await fetchTranscript(videoId);
    
    console.log(`Found ${transcript.length} segments\n`);
    
    if (transcript.length === 0) {
      console.log('Transcript is empty - video may have no speech or captions disabled.');
      process.exit(0);
    }
    
    console.log('--- RAW STRUCTURE (first 3 segments) ---\n');
    console.log(JSON.stringify(transcript.slice(0, 3), null, 2));
    
    console.log('\n--- WITH TIMESTAMPS ---\n');
    
    // Output with timestamps (offset is in seconds)
    for (const item of transcript) {
      const text = item.text || item.content || item.snippet || '';
      const offsetSec = item.offset ?? item.start ?? 0;
      const minutes = Math.floor(offsetSec / 60);
      const seconds = Math.floor(offsetSec % 60);
      const timestamp = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
      console.log(`${timestamp} ${text}`);
    }
    
    console.log('\n--- PLAIN TEXT ---\n');
    console.log(transcript.map(item => item.text || item.content || item.snippet || '').join(' '));
    
  } catch (error) {
    console.error('Error fetching transcript:', error.message);
    console.error('');
    console.error('Possible reasons:');
    console.error('- Video has no captions/subtitles');
    console.error('- Captions are disabled by the video owner');
    console.error('- Video is private or unavailable');
    process.exit(1);
  }
}

main();
