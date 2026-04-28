# Viewtopia — Project Structure & App Flow

## Overview

**App Name:** Viewtopia  
**Type:** Next.js 16 (App Router) full-stack web application  
**Purpose:** Track movies, TV series, and anime — build watchlists, rate content, get recommendations, and socialise with friends via leaderboards, badges, watch parties, and collections.

**Tech Stack:**

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.4 (Turbopack), React 19 |
| Language | TypeScript (strict mode) |
| Styling | CSS Modules, Tailwind CSS 4, React Bootstrap |
| Animation | Framer Motion |
| Auth & DB | Supabase (PostgreSQL + Auth) with localStorage fallback |
| External APIs | TMDB (movies/TV), Jikan (anime), Nominatim (location) |
| State | React Context, localStorage, in-memory cache |
| Notifications | react-hot-toast |
| Icons | react-icons (HeroIcons 2) |

---

## Directory Structure

```
MovieAnimeTracker/
│
├── AGENTS.md                    # Agent instructions for Next.js workspace
├── CLAUDE.md                    # References AGENTS.md
├── README.md                    # Project documentation
├── package.json                 # Dependencies & scripts
├── next.config.ts               # Next.js config (TMDB & MAL image domains)
├── tsconfig.json                # TypeScript config (strict, @ path alias → src/)
├── eslint.config.mjs            # ESLint config
├── postcss.config.mjs           # PostCSS config
├── next-env.d.ts                # Next.js type declarations
├── project_structure.md         # ← This file
│
├── public/
│   ├── images/
│   │   ├── no-poster.png        # Fallback poster image
│   │   ├── no-backdrop.png      # Fallback backdrop image
│   │   └── dark-bg-stripe.webp  # Hero background texture
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
├── supabase/
│   └── schema.sql               # PostgreSQL DDL: profiles, watchlist_items,
│                                 # ratings, recommendations, activities, RLS policies
│
└── src/
    ├── app/                     # Next.js App Router (pages & layouts)
    ├── components/              # Reusable UI components
    ├── context/                 # React Context providers (Auth, Theme)
    ├── data/                    # (empty — seed data lives in store.ts)
    ├── lib/                     # Utility functions & API clients
    └── types/                   # TypeScript type definitions
```

---

## src/app/ — Pages & Routes

### Root Files

| File | Purpose |
|------|---------|
| `layout.tsx` | Root `<html>` layout. Loads Space Grotesk font, wraps app in `<Providers>`. |
| `page.tsx` | **Home page.** Hero banner, quick-nav buttons, trending/popular media rows, multi-genre browse with pill selectors. |
| `providers.tsx` | Wraps children in `ThemeProvider`, `AuthProvider`; renders `Navbar`, `Footer`, `Toaster`. |
| `globals.css` | Global styles, CSS reset, `html { zoom: 0.75 }` scaling. |
| `home.module.css` | Home page styles. |

### Public Pages

| Route | File | What It Does |
|-------|------|-------------|
| `/login` | `login/page.tsx` | Email/password form, Google OAuth button, demo-user one-click login. |
| `/onboarding` | `onboarding/page.tsx` | 2-step flow: choose a unique username → pick a city via location autocomplete. |
| `/search` | `search/page.tsx` | Multi-source search (movies, TV, anime, people) with live dropdown. Debounced queries hit TMDB + Jikan simultaneously. |
| `/share` | `share/page.tsx` | Decodes a base64-encoded share link (`?c=<encoded>`) and displays a shared collection publicly. |
| `/u/[username]` | `u/[username]/page.tsx` | Looks up a username → redirects to `/profile/[userId]`. |

### Browse Pages

| Route | File | What It Does |
|-------|------|-------------|
| `/movies` | `movies/page.tsx` | Browse movies via tabs: Popular, Top Rated, Now Playing, Upcoming. Paginated results from TMDB. |
| `/tv` | `tv/page.tsx` | Browse TV series via tabs: Popular, Top Rated, On the Air. Paginated TMDB results. |
| `/anime` | `anime/page.tsx` | Browse anime via tabs: Top, Airing, Upcoming, By Popularity. Uses Jikan API. |

### Media Detail Pages

| Route | File | What It Does |
|-------|------|-------------|
| `/movies/[id]` | `movies/[id]/page.tsx` | Full movie details: backdrop, poster, genres, cast (circular images), crew, videos, similar titles. Star rating widget (auto-marks as watched), Add to Watchlist button (shows "Added" state), Recommend modal. |
| `/tv/[id]` | `tv/[id]/page.tsx` | Same as movie detail + season/episode counts. Same rating & watchlist behaviour. |
| `/anime/[id]` | `anime/[id]/page.tsx` | Anime details from Jikan: Japanese/English titles, studios, episodes, type, synopsis, characters. Same rating/watchlist/recommend actions. |

### Protected Pages (require auth)

| Route | File | What It Does |
|-------|------|-------------|
| `/watchlist` | `watchlist/page.tsx` | Manage watchlist items. Filter by status. Change status dropdown, rate, set watched date. Export to JSON/Markdown/Text (premium). |
| `/watched` | `watched/page.tsx` | History of watched items. Rating distribution histogram. Filter by media type. 10-star colour gradient. |
| `/activity` | `activity/page.tsx` | Chronological timeline of user actions (watched, rated, added, recommended) via `ActivityFeed` component. |
| `/recommendations` | `recommendations/page.tsx` | Incoming recommendations. Two tabs: Friends (filtered by friendship) and Global. Media type filter. |
| `/recommendations/[userId]` | `recommendations/[userId]/page.tsx` | All recommendations from a specific user. Media type filter. |
| `/profile/[userId]` | `profile/[userId]/page.tsx` | User profile: avatar, stats (hours, titles, avg rating), watch graph (6 mo / 1 yr / All Time range picker), genre breakdown, recent activity, collections, badges, friend/recommend actions. |
| `/settings` | `settings/page.tsx` | Edit display name, username (unique validation), city (location autocomplete). Logout button. |
| `/premium` | `premium/page.tsx` | Premium features list, payment method placeholder, free-activate button. Toggles premium flag in store. |
| `/collections` | `collections/page.tsx` | Create/edit/delete named collections. Search to add items. Generate shareable links (base64-encoded). |
| `/random` | `random/page.tsx` | Random media picker: choose type (movie/TV/anime), genre, year range. Shuffle until satisfied. |
| `/badges` | `badges/page.tsx` | 50 achievement badges (easy/medium/hard). Filter by difficulty or category. Progress bars. |
| `/leaderboard` | `leaderboard/page.tsx` | Standalone leaderboard: rank users by hours/count/avg rating. Time filter: Monthly / Yearly / All Time with month/year arrow navigation. |
| `/global` | `global/page.tsx` | Community hub with 3 tabs: **Leaderboard** (same ranking + time filter), **Badges** (global badge stats), **Users** (directory with friend actions). |
| `/watch-parties` | `watch-parties/page.tsx` | Browse/create watch parties. Filter by city. Each party: movie, theatre, date/time, max members. Join/leave. |
| `/watch-parties/[id]` | `watch-parties/[id]/page.tsx` | Party detail: info card, member list, live chat (Supabase realtime or localStorage fallback + BroadcastChannel sync). |

### Auth Route

| Route | File | What It Does |
|-------|------|-------------|
| `/auth/callback` | `auth/callback/route.ts` | Server-side route handler. Exchanges Supabase auth code for session, redirects to `/onboarding`. |

---

## src/components/ — Reusable Components

### Common (`components/common/`)

| Component | File | Purpose |
|-----------|------|---------|
| **Navbar** | `Navbar/Navbar.tsx` | Top navigation bar. Logo, nav links, search trigger, theme toggle, auth dropdown (login/profile/logout), mobile hamburger menu, premium indicator badge. |
| **Footer** | `Footer/Footer.tsx` | Site footer. Browse links, feature links, GitHub credit. |
| **MediaCard** | `MediaCard/MediaCard.tsx` | Card for a single media item. Poster image, title, rating badge, media-type badge, genre tags. Used on browse/search/home pages. |
| **SearchBar** | `SearchBar/SearchBar.tsx` | Live search bar with dropdown results. Debounced input, queries TMDB + Jikan, category filter pills. |
| **StarRating** | `StarRating/StarRating.tsx` | Interactive 1–10 star rating widget. Supports half-stars, click cycling, read-only mode, value display. |
| **RatingDisplay** | `RatingDisplay/RatingDisplay.tsx` | Dual rating display: platform average vs. global TMDB/Jikan score. |
| **RecommendModal** | `RecommendModal/RecommendModal.tsx` | Modal overlay to recommend media to friends or everyone. Visibility toggle, optional message. Scrollable (max-height 85vh). |
| **Loader** | `Loader/Loader.tsx` | Animated loading spinner with text fill effect and progress bar. |
| **LocationAutocomplete** | `LocationAutocomplete/LocationAutocomplete.tsx` | City search using OpenStreetMap Nominatim API (350ms debounce). Dropdown suggestions. |
| **Starfield** | `Starfield/Starfield.tsx` | Animated starfield canvas background effect. |
| **TicketLogo** | `TicketLogo/TicketLogo.tsx` | App logo/branding component. |
| **ThemeToggle** | `ThemeToggle/` | Dark/light mode toggle button. |

### Home (`components/home/`)

| Component | File | Purpose |
|-----------|------|---------|
| **HeroBanner** | `HeroBanner/HeroBanner.tsx` | 5-item rotating carousel (6s auto-advance). Backdrop images, title, overview, Add to List toggle. Uses `useMemo` for stable items to prevent re-renders. |
| **MediaRow** | `MediaRow/MediaRow.tsx` | Horizontal scrollable media carousel with left/right scroll buttons. Receives title + array of `MediaItem`. |

### Recommendations (`components/recommendations/`)

| Component | File | Purpose |
|-----------|------|---------|
| **RecommendationCard** | `RecommendationCard/RecommendationCard.tsx` | Single recommendation card. Recommender avatar, media info, message, timestamp. |

### Watchlist (`components/watchlist/`)

| Component | File | Purpose |
|-----------|------|---------|
| **WatchlistCard** | `WatchlistCard/WatchlistCard.tsx` | Watchlist item management card. Status dropdown, star rating, date picker, delete button. |

---

## src/context/ — React Context

| File | Purpose |
|------|---------|
| `AuthContext.tsx` | **Dual auth system.** Supports Supabase OAuth (Google) + demo user via localStorage. Exposes `useAuth()` hook: `user`, `isLoading`, `isAuthenticated`, `login()`, `loginWithGoogle()`, `loginAsDemo()`, `logout()`. |
| `ThemeContext.tsx` | **Dark/light mode.** Persists preference to localStorage, sets `data-theme` on `<html>`. Exposes `useTheme()` hook: `theme`, `isDark`, `toggleTheme()`. |

---

## src/lib/ — Utilities & API Clients

| File | Purpose | Key Exports |
|------|---------|-------------|
| `tmdb.ts` | **TMDB API client.** Movies & TV data. Rate-limited (250ms between requests). | `getTrending()`, `getPopularMovies()`, `getPopularTV()`, `getTopRatedMovies()`, `getTopRatedTV()`, `getNowPlayingMovies()`, `getUpcomingMovies()`, `getOnAirTV()`, `discoverMovies()`, `discoverTV()`, `getMovieDetails()`, `getTVDetails()`, `searchMovies()`, `searchTV()`, `searchMulti()`, `searchPerson()`, `normalizeMediaItem()`, `tmdbImage()`, `tmdbBackdrop()` |
| `jikan.ts` | **Jikan API client.** Anime data from MyAnimeList. Rate-limited (350ms). | `getTopAnime()`, `getSeasonalAnime()`, `searchAnime()`, `getAnimeDetails()`, `getAnimeCharacters()`, `getAnimeStats()`, `jikanImage()` |
| `supabase.ts` | **Supabase client init.** Singleton pattern, checks env vars. | `getSupabase()`, `isSupabaseConfigured` |
| `store.ts` | **Local state manager.** localStorage + in-memory store with 5 demo users and seed data. Handles watchlist, ratings, recommendations, activity, collections, badges, friendships, watch parties, premium. Input sanitisation via `sanitizeString()`. | `initStore()`, `getWatchlist()`, `addToWatchlist()`, `updateWatchlistItem()`, `removeFromWatchlist()`, `getRatings()`, `addRating()`, `getRecommendations()`, `addRecommendation()`, `getActivity()`, `addActivity()`, `getCollections()`, `createCollection()`, `deleteCollection()`, `addToCollection()`, `removeFromCollection()`, `getUserBadges()`, `checkAndUpdateBadges()`, `getFriends()`, `sendFriendRequest()`, `acceptFriendRequest()`, `rejectFriendRequest()`, `removeFriend()`, `getFriendshipStatus()`, `getWatchParties()`, `createWatchParty()`, `joinWatchParty()`, `leaveWatchParty()`, `deleteWatchParty()`, `isPremiumUser()`, `togglePremium()`, `updateDemoUser()`, `DEMO_USERS` |
| `badges.ts` | **Achievement system.** 50 badges across easy/medium/hard difficulties and 6 categories (watching, rating, social, collection, exploration, dedication). | `ALL_BADGES`, `DIFFICULTY_CONFIG`, `CATEGORY_CONFIG` |
| `chat.ts` | **Watch party chat.** Supabase realtime or localStorage fallback. BroadcastChannel for cross-tab sync. | `sendChatMessage()`, `fetchChatMessages()`, `isChatLive` |
| `api-cache.ts` | **API caching layer.** In-memory + sessionStorage with TTL. Request deduplication for in-flight calls. | `cachedFetch()` |
| `constants.ts` | **App constants.** | `APP_NAME` ("Viewtopia"), `MEDIA_TYPE_LABELS`, `WATCH_STATUS_LABELS`, `WATCH_STATUS_COLORS`, `NAV_LINKS`, `GENRE_MAP` (28 TMDB genres), `RATING_SCALE` |
| `export.ts` | **Watchlist export.** Generates downloadable file in chosen format. | `exportWatchlist(items, displayName, format)` — supports `'json'`, `'markdown'`, `'text'` |
| `share.ts` | **Collection sharing.** Encodes/decodes collections to URL-safe base64 strings. | `encodeCollection()`, `decodeCollection()`, `getShareUrl()` |

---

## src/types/ — Type Definitions

| File | Key Types |
|------|-----------|
| `index.ts` | `MediaItem`, `WatchlistItem`, `Rating`, `Recommendation`, `ActivityItem`, `Collection`, `UserBadge`, `Badge`, `BadgeDifficulty`, `BadgeCategory`, `FriendshipStatus`, `WatchParty`, `ChatMessage`, `DemoUser` |

---

## supabase/ — Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | Extended user profiles (display_name, avatar_url) linked to `auth.users`. |
| `watchlist_items` | Media tracking per user: media_id, media_type, status, rating, watched_date, notes. |
| `ratings` | Standalone ratings table: rating (1–10) + optional review text. |
| `recommendations` | User-to-user media recommendations with message. |
| `activities` | Activity log: type (watched/rated/added/recommended), media info, timestamp. |

**Security:** Row-Level Security (RLS) enabled. Public reads, user-scoped writes. Auto-create profile trigger on signup. Auto-update `updated_at` timestamps.

---

## App Flow

### 1. Authentication

```
/login → [Email/Password | Google OAuth | Demo User]
   ↓
/auth/callback (OAuth code exchange — server route)
   ↓
/onboarding (set username + city)
   ↓
/ (home page — authenticated)
```

- **Supabase mode:** Full OAuth flow with server-side callback.
- **Demo mode:** Sets demo user in localStorage, skips OAuth.
- `AuthContext` wraps the app and provides `useAuth()` everywhere.

### 2. Browsing & Discovery

```
/ (home)
├── Hero Banner → 5 rotating featured items
├── Quick Nav → Movies / TV / Anime / Search / Random
├── Media Rows → Trending, Popular (Movies/TV/Anime), Top Rated, Now Playing, Upcoming
└── Genre Browse → Multi-genre pill selector → filtered TMDB discover results

/movies → Popular | Top Rated | Now Playing | Upcoming (paginated)
/tv     → Popular | Top Rated | On the Air (paginated)
/anime  → Top | Airing | Upcoming | By Popularity (paginated)
/search → Live multi-source search (TMDB + Jikan)
/random → Random media picker with type/genre/year filters
```

### 3. Media Details & Actions

```
/movies/[id] or /tv/[id] or /anime/[id]
├── View details (backdrop, poster, genres, cast, crew, videos, similar)
├── Rate (1-10 stars) → auto-adds to watchlist as "watched"
├── Add to Watchlist → button shows "Added" when already in list
├── Recommend → modal to send to friends or everyone
└── View platform vs global rating comparison
```

### 4. Watchlist & Watched Management

```
/watchlist → Filter by status → change status/rating/date → export (premium)
/watched   → View watched history → rating distribution chart → type filter
```

### 5. Social Features

```
/profile/[userId] → Stats, watch graph (6mo/1yr/all), genres, activity, collections, badges
/recommendations  → Friends tab | Global tab → media type filter
/global           → Leaderboard (monthly/yearly/all + category) | Badges | Users (friend actions)
/leaderboard      → Standalone ranking with month/year picker
/watch-parties    → Create/browse parties → join → live chat in /watch-parties/[id]
```

### 6. Collections & Sharing

```
/collections → Create named collections → search & add items → share via base64 link
/share?c=<encoded> → Public view of shared collection (no auth needed)
```

### 7. Achievements

```
/badges → 50 badges (easy/medium/hard) across 6 categories
        → Auto-unlocked via checkAndUpdateBadges() on page loads
        → Filter by difficulty, category, unlock status
```

### 8. Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  TMDB API   │────▶│  api-cache   │────▶│   Pages     │
│  Jikan API  │     │  (TTL cache) │     │ Components  │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                    ┌──────────────┐             │ read/write
                    │   store.ts   │◀────────────┘
                    │ (localStorage│
                    │  + memory)   │
                    └──────┬───────┘
                           │ fallback ↕ primary
                    ┌──────▼───────┐
                    │   Supabase   │
                    │  (Postgres)  │
                    └──────────────┘
```

- **API data** (media info, search) flows through `api-cache.ts` with 5-min TTL.
- **User data** (watchlist, ratings, collections, etc.) lives in `store.ts` (localStorage) with Supabase as optional backend.
- **Chat** uses Supabase realtime when available, falls back to localStorage + BroadcastChannel.
- **Rate limiting:** TMDB 250ms, Jikan 350ms, Nominatim 350ms debounce.

---

## Colour Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary Red | `#e50914` | CTAs, accents |
| Cyan | `#00d4ff` | Links, highlights |
| Purple | `#a855f7` | Active tabs, badges |
| Gold | `#ffd700` | Medals, premium |
| Background | `#050208` | Dark mode base |
| Text | `#e8edf5` | Body text |
