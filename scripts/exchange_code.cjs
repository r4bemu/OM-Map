const fs = require('fs');
const path = require('path');

if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(); } catch (e) {}
}

const authCode = process.argv[2];
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = 'https://developers.google.com/oauthplayground';

if (!authCode) {
  console.log('Usage: node scripts/exchange_code.cjs <AUTHORIZATION_CODE>');
  process.exit(1);
}

async function exchange() {
  console.log('Exchanging authorization code for new refresh token with https://www.googleapis.com/auth/drive scope...');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: authCode.trim(),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  const data = await res.json();
  if (data.refresh_token || data.access_token) {
    console.log('✅ Token Exchange Succeeded!');
    if (data.refresh_token) {
      console.log('New Refresh Token:', data.refresh_token);
      
      // Update .env
      const envPath = path.join(__dirname, '../.env');
      let envContent = fs.readFileSync(envPath, 'utf-8');
      envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${data.refresh_token}`);
      if (data.access_token) {
        envContent = envContent.replace(/GOOGLE_DRIVE_ACCESS_TOKEN=.*/, `GOOGLE_DRIVE_ACCESS_TOKEN=${data.access_token}`);
      }
      fs.writeFileSync(envPath, envContent, 'utf-8');
      console.log('✅ Updated .env file with new refresh token and access token!');
    }
  } else {
    console.error('❌ Exchange error:', data);
  }
}

exchange();
