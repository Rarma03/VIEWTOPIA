// App-wide constants

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Viewtopia';

export const MEDIA_TYPE_LABELS: Record<string, string> = {
  movie: 'Movie',
  tv: 'TV Series',
  anime: 'Anime',
  manga: 'Manga',
};

export const WATCH_STATUS_LABELS: Record<string, string> = {
  watchlist: 'Watchlist',
  watching: 'Watching',
  watched: 'Watched',
  dropped: 'Dropped',
};

export const WATCH_STATUS_COLORS: Record<string, string> = {
  watchlist: '#6c757d',
  watching: '#0d6efd',
  watched: '#198754',
  dropped: '#dc3545',
};

export const RATING_SCALE = 10;

export const NAV_LINKS = [
  { href: '/', label: 'Home', icon: 'HiHome' },
  { href: '/mood', label: 'Mood', icon: 'HiSparkles' },
  { href: '/watched', label: 'Watched', icon: 'HiEye' },
  { href: '/activity', label: 'History', icon: 'HiClock' },
  { href: '/recommendations', label: 'Friends Recommendation', icon: 'HiHeart' },
  { href: '/watch-parties', label: 'Watch Parties', icon: 'HiUserGroup' },
];

export const GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie',
  53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News',
  10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap',
  10767: 'Talk', 10768: 'War & Politics',
};
