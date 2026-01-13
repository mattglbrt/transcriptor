import { fetchTranscript } from 'youtube-transcript-plus';

const videoId = process.argv[2] || 'dQw4w9WgXcQ';

console.log(`Fetching transcript for: ${videoId}\n`);

try {
  const transcript = await fetchTranscript(videoId);
  
  console.log('=== TYPE ===');
  console.log(typeof transcript);
  console.log(Array.isArray(transcript) ? 'Is an array' : 'Not an array');
  
  console.log('\n=== LENGTH ===');
  console.log(transcript?.length);
  
  console.log('\n=== FIRST ITEM RAW ===');
  console.log(transcript[0]);
  
  console.log('\n=== FIRST ITEM JSON ===');
  console.log(JSON.stringify(transcript[0], null, 2));
  
  console.log('\n=== ALL KEYS ON FIRST ITEM ===');
  console.log(Object.keys(transcript[0]));
  
  console.log('\n=== FIRST 3 ITEMS ===');
  console.log(JSON.stringify(transcript.slice(0, 3), null, 2));
  
} catch (error) {
  console.log('Error:', error.message);
  console.log('\nFull error:');
  console.log(error);
}
