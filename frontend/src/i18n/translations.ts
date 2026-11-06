export type Language = 'ru' | 'en';

export const translations = {
  ru: {
    // Navigation
    home: 'Главная',
    search: 'Поиск',
    library: 'Медиатека',

    // Greetings & Headers
    good_morning: 'Доброе утро',
    good_afternoon: 'Добрый день',
    good_evening: 'Добрый вечер',
    made_for_you: 'Только для тебя',
    your_top_mixes: 'Твои лучшие миксы',
    recently_played: 'Недавние',
    more_like: 'Похоже на',
    popular_artists: 'Популярные артисты',
    featured_playlists: 'Популярные плейлисты',
    top_hits_today: 'Топ хиты сегодня',
    global_chart: 'Мировой чарт',
    quick_picks: 'Быстрый выбор',
    radio_suffix: 'радио',
    mix_suffix: 'микс',

    // Filter Chips
    all: 'Все',
    music: 'Музыка',
    mixes: 'Миксы',

    // Search Page
    search_placeholder: 'Что хочешь послушать?',
    browse_all: 'Все жанры',
    songs: 'Треки',
    artists: 'Артисты',
    playlists: 'Плейлисты',
    no_results: 'Ничего не найдено',
    no_results_desc: 'Попробуй ввести другое название или имя исполнителя.',

    // Library
    your_library: 'Моя медиатека',
    liked_songs: 'Любимые треки',
    liked_songs_desc: 'Твоя коллекция понравившихся песен',
    followed_artists: 'Подписки',
    create_playlist: 'Создать плейлист',
    playlist_name_placeholder: 'Мой плейлист #1',
    description_placeholder: 'Добавить описание (необязательно)',
    cancel: 'Отмена',
    create: 'Создать',
    delete_playlist: 'Удалить плейлист',
    empty_playlist: 'В этом плейлисте пока нет треков',

    // Artist
    verified_artist: 'Подтвержденный артист',
    monthly_listeners: 'слушателей за месяц',
    popular: 'Популярные треки',
    discography: 'Дискография',
    album: 'Альбом',
    albums: 'Альбомы',
    show_all: 'Показать больше',
    show_less: 'Показать меньше',
    follow: 'Подписаться',
    following: 'Вы подписаны',

    // Notifications
    notifications: 'Уведомления',
    whats_new: 'Новинки от артистов',
    new_release: 'Новый релиз',
    new_album: 'Новый альбом',
    no_notifications: 'Пока нет новых релизов',
    no_notifications_desc: 'Подпишись на любимых артистов, чтобы получать их свежие треки!',
    play_now: 'Слушать',

    // Settings
    settings: 'Настройки',
    language: 'Язык интерфейса',
    theme: 'Оформление',
    theme_spotify: 'Spoty Dark (Классическая)',
    theme_oled: 'OLED Pure Black (Глубокий черный)',
    theme_midnight: 'Midnight Navy (Ночной индиго)',
    audio_quality: 'Качество аудиопотока',
    audio_quality_high: 'Высокое (192 kbps)',
    audio_quality_normal: 'Стандартное (128 kbps)',
    top_music_cloud: 'Всплывающее облачко трека',
    top_music_cloud_desc: 'Показывать плавающее облачко сверху при смене трека',
    version: 'Версия приложения',
    close: 'Закрыть',

    // Player
    now_playing: 'Сейчас играет',
    playing_from: 'Играет из',
    queue: 'Очередь',
    next_up: 'Далее в очереди',
    empty_queue: 'Очередь пуста',
    volume: 'Громкость',
    mute: 'Выключить звук',
    unmute: 'Включить звук',
    hq_audio: 'HQ Стриминг • 192 kbps',
    added_to_favorites: 'Добавлено в Любимые треки',
    removed_from_favorites: 'Удалено из Любимых треков',
  },
  en: {
    // Navigation
    home: 'Home',
    search: 'Search',
    library: 'Your Library',

    // Greetings & Headers
    good_morning: 'Good morning',
    good_afternoon: 'Good afternoon',
    good_evening: 'Good evening',
    made_for_you: 'Made For You',
    your_top_mixes: 'Your Top Mixes',
    recently_played: 'Recently Played',
    more_like: 'More like',
    popular_artists: 'Popular Artists',
    featured_playlists: 'Featured Playlists',
    top_hits_today: 'Top Hits Today',
    global_chart: 'Global Chart',
    quick_picks: 'Quick picks',
    radio_suffix: 'Radio',
    mix_suffix: 'Mix',

    // Filter Chips
    all: 'All',
    music: 'Music',
    mixes: 'Mixes',

    // Search Page
    search_placeholder: 'What do you want to listen to?',
    browse_all: 'Browse all',
    songs: 'Songs',
    artists: 'Artists',
    playlists: 'Playlists',
    no_results: 'No results found',
    no_results_desc: 'Please check the spelling or try searching for another keyword.',

    // Library
    your_library: 'Your Library',
    liked_songs: 'Liked Songs',
    liked_songs_desc: 'Your saved favorite songs',
    followed_artists: 'Followed Artists',
    create_playlist: 'Create Playlist',
    playlist_name_placeholder: 'My Playlist #1',
    description_placeholder: 'Add an optional description',
    cancel: 'Cancel',
    create: 'Create',
    delete_playlist: 'Delete playlist',
    empty_playlist: 'This playlist is empty',

    // Artist
    verified_artist: 'Verified Artist',
    monthly_listeners: 'monthly listeners',
    popular: 'Popular',
    discography: 'Discography',
    album: 'Album',
    albums: 'Albums',
    show_all: 'Show more',
    show_less: 'Show less',
    follow: 'Follow',
    following: 'Following',

    // Notifications
    notifications: 'Notifications',
    whats_new: "What's New",
    new_release: 'New Release',
    new_album: 'New Album',
    no_notifications: 'No new releases yet',
    no_notifications_desc: 'Follow your favorite artists to stay updated on their latest tracks!',
    play_now: 'Play',

    // Settings
    settings: 'Settings',
    language: 'Interface Language',
    theme: 'Theme',
    theme_spotify: 'Spoty Dark (Classic)',
    theme_oled: 'OLED Pure Black',
    theme_midnight: 'Midnight Navy',
    audio_quality: 'Streaming Quality',
    audio_quality_high: 'High (192 kbps)',
    audio_quality_normal: 'Normal (128 kbps)',
    top_music_cloud: 'Top Floating Music Cloud',
    top_music_cloud_desc: 'Show dynamic island pill at the top on track changes',
    version: 'App Version',
    close: 'Close',

    // Player
    now_playing: 'Now Playing',
    playing_from: 'Playing from',
    queue: 'Queue',
    next_up: 'Next Up',
    empty_queue: 'Queue is empty',
    volume: 'Volume',
    mute: 'Mute',
    unmute: 'Unmute',
    hq_audio: 'HQ Streaming • 192 kbps',
    added_to_favorites: 'Added to Liked Songs',
    removed_from_favorites: 'Removed from Liked Songs',
  },
};
