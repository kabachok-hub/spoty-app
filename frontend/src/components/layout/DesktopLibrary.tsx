import { Heart, Library, Plus, Music } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { useNavigationStore } from '../../store/navigationStore';

export function DesktopLibrary() {
  const playlists = useUserStore(s => s.playlists);
  const artists = useUserStore(s => s.followedArtists);
  const favorites = useUserStore(s => s.favorites);
  const navigate = useNavigationStore(s => s.navigateTo);
  const openArtist = useNavigationStore(s => s.openArtist);
  const openLibrary = () => useNavigationStore.getState().setActiveTab('library');
  return <aside className="desktop-library glass-surface" aria-label="Быстрая медиатека">
    <div className="flex items-center justify-between mb-5">
      <button onClick={openLibrary} className="flex items-center gap-2 font-bold text-sm min-h-11"><Library size={19}/>Медиатека</button>
      <button onClick={openLibrary} className="p-3 rounded-full hover:bg-white/10" aria-label="Создать плейлист в медиатеке"><Plus size={20}/></button>
    </div>
    <button onClick={() => navigate({type:'liked_songs'})} className="library-shortcut">
      <span className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-400 flex items-center justify-center shrink-0"><Heart size={23} fill="currentColor"/></span>
      <span className="min-w-0 text-left"><strong className="block truncate text-sm">Любимые треки</strong><span className="text-xs text-zinc-400">Треков: {favorites.length}</span></span>
    </button>
    {playlists.map(p => <button key={p.id} className="library-shortcut" onClick={() => navigate({type:'playlist',playlistId:p.id})}>
      {p.cover_url ? <img src={p.cover_url} alt="" className="w-12 h-12 rounded-lg object-cover"/> : <span className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><Music size={23}/></span>}
      <span className="min-w-0 text-left"><strong className="block truncate text-sm">{p.title}</strong><span className="text-xs text-zinc-400">Плейлист · {p.track_count || 0} треков</span></span>
    </button>)}
    {artists.map(a => <button key={a.id} className="library-shortcut" onClick={() => openArtist(a.id,a.name)}>
      <img src={a.picture_url || '/icon.svg'} alt="" className="w-12 h-12 rounded-full object-cover"/>
      <span className="min-w-0 text-left"><strong className="block truncate text-sm">{a.name}</strong><span className="text-xs text-zinc-400">Исполнитель</span></span>
    </button>)}
    {!playlists.length && !artists.length && <p className="text-sm text-zinc-400 leading-relaxed mt-6">Сохранённые плейлисты и исполнители появятся здесь.</p>}
  </aside>;
}
