export type AppRelease = { version: string; url: string };
export function versionParts(value: string): number[] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
export function newerVersion(candidate: string, installed: string): boolean {
  const a = versionParts(candidate), b = versionParts(installed);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
export function selectRelease(feed: unknown, installed: string, android: boolean): AppRelease | null {
  if (!Array.isArray(feed)) throw Error('Invalid release feed');
  let result: AppRelease | null = null;
  for (const release of feed.slice(0, 20)) {
    if (!release || release.draft || !newerVersion(release.tag_name || '', result?.version || installed)) continue;
    const version = release.tag_name.replace(/^v/, '');
    const name = android ? `Spoty-Android-${version}.apk` : 'Spoty-Setup.exe';
    for (const asset of Array.isArray(release.assets) ? release.assets : []) {
      if (asset.name !== name || asset.state !== 'uploaded' || !(asset.size > 0)) continue;
      try {
        const url = new URL(asset.browser_download_url);
        if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) continue;
        if (decodeURIComponent(url.pathname) !== `/kabachok-hub/spoty-app/releases/download/${release.tag_name}/${name}`) continue;
        result = { version, url: url.href }; break;
      } catch { /* Ignore invalid release assets. */ }
    }
  }
  return result;
}
