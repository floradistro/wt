/**
 * SENTRY TEST SCRIPT
 * Run this to test Sentry immediately without reloading the app
 *
 * Usage: node TEST_SENTRY_NOW.js
 */

const https = require('https');

const DSN = 'https://084642e519a1cb616b4c02060327eb9a@o4510333066674176.ingest.us.sentry.io/4510373174771717';

// Parse DSN
const dsnMatch = DSN.match(/https:\/\/(.+)@(.+)\/(.+)/);
if (!dsnMatch) {
  console.error('❌ Invalid DSN format');
  process.exit(1);
}

const [, key, host, projectId] = dsnMatch;

console.log('🧪 Testing Sentry Connection...\n');
console.log('DSN:', DSN);
console.log('Host:', host);
console.log('Project ID:', projectId);
console.log('\n📤 Sending test event to Sentry...\n');

// Create Sentry event payload
const event = {
  event_id: require('crypto').randomUUID().replace(/-/g, ''),
  timestamp: new Date().toISOString(),
  platform: 'javascript',
  sdk: {
    name: 'test-script',
    version: '1.0.0',
  },
  message: 'TEST: Direct Sentry verification from Node script',
  level: 'info',
  tags: {
    test: 'direct_test',
    source: 'node_script',
  },
  extra: {
    testDescription: 'Direct test from Node.js script',
    timestamp: new Date().toISOString(),
  },
};

// Send to Sentry
const data = JSON.stringify(event);

const options = {
  hostname: host,
  path: `/api/${projectId}/store/`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${key}, sentry_client=test-script/1.0.0`,
  },
};

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);

  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('\n✅ SUCCESS! Test event sent to Sentry');
      console.log('\n📊 Check your dashboard:');
      console.log('   https://sentry.io/organizations/whaletools/issues/');
      console.log('\nYou should see:');
      console.log('   "TEST: Direct Sentry verification from Node script"');
      console.log('\n⏰ Events can take 10-30 seconds to appear. Refresh your browser!\n');
    } else {
      console.log('\n❌ ERROR! Failed to send event');
      console.log('Response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Request failed:', error.message);
});

req.write(data);
req.end();
