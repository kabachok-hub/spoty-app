import type { Artist } from '../../api/types';

const nameKey = (artist: Artist) => artist.name.normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

// Keep musical discovery separate from temporary search results. Insert fresh
// neighbours beside their seed instead of burying them at the end of the grid.
export function expandArtistFrontier(pool: Artist[], seed: Artist, related: Artist[], selected: Artist[]): Artist[] {
  const list = pool.some(a => a.id === seed.id) ? [...pool] : [seed, ...pool];
  const ids = new Set(list.map(a => a.id));
  const names = new Set(list.map(nameKey));
  const fresh = related.filter(a => {
    if (!a.id || !a.name || ids.has(a.id) || names.has(nameKey(a))) return false;
    ids.add(a.id); names.add(nameKey(a)); return true;
  }).slice(0, 18);
  list.splice(list.findIndex(a => a.id === seed.id) + 1, 0, ...fresh);
  const keep = new Set(selected.map(a => a.id));
  const bounded = list.slice(0, 120);
  for (const artist of selected) {
    if (!bounded.some(a => a.id === artist.id)) {
      if (bounded.length >= 120) {
        let removable = bounded.length - 1;
        while (removable >= 0 && keep.has(bounded[removable].id)) removable--;
        if (removable >= 0) bounded.splice(removable, 1);
      }
      bounded.push(artist);
    }
  }
  return bounded;
}
