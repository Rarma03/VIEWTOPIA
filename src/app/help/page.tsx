'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  HiSparkles, HiTrophy, HiCubeTransparent, HiRectangleStack, HiHeart,
  HiGlobeAlt, HiUserGroup, HiBookmark, HiStar, HiUserCircle,
  HiMagnifyingGlass, HiArrowDownTray, HiShare, HiBolt, HiFire,
  HiFilm, HiQuestionMarkCircle, HiArrowRight, HiShieldCheck,
} from 'react-icons/hi2';
import styles from './help.module.css';

type Feature = {
  title: string;
  desc: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  emoji: string;
  color: string;
};

type Category = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  features: Feature[];
};

const CATEGORIES: Category[] = [
  {
    id: 'discover',
    title: 'Discover',
    subtitle: 'Find your next obsession',
    emoji: '🔭',
    features: [
      {
        title: 'Mood Mode',
        desc: 'Set your energy + brain sliders, pick a vibe, get ONE perfect pick. No grids, no scrolling.',
        href: '/mood',
        icon: HiSparkles,
        emoji: '🎲',
        color: 'linear-gradient(135deg, #a855f7, #f59e0b)',
      },
      {
        title: 'Random Roller',
        desc: 'Inside Mood Mode — spin the dice with type/genre/year filters and let chance choose.',
        href: '/mood',
        icon: HiCubeTransparent,
        emoji: '🎰',
        color: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
      },
      {
        title: 'Search',
        desc: 'Search movies, TV, anime, and people — all in one place.',
        href: '/search',
        icon: HiMagnifyingGlass,
        emoji: '🔍',
        color: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
      },
      {
        title: 'Browse Catalogs',
        desc: 'Dive into curated movie, TV show, and anime catalogs.',
        href: '/movies',
        icon: HiFilm,
        emoji: '🎬',
        color: 'linear-gradient(135deg, #ef4444, #f59e0b)',
      },
    ],
  },
  {
    id: 'organize',
    title: 'Organize',
    subtitle: 'Your personal library',
    emoji: '📚',
    features: [
      {
        title: 'My List',
        desc: 'Track watchlist, watching, watched, and favorites — all on your profile.',
        href: '/profile',
        icon: HiBookmark,
        emoji: '🔖',
        color: 'linear-gradient(135deg, #10b981, #06b6d4)',
      },
      {
        title: 'Collections',
        desc: 'Build themed lists ("90s sci-fi", "rainy day comfort") and share them.',
        href: '/collections',
        icon: HiRectangleStack,
        emoji: '🗂️',
        color: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
      },
      {
        title: 'Star Ratings',
        desc: 'Rate anything 1–10. Your taste profile builds itself.',
        href: '/profile',
        icon: HiStar,
        emoji: '⭐',
        color: 'linear-gradient(135deg, #f59e0b, #ef4444)',
      },
      {
        title: 'Export Your Library',
        desc: 'Download your list as PDF, JSON, Markdown, TXT, or CSV.',
        href: '/profile',
        icon: HiArrowDownTray,
        emoji: '📥',
        color: 'linear-gradient(135deg, #14b8a6, #6366f1)',
      },
    ],
  },
  {
    id: 'social',
    title: 'Social',
    subtitle: 'Watch together, talk forever',
    emoji: '👥',
    features: [
      {
        title: 'Recommendations',
        desc: 'Send and receive picks from friends. See who matches your taste.',
        href: '/recommendations',
        icon: HiHeart,
        emoji: '💌',
        color: 'linear-gradient(135deg, #ec4899, #f43f5e)',
      },
      {
        title: 'Watch Parties',
        desc: 'Sync up movie nights with friends in real time.',
        href: '/watch-parties',
        icon: HiUserGroup,
        emoji: '🎉',
        color: 'linear-gradient(135deg, #6366f1, #a855f7)',
      },
      {
        title: 'Global Activity',
        desc: 'See what the world is watching right now.',
        href: '/global',
        icon: HiGlobeAlt,
        emoji: '🌍',
        color: 'linear-gradient(135deg, #06b6d4, #10b981)',
      },
      {
        title: 'Activity Feed',
        desc: 'Latest ratings, reviews, and watches from people you follow.',
        href: '/activity',
        icon: HiBolt,
        emoji: '⚡',
        color: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
      },
    ],
  },
  {
    id: 'compete',
    title: 'Compete',
    subtitle: 'Climb the ranks',
    emoji: '🏆',
    features: [
      {
        title: 'Leaderboard',
        desc: 'See who watches the most, rates the hardest, and reigns supreme.',
        href: '/leaderboard',
        icon: HiTrophy,
        emoji: '👑',
        color: 'linear-gradient(135deg, #f59e0b, #ef4444)',
      },
      {
        title: 'Badges',
        desc: 'Unlock achievements as you watch, rate, and connect.',
        href: '/badges',
        icon: HiShieldCheck,
        emoji: '🎖️',
        color: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
      },
      {
        title: 'Rankings',
        desc: 'Top-rated movies, TV, and anime by the community.',
        href: '/rankings',
        icon: HiFire,
        emoji: '🔥',
        color: 'linear-gradient(135deg, #ef4444, #f97316)',
      },
    ],
  },
  {
    id: 'pro',
    title: 'Premium',
    subtitle: 'Power-user perks',
    emoji: '✨',
    features: [
      {
        title: 'Premium Plan',
        desc: 'Unlock JSON/MD/TXT/CSV exports, advanced stats, and more.',
        href: '/premium',
        icon: HiStar,
        emoji: '💎',
        color: 'linear-gradient(135deg, #f59e0b, #ec4899)',
      },
      {
        title: 'Share Your Profile',
        desc: 'Get a public link friends can browse without logging in.',
        href: '/share',
        icon: HiShare,
        emoji: '🔗',
        color: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
      },
    ],
  },
];

const TIPS = [
  { emoji: '🎯', text: 'Use Mood Mode when you can\'t decide — sliders + vibe = instant pick.' },
  { emoji: '🤝', text: 'Friends\' high-rated picks (8★+) automatically influence your recommendations.' },
  { emoji: '🌓', text: 'Toggle dark/light theme any time from Settings.' },
  { emoji: '📱', text: 'Works great on mobile — add it to your home screen.' },
  { emoji: '🎬', text: 'Click any poster to see cast, trailer, similar titles, and your friends\' ratings.' },
];

const FAQS = [
  {
    q: 'How do I add something to my watchlist?',
    a: 'Click any movie/show/anime card → tap the bookmark icon. Or use the "Save" button on Mood Mode picks.',
  },
  {
    q: 'Why do I see different recs than my friend?',
    a: 'Recommendations blend your ratings, watchlist, and what your friends are loving — so every taste profile is unique.',
  },
  {
    q: 'Is my data private?',
    a: 'Your watchlist is private by default. Collections and ratings are public on your profile. You control sharing.',
  },
  {
    q: 'Can I import from Letterboxd / IMDb / MAL?',
    a: 'Export is live (PDF/JSON/CSV/MD/TXT). Import is on the roadmap — request it on the share page!',
  },
  {
    q: 'What\'s the difference between Mood Mode and Random?',
    a: 'Random is pure chance from your watchlist. Mood Mode reads your sliders + vibe + friends\' taste to score every option.',
  },
];

export default function HelpPage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  return (
    <div className={styles.container}>
      {/* Hero */}
      <motion.section
        className={styles.hero}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className={styles.heroEmoji}>
          <motion.span
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            🎟️
          </motion.span>
        </div>
        <h1 className={styles.heroTitle}>
          Welcome to your <span className={styles.gradient}>Tracker Universe</span>
        </h1>
        <p className={styles.heroSub}>
          Everything you can do here, in one cozy guide. Tap any tile to jump in.
        </p>
        <div className={styles.heroChips}>
          {CATEGORIES.map((c) => (
            <a key={c.id} href={`#${c.id}`} className={styles.heroChip}>
              <span>{c.emoji}</span> {c.title}
            </a>
          ))}
        </div>
      </motion.section>

      {/* Categories */}
      {CATEGORIES.map((cat, ci) => (
        <motion.section
          key={cat.id}
          id={cat.id}
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.4, delay: ci * 0.05 }}
        >
          <div className={styles.sectionHeader}>
            <div className={styles.sectionEmoji}>{cat.emoji}</div>
            <div>
              <h2 className={styles.sectionTitle}>{cat.title}</h2>
              <p className={styles.sectionSub}>{cat.subtitle}</p>
            </div>
          </div>

          <div className={styles.grid}>
            {cat.features.map((f, fi) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.href + f.title}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: fi * 0.05 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                >
                  <Link href={f.href} className={styles.card} style={{ background: f.color }}>
                    <div className={styles.cardEmoji}>{f.emoji}</div>
                    <div className={styles.cardIcon}>
                      <Icon size={28} />
                    </div>
                    <h3 className={styles.cardTitle}>{f.title}</h3>
                    <p className={styles.cardDesc}>{f.desc}</p>
                    <div className={styles.cardCta}>
                      Try it <HiArrowRight size={14} />
                    </div>
                    <div className={styles.cardSheen} />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      ))}

      {/* How it flows */}
      <motion.section
        className={styles.flowSection}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className={styles.sectionTitle}>How it all flows together</h2>
        <p className={styles.sectionSub}>From "what should I watch?" to "I just finished it"</p>
        <div className={styles.flow}>
          <FlowStep emoji="🔍" title="Discover" text="Search, browse, or use Mood Mode" />
          <FlowArrow />
          <FlowStep emoji="🔖" title="Save" text="Add to watchlist with one tap" />
          <FlowArrow />
          <FlowStep emoji="👁️" title="Watch" text="Mark as watching, then watched" />
          <FlowArrow />
          <FlowStep emoji="⭐" title="Rate" text="1–10 stars + optional review" />
          <FlowArrow />
          <FlowStep emoji="💌" title="Share" text="Recommend to friends, climb leaderboards" />
        </div>
      </motion.section>

      {/* Tips */}
      <motion.section
        className={styles.tipsSection}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <h2 className={styles.sectionTitle}>
          <HiBolt /> Pro tips
        </h2>
        <div className={styles.tipGrid}>
          {TIPS.map((t) => (
            <div key={t.text} className={styles.tipCard}>
              <span className={styles.tipEmoji}>{t.emoji}</span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* FAQ */}
      <motion.section
        className={styles.faqSection}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <h2 className={styles.sectionTitle}>
          <HiQuestionMarkCircle /> FAQ
        </h2>
        <div className={styles.faqList}>
          {FAQS.map((item, i) => {
            const open = activeFaq === i;
            return (
              <button
                key={item.q}
                className={`${styles.faqItem} ${open ? styles.faqOpen : ''}`}
                onClick={() => setActiveFaq(open ? null : i)}
              >
                <div className={styles.faqQ}>
                  <span>{item.q}</span>
                  <span className={styles.faqArrow}>{open ? '−' : '+'}</span>
                </div>
                {open && <div className={styles.faqA}>{item.a}</div>}
              </button>
            );
          })}
        </div>
      </motion.section>

      {/* Footer CTA */}
      <motion.section
        className={styles.cta}
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <div className={styles.ctaEmoji}>🚀</div>
        <h2>Ready to dive in?</h2>
        <p>Start with Mood Mode — your perfect pick is one click away.</p>
        <div className={styles.ctaActions}>
          <Link href="/mood" className={styles.ctaBtnPrimary}>
            <HiSparkles /> Try Mood Mode
          </Link>
          <Link href="/profile" className={styles.ctaBtnSecondary}>
            <HiUserCircle /> Go to my Profile
          </Link>
        </div>
      </motion.section>
    </div>
  );
}

function FlowStep({ emoji, title, text }: Readonly<{ emoji: string; title: string; text: string }>) {
  return (
    <div className={styles.flowStep}>
      <div className={styles.flowEmoji}>{emoji}</div>
      <div className={styles.flowTitle}>{title}</div>
      <div className={styles.flowText}>{text}</div>
    </div>
  );
}

function FlowArrow() {
  return (
    <motion.div
      className={styles.flowArrow}
      animate={{ x: [0, 4, 0] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <HiArrowRight size={20} />
    </motion.div>
  );
}
