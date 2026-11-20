const LIBRARY_FILE = /^(?:your\s*library|playlist\s*\d*|follow)\.json$/i;
const MAX_JSON_BYTES = 20 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;

export class SpotifyExportError extends Error {}

export async function readSpotifyExport(files: File[]): Promise<unknown[]> {
  const data: unknown[] = [];
  let total = 0;
  const reserve = (bytes: number) => {
    total += bytes;
    if (bytes > MAX_JSON_BYTES || total > MAX_JSON_BYTES) {
      throw new SpotifyExportError('Файлы медиатеки превышают 20 МБ. Импортируй их отдельными частями.');
    }
  };
  for (const file of files) {
    if (LIBRARY_FILE.test(file.name)) {
      reserve(file.size);
      data.push(JSON.parse(await file.text()));
    } else if (/\.zip$/i.test(file.name)) {
      if (file.size > MAX_ARCHIVE_BYTES) {
        throw new SpotifyExportError('ZIP больше 64 МБ. Распакуй его и выбери файлы медиатеки.');
      }
      const { unzipSync } = await import('fflate');
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: ({ name, originalSize, size }) => {
          const basename = name.split(/[\\/]/).pop() || '';
          if (!LIBRARY_FILE.test(basename)) return false;
          reserve(Math.max(originalSize, size));
          return true;
        },
      });
      const decoder = new TextDecoder('utf-8', { fatal: true });
      for (const name of Object.keys(entries).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
        data.push(JSON.parse(decoder.decode(entries[name])));
      }
    }
  }
  if (!data.length) {
    throw new SpotifyExportError('В файлах нет медиатеки Spotify. Выбери ZIP «Данные аккаунта» или YourLibrary.json и Playlist*.json.');
  }
  return data;
}
