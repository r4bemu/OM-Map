const fs = require('fs');
const path = require('path');

if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(); } catch (e) {}
}

const appsScriptUrl = process.argv[2] || process.env.GOOGLE_APPS_SCRIPT_URL;

if (!appsScriptUrl) {
  console.log('Usage: node scripts/test_apps_script.cjs [OPTIONAL_APPS_SCRIPT_URL]');
  console.log('Or add GOOGLE_APPS_SCRIPT_URL to your .env file.');
  process.exit(1);
}

async function runTest() {
  console.log('Testing Google Apps Script Relay at:');
  console.log(appsScriptUrl + '\n');

  // 1. Test GET (Ping)
  try {
    console.log('--- Step 1: Health Check (GET) ---');
    const getRes = await fetch(appsScriptUrl, { method: 'GET', redirect: 'follow' });
    if (getRes.ok) {
      const getData = await getRes.json();
      console.log('✅ Health check succeeded:', getData);
    } else {
      console.warn('⚠️ GET returned status:', getRes.status, await getRes.text());
    }
  } catch (err) {
    console.error('❌ GET test failed:', err.message);
  }

  // 2. Test POST (Mock Report Archive)
  try {
    console.log('\n--- Step 2: Upload Test (POST) ---');
    const testReport = {
      id: 'TEST_RELAY_' + Date.now(),
      title: 'Automated Apps Script Verification Test',
      categoryMode: 'Routine Inspection',
      imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
      locationName: 'Main Diversion Dam (Test)',
      canalSegment: 'Main Canal Line 1',
      lat: 13.298,
      lng: 121.282,
      status: 'Verified',
      remarks: 'Automated verification test of zero-token Google Apps Script relay.',
      createdAt: new Date().toISOString(),
      photos: [
        {
          id: 'test_photo_1',
          stage: 'Before',
          url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAE4wH5U7WwgwAAAABJRU5ErkJggg=='
        }
      ]
    };

    const postRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: testReport }),
      redirect: 'follow'
    });

    if (postRes.ok) {
      const postData = await postRes.json();
      console.log('✅ POST test succeeded:', postData);
      if (postData.success) {
        console.log('\n🎉 SUCCESS! The Apps Script successfully created a folder and saved files in Google Drive!');
        console.log('Folder URL:', postData.folderUrl);
      }
    } else {
      console.error('❌ POST returned status:', postRes.status, await postRes.text());
    }
  } catch (err) {
    console.error('❌ POST test failed:', err.message);
  }
}

runTest();
