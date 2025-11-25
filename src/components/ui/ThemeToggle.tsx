/**
 * Theme Toggle Button
 * Allows switching between light, dark, and system themes
 */

'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import styles from './ThemeToggle.module.css';

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Default to light mode if theme hasn't been determined yet
  const isDark = resolvedTheme === 'dark';

  const toggleTheme = () => {
    if (!mounted) return;
    setTheme(isDark ? 'light' : 'dark');
  };

  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={label}
      title={label}
      onClick={toggleTheme}
      className={cn(styles.switch, isDark ? styles.switchDark : styles.switchLight)}
      disabled={!mounted}
    >
      <span className={styles.knob}>
        {isDark ? (
          <Moon className={cn(styles.icon, styles.iconMoon)} />
        ) : (
          <Sun className={styles.icon} />
        )}
      </span>
    </button>
  );
}
