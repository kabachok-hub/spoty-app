import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const platform = 'android';
const origin = process.env.SPOTY_API_ORIGIN;
if (!origin || !/^https:\/\/[A-Za-z0-9.-]+(?::[0-9]+)?$/.test(origin)) throw new Error('Set SPOTY_API_ORIGIN to an HTTPS origin without trailing slash');
const publicSite = process.env.SPOTY_PUBLIC_SITE_URL || origin;
if (!/^https:\/\/[A-Za-z0-9.-]+(?::[0-9]+)?$/.test(publicSite)) throw new Error('Invalid SPOTY_PUBLIC_SITE_URL');
const destination = 'android/app/src/main/assets';
const output = resolve(root, destination);
mkdirSync(output, { recursive: true });
const run = (args) => {
  const result = spawnSync(process.execPath, args, { cwd: resolve(root, 'frontend'), stdio: 'inherit',
    env: { ...process.env, VITE_APP_VERSION: JSON.parse(readFileSync(resolve(root, 'frontend/package.json'), 'utf8')).version, VITE_API_URL: origin, VITE_PUBLIC_SITE_URL: publicSite } });
  if (result.status !== 0) process.exit(result.status || 1);
};
run(['node_modules/typescript/bin/tsc']);
run(['node_modules/vite/bin/vite.js', 'build', '--outDir', output, '--emptyOutDir']);
let html = readFileSync(resolve(output, 'index.html'), 'utf8');
html = html.replace(/<script src="https:\/\/telegram.org\/js\/telegram-web-app.js"><\/script>/, '');
const policy = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' https: data: blob:; media-src 'self' https: blob: data:; connect-src 'self' https://api.github.com ${origin}; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'none'`;
html = html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${policy}">`);
  html = html.replace('<html lang="en" class="dark">', '<html lang="ru" class="dark native-client native-android">');
writeFileSync(resolve(output,'native-client.css'),readFileSync(resolve(root,'frontend/src/platform/native-client.css')));
html=html.replace('</head>','<link rel="stylesheet" href="/native-client.css"></head>');
writeFileSync(resolve(output, 'index.html'), html);
console.log(`Bundled Spoty ${platform} UI: ${output}`);
