const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(); } catch (e) {}
}

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const tokenFromEnv = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;

async function getServiceAccountToken() {
  const keyPath = path.join(__dirname, '../service_account.json');
  if (!fs.existsSync(keyPath)) return null;

  try {
    const key = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/drive',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };
    const base64Url = (str) => Buffer.from(str).toString('base64url');
    const signInput = base64Url(JSON.stringify(header)) + '.' + base64Url(JSON.stringify(payload));
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signInput);
    const signature = signer.sign(key.private_key, 'base64url');
    const assertion = signInput + '.' + signature;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion
      })
    });
    const data = await res.json();
    return data.access_token || null;
  } catch (err) {
    console.error('Service Account token error:', err.message);
    return null;
  }
}

async function testAccess() {
  console.log('Testing Google Drive Folder Access...\n');

  let accessToken = await getServiceAccountToken();
  if (accessToken) {
    console.log('🌟 [Service Account] Successfully generated Access Token using service_account.json RSA key!');
  } else {
    console.log('Client ID:', clientId ? clientId.substring(0, 15) + '...' : 'Missing');
    console.log('Refresh Token:', refreshToken ? refreshToken.substring(0, 10) + '...' : 'Missing');
    accessToken = tokenFromEnv;

    // 1. Try refreshing access token
    if (clientId && clientSecret && refreshToken) {
      try {
        console.log('\n--- Step 1: Refreshing OAuth Access Token ---');
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
          })
        });
        const tokenData = await res.json();
        if (tokenData.access_token) {
          accessToken = tokenData.access_token;
          console.log('✅ Successfully refreshed Access Token via OAuth 2.0!');
        } else {
          console.log('⚠️ Token refresh response:', JSON.stringify(tokenData));
        }
      } catch (err) {
        console.error('❌ Token refresh error:', err.message);
      }
    }
  }

  // 2. Test accessing designated IMO folders
  const folders = [
    { name: 'Root Reports Folder', id: process.env.GOOGLE_DRIVE_FOLDER_ID || '16Xs6u4O1Un1UrkvsvBzdf6WnqQHN_zhi' },
    { name: 'MOMARO Reports Folder', id: '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb' },
    { name: 'Occidental Mindoro Reports Folder', id: '1EUAFseU-S5laT0oxRIEwBuXRgppqOUUf' },
    { name: 'Palawan Reports Folder', id: '1bzraus7QiL8U3ZDSwLfgfLvdc1G5yMKB' },
    { name: 'MOMARO GIS Data Folder', id: '1LdKe-iTgeF_nEy-eRcJwkYAqmj0DwEm0' },
    { name: 'Occidental Mindoro GIS Data Folder', id: '1IBqpIgac41KSVc3UBq-xONJVxyNwjX_0' },
    { name: 'Palawan GIS Data Folder', id: '1xqXBkJAscqqCDgQRFbCAyQh46baehrQ1' }
  ];

  console.log('\n--- Step 2: Testing Folder Access with Bearer Token ---');
  for (const f of folders) {
    try {
      const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?supportsAllDrives=true&fields=id,name,mimeType`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (folderRes.ok) {
        const folderData = await folderRes.json();
        console.log(`✅ ${f.name} (${f.id}): ACCESSIBLE! Folder Name: "${folderData.name}"`);

        // Test listing files in folder
        const q = `'${f.id}' in parents and trashed = false`;
        const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,size)`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          const count = listData.files ? listData.files.length : 0;
          console.log(`   📁 Found ${count} file(s)/folder(s) inside`);
          if (listData.files && listData.files.length > 0) {
            listData.files.slice(0, 4).forEach(file => {
              const sz = file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'folder';
              console.log(`      - ${file.name} (${sz})`);
            });
          }
        } else {
          console.log(`   ⚠️ Could not list files: ${listRes.status} ${listRes.statusText}`);
        }
      } else {
        const errText = await folderRes.text();
        console.log(`❌ ${f.name} (${f.id}): FAILED ${folderRes.status} ${folderRes.statusText}`);
        console.log(`   Error Details: ${errText}`);
      }
    } catch (e) {
      console.log(`❌ ${f.name} Error:`, e.message);
    }
  }

  // 3. Test downloading a sample GIS GeoJSON file from restricted folder
  console.log('\n--- Step 3: Testing Restricted File Download & Parsing ---');
  try {
    const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("'1LdKe-iTgeF_nEy-eRcJwkYAqmj0DwEm0' in parents and trashed = false")}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,size)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      const sampleFile = listData.files ? listData.files.find(f => f.name.includes('Main_Canals') || f.name.endsWith('.geojson') || f.name.endsWith('.kmz')) : null;
      if (sampleFile) {
        console.log(`Testing download of sample GIS file "${sampleFile.name}" (ID: ${sampleFile.id})...`);
        const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${sampleFile.id}?alt=media&supportsAllDrives=true`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (dlRes.ok) {
          const text = await dlRes.text();
          const parsed = JSON.parse(text);
          console.log(`✅ Successfully downloaded and parsed "${sampleFile.name}"! Feature count: ${parsed.features ? parsed.features.length : 'N/A'}`);
        } else {
          console.log(`❌ Download failed: ${dlRes.status} ${dlRes.statusText}`);
        }
      }
    }
  } catch (e) {
    console.warn('Sample download test error:', e.message);
  }
}

testAccess();
