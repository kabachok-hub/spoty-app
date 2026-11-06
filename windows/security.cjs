const path = require('node:path');
const { URL } = require('node:url');
function assetPath(root, url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'spoty:' || parsed.host !== 'app') throw Error('Invalid origin');
  const relative = decodeURIComponent(parsed.pathname).replace(/^\/+/, '') || 'index.html';
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw Error('Invalid path');
  return resolved;
}
function externalUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || value.length > 8192) throw Error('Invalid URL');
  return url.href;
}
function request(raw) {
  if (typeof raw !== 'string' || raw.length > 16384) throw Error('Invalid request');
  const message = JSON.parse(raw);
  if (!Number.isSafeInteger(message.id) || !['vaultGet', 'vaultSet', 'vaultClear', 'openExternal'].includes(message.command)) throw Error('Invalid command');
  return message;
}
function account(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')).tg_id; } catch { return null; }
}
module.exports = { assetPath, externalUrl, request, account };
