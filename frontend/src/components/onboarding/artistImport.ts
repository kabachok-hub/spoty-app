// Parse locally; only artist names are sent to catalog search after confirmation.
export function parseArtistNames(text: string): string[] {
  if (text.length > 200000) throw new Error('Список слишком большой. Используйте до 50 артистов.');
  const input = text.trim();
  let names: unknown[] = [];
  if (input.startsWith('[') || input.startsWith('{')) {
    const data = JSON.parse(input);
    const rows = Array.isArray(data) ? data : data.artists?.items || data.artists || data.following?.artists || data.followed_artists;
    if (!Array.isArray(rows)) throw new Error('Нужен JSON со списком artists или массив имён.');
    names = rows.map(row => typeof row === 'string' ? row : row.name || row.artistName);
  } else {
    const lines = input.split(/\r?\n/).filter(Boolean);
    const delimiter = lines[0]?.includes(';') ? ';' : ',';
    const cells = (line: string) => {
      const out: string[] = []; let cell = '', quoted = false;
      for (let i=0;i<line.length;i++) {
        const ch=line[i];
        if (ch==='"') { if(quoted && line[i+1]==='"'){cell+='"';i++;} else quoted=!quoted; }
        else if (ch===delimiter && !quoted) {out.push(cell.trim());cell='';}
        else cell+=ch;
      }
      out.push(cell.trim()); return out;
    };
    const header = cells(lines[0] || '').map(v => v.toLowerCase());
    const column = header.findIndex(v => ['artist', 'artist name', 'artist_name', 'исполнитель'].includes(v));
    names = column >= 0 ? lines.slice(1).map(line => cells(line)[column]) : lines.flatMap(line => line.split(delimiter === ';' ? ';' : '\n'));
  }
  const seen = new Set<string>();
  const result = names.filter((v): v is string => typeof v === 'string').map(v => v.trim()).filter(v => {
    const key = v.normalize('NFKC').toLowerCase().replace(/ё/g, 'е');
    if (!v || v.length > 100 || /https?:|token|password|пароль/i.test(v) || seen.has(key)) return false;
    seen.add(key); return true;
  });
  if (result.length > 50) throw new Error('За один раз можно проверить до 50 артистов.');
  if (!result.length) throw new Error('Не найдено имён артистов. Укажите по одному имени в строке.');
  return result;
}
