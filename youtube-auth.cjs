/**
 * YouTube OAuth2 Authentication Setup
 * Run this once to get your refresh token, then use push-descriptions.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const { google } = require('googleapis');

// Config
const CREDENTIALS_DIR = './credentials';
const TOKEN_PATH = './youtube_tokens.json';
const SCOPES = ['https://www.googleapis.com/auth/youtube'];
const REDIRECT_PORT = 3000;

// Find client secret file in credentials directory
function findCredentialsFile() {
  // First check credentials directory
  if (fs.existsSync(CREDENTIALS_DIR)) {
    const files = fs.readdirSync(CREDENTIALS_DIR).filter(f => f.startsWith('client_secret') && f.endsWith('.json'));
    if (files.length > 0) {
      return path.join(CREDENTIALS_DIR, files[0]);
    }
  }
  // Fallback to project root
  const rootFiles = fs.readdirSync('.').filter(f => f.startsWith('client_secret') && f.endsWith('.json'));
  if (rootFiles.length > 0) {
    return rootFiles[0];
  }
  return null;
}

async function main() {
  // Load client credentials
  const credentialsPath = findCredentialsFile();

  if (!credentialsPath) {
    console.error('Error: client_secret.json not found!');
    console.error('Download it from Google Cloud Console and place it in the credentials/ folder.');
    process.exit(1);
  }

  console.log(`Using credentials: ${credentialsPath}`);
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
  const { client_id, client_secret } = credentials.installed || credentials.web;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    `http://localhost:${REDIRECT_PORT}/callback`
  );

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force to get refresh token
  });

  console.log('\n=== YouTube OAuth Setup ===\n');
  console.log('1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. Log in with your YouTube account and authorize the app.');
  console.log('3. You will be redirected back here automatically.\n');

  // Start local server to receive the callback
  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/callback') {
      const code = parsedUrl.query.code;

      if (code) {
        try {
          // Exchange code for tokens
          const { tokens } = await oauth2Client.getToken(code);

          // Save tokens
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>Authentication Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);

          console.log('\n=== Success! ===');
          console.log(`Tokens saved to ${TOKEN_PATH}`);
          console.log('\nYou can now run: node push-descriptions.js');

          server.close();
          process.exit(0);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error exchanging code for tokens');
          console.error('Error:', err.message);
          server.close();
          process.exit(1);
        }
      } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('No authorization code received');
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });

  server.listen(REDIRECT_PORT, () => {
    console.log(`Waiting for authorization on http://localhost:${REDIRECT_PORT}...`);

    // Try to open browser automatically
    const { exec } = require('child_process');
    const platform = process.platform;

    if (platform === 'darwin') {
      exec(`open "${authUrl}"`);
    } else if (platform === 'win32') {
      exec(`start "${authUrl}"`);
    } else {
      exec(`xdg-open "${authUrl}"`);
    }
  });
}

main().catch(console.error);
