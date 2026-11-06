const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { assetPath, externalUrl, request } = require('../security.cjs');
test('local resources stay in packaged renderer', () => {
  const root = path.resolve('renderer');
  assert.equal(assetPath(root, 'spoty://app/assets/main.js'), path.join(root, 'assets', 'main.js'));
  for (const url of ['https://app/assets/main.js', 'spoty://evil/index.html', 'spoty://app/%2e%2e%2fsecret', 'spoty://app/%2e%2e%5csecret']) assert.throws(() => assetPath(root, url));
});
test('external navigation is HTTPS only with no embedded credentials', () => {
  assert.equal(externalUrl('https://t.me/bot?start=sync_123456'), 'https://t.me/bot?start=sync_123456');
  for (const url of ['file:///C:/private', 'javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com']) assert.throws(() => externalUrl(url));
});
test('renderer cannot invoke arbitrary privileged commands', () => {
  assert.equal(request(JSON.stringify({id:1,command:'vaultGet'})).command, 'vaultGet');
  for (const raw of ['bad', JSON.stringify({id:1,command:'exec'}), 'x'.repeat(17000), JSON.stringify({id:'1',command:'vaultGet'})]) assert.throws(() => request(raw));
});
