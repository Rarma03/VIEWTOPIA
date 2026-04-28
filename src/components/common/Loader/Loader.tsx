'use client';

import { motion } from 'framer-motion';
import styles from './Loader.module.css';
import { useTheme } from '@/context/ThemeContext';

interface LoaderProps {
  text?: string;
  fullScreen?: boolean;
}

export default function Loader({ text = 'VIEWTOPIA', fullScreen = true }: LoaderProps) {
  const { isDark } = useTheme();

  return (
    <div className={`${styles.loaderWrapper} ${fullScreen ? styles.fullScreen : ''} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.loaderContent}>
        <div className={styles.textContainer}>
          <span className={styles.outlineText}>{text}</span>
          <motion.span
            className={styles.fillText}
            initial={{ clipPath: 'inset(0 100% 0 0)' }}
            animate={{ clipPath: 'inset(0 0% 0 0)' }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: 'loop',
              ease: 'easeInOut',
            }}
          >
            {text}
          </motion.span>
        </div>
        <motion.div
          className={styles.progressBar}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: 'loop',
            ease: 'easeInOut',
          }}
        />
      </div>
    </div>
  );
}
