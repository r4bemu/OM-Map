const fs = require('fs');

if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(); } catch (e) {}
}

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

async function getAccessToken() {
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
  const data = await res.json();
  return data.access_token;
}

// Upload a text file using multipart upload
async function uploadTestFile(accessToken, folderId, fileName, textContent) {
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'text/plain'
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: text/plain\r\n\r\n' +
    textContent +
    closeDelimiter;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed (${res.status} ${res.statusText}): ${err}`);
  }

  return await res.json();
}

// Delete a file permanently
async function deleteFile(accessToken, fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    throw new Error(`Delete failed (${res.status} ${res.statusText}): ${err}`);
  }

  return true;
}

// Verify deletion
async function verifyDeleted(accessToken, fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.status === 404;
}

async function runWriteAndDestroyTests() {
  console.log('================================================================');
  console.log('  Google Drive Write & Destroy (Delete) Verification Test');
  console.log('================================================================\n');

  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.error('❌ Failed to obtain active access token.');
    return;
  }
  console.log('✅ Obtained fresh access token.');

  const targetFolders = [
    { name: 'Root Reports Folder', id: process.env.GOOGLE_DRIVE_FOLDER_ID || '16Xs6u4O1Un1UrkvsvBzdf6WnqQHN_zhi' },
    { name: 'MOMARO Reports Folder', id: '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb' },
    { name: 'Occidental Mindoro Reports Folder', id: '1EUAFseU-S5laT0oxRIEwBuXRgppqOUUf' },
    { name: 'Palawan Reports Folder', id: '1bzraus7QiL8U3ZDSwLfgfLvdc1G5yMKB' },
    { name: 'MOMARO GIS Data Folder', id: '1LdKe-iTgeF_nEy-eRcJwkYAqmj0DwEm0' },
    { name: 'Occidental Mindoro GIS Data Folder', id: '1IBqpIgac41KSVc3UBq-xONJVxyNwjX_0' },
    { name: 'Palawan GIS Data Folder', id: '1xqXBkJAscqqCDgQRFbCAyQh46baehrQ1' }
  ];

  let successCount = 0;

  for (const folder of targetFolders) {
    console.log(`\n📁 Testing Folder: "${folder.name}" (${folder.id})`);
    const testFileName = `VERIFY_WRITE_DELETE_${Date.now()}.txt`;
    const testContent = `NIA MIMAROPA O&M GIS Automation Verification Test\nCreated at: ${new Date().toISOString()}\nTarget Folder: ${folder.name} (${folder.id})\nStatus: Temporary test file to be immediately deleted.`;

    try {
      // 1. WRITE TEST
      process.stdout.write(`   1. [WRITE] Uploading "${testFileName}"... `);
      const created = await uploadTestFile(accessToken, folder.id, testFileName, testContent);
      console.log(`✅ SUCCESS (File ID: ${created.id})`);

      // 2. READ/VERIFY TEST
      process.stdout.write(`   2. [VERIFY] Verifying file exists in folder... `);
      const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${created.id}?supportsAllDrives=true&fields=id,name,size,parents`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        console.log(`✅ VERIFIED (Name: "${checkData.name}", Size: ${checkData.size} bytes)`);
      } else {
        console.log(`⚠️ Check failed with status ${checkRes.status}`);
      }

      // 3. DESTROY / DELETE TEST
      process.stdout.write(`   3. [DESTROY] Deleting file "${created.id}"... `);
      await deleteFile(accessToken, created.id);
      console.log(`✅ SUCCESS (File deleted)`);

      // 4. VERIFY PURGE
      process.stdout.write(`   4. [CONFIRM] Confirming permanent deletion... `);
      const isGone = await verifyDeleted(accessToken, created.id);
      if (isGone) {
        console.log(`✅ CONFIRMED (File no longer exists, returns 404)`);
        successCount++;
      } else {
        console.log(`⚠️ File still detectable`);
      }

    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
    }
  }

  console.log('\n================================================================');
  console.log(`  Summary: ${successCount} of ${targetFolders.length} Folders Verified with Full Write + Destroy Capabilities!`);
  console.log('================================================================');
}

runWriteAndDestroyTests();
