'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { HiMapPin } from 'react-icons/hi2';
import styles from './LocationAutocomplete.module.css';

interface LocationResult {
  place_id: number;
  display_name: string;
  name: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'Start typing a city...',
  maxLength = 50,
  className = '',
  autoFocus = false,
  onKeyDown,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const suppressSearchRef = useRef(false);

  const searchLocations = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '6',
        'accept-language': 'en',
        featuretype: 'city',
      });

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: { 'User-Agent': 'Viewtopia/1.0' },
        }
      );

      if (!res.ok) throw new Error('Search failed');
      const data: LocationResult[] = await res.json();

      // Deduplicate by display name
      const seen = new Set<string>();
      const unique = data.filter((item) => {
        const key = formatLocation(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setSuggestions(unique);
      setOpen(unique.length > 0);
      setHighlighted(-1);
    } catch {
      setSuggestions([]);
      setOpen(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      searchLocations(value.trim());
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, searchLocations]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const formatLocation = (item: LocationResult) => {
    const addr = item.address;
    const city = addr.city || addr.town || addr.village || item.name;
    const parts = [city];
    if (addr.state) parts.push(addr.state);
    if (addr.country) parts.push(addr.country);
    return parts.join(', ');
  };

  const handleSelect = (item: LocationResult) => {
    const formatted = formatLocation(item);
    suppressSearchRef.current = true;
    onChange(formatted);
    setOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if (e.key === 'Enter' && highlighted >= 0) {
        e.preventDefault();
        handleSelect(suggestions[highlighted]);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className={`${styles.wrapper} ${className}`} ref={wrapperRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className={styles.input}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {loading && <span className={styles.spinner} />}

      {open && suggestions.length > 0 && (
        <ul className={styles.dropdown} role="listbox">
          {suggestions.map((item, i) => (
            <li
              key={item.place_id}
              className={`${styles.option} ${i === highlighted ? styles.highlighted : ''}`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setHighlighted(i)}
              role="option"
              aria-selected={i === highlighted}
            >
              <HiMapPin className={styles.optionIcon} />
              <span>{formatLocation(item)}</span>
            </li>
          ))}
          <li className={styles.attribution}>
            © OpenStreetMap contributors
          </li>
        </ul>
      )}
    </div>
  );
}
