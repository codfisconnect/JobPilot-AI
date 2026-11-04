import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, Tag } from 'lucide-react';
import { apiClient } from '../../api/client';
import './JobSearchMultiSelect.css';

export interface SearchChip {
  id: string;
  label: string;
  value: string;
  category: 'SKILL' | 'TECHNOLOGY' | 'ROLE' | 'LOCATION' | 'COMPANY' | 'TEXT';
}

export interface JobSearchMultiSelectProps {
  chips: SearchChip[];
  onChange: (chips: SearchChip[]) => void;
  onSearch: () => void;
  placeholder?: string;
  className?: string;
}

interface SuggestionItem {
  label: string;
  value: string;
  category: 'SKILL' | 'TECHNOLOGY' | 'ROLE' | 'LOCATION' | 'COMPANY';
  id?: string;
}

export const JobSearchMultiSelect: React.FC<JobSearchMultiSelectProps> = ({
  chips,
  onChange,
  onSearch,
  placeholder = 'Search roles, skills, locations, companies...',
  className = ''
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions with 220ms debounce
  const fetchSuggestions = useCallback((query: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await apiClient.getJobSuggestions(trimmed);
        // Exclude suggestions that are already in chips
        const existingValues = new Set(chips.map(c => c.value.toLowerCase()));
        const filtered = results.filter(r => !existingValues.has(r.value.toLowerCase()));

        setSuggestions(filtered);
        setIsOpen(filtered.length > 0);
        setHighlightedIndex(-1);
      } catch (err) {
        console.error('Failed to fetch job suggestions:', err);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 220);
  }, [chips]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    fetchSuggestions(val);
  };

  const handleSelectSuggestion = (s: SuggestionItem) => {
    const newChip: SearchChip = {
      id: `${s.category.toLowerCase()}:${s.value}`,
      label: s.label,
      value: s.value,
      category: s.category
    };

    // Avoid duplicate values
    if (!chips.some(c => c.value.toLowerCase() === newChip.value.toLowerCase())) {
      const nextChips = [...chips, newChip];
      onChange(nextChips);
    }

    setInputValue('');
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleRemoveChip = (chipId: string) => {
    const nextChips = chips.filter(c => c.id !== chipId);
    onChange(nextChips);
  };

  const handleClearAll = () => {
    onChange([]);
    setInputValue('');
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && suggestions.length > 0) {
        setIsOpen(true);
      }
      setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        handleSelectSuggestion(suggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        // Add typed text as a TEXT search chip
        const rawText = inputValue.trim();
        const textChip: SearchChip = {
          id: `text:${rawText}`,
          label: rawText,
          value: rawText,
          category: 'TEXT'
        };
        if (!chips.some(c => c.value.toLowerCase() === rawText.toLowerCase())) {
          onChange([...chips, textChip]);
        }
        setInputValue('');
        setSuggestions([]);
        setIsOpen(false);
        setHighlightedIndex(-1);
      } else {
        // If empty input, trigger search execution
        onSearch();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    } else if (e.key === 'Backspace' && !inputValue && chips.length > 0) {
      // Remove last chip on backspace with empty text
      handleRemoveChip(chips[chips.length - 1].id);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`job-search-multiselect-container ${className}`}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="search-leading-icon">
        <Search size={18} aria-hidden="true" />
      </div>

      <div className="job-search-box-inner">
        {chips.map(chip => (
          <span
            key={chip.id}
            className={`job-search-chip chip-category-${chip.category.toLowerCase()}`}
          >
            <span className="chip-tag">{chip.category}</span>
            <span className="chip-text">{chip.label}</span>
            <button
              type="button"
              className="chip-remove-btn"
              onClick={e => {
                e.stopPropagation();
                handleRemoveChip(chip.id);
              }}
              aria-label={`Remove ${chip.label}`}
            >
              <X size={13} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          className="job-search-input"
          placeholder={chips.length === 0 ? placeholder : 'Add skill, role, location...'}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          aria-label="Job search autocomplete input"
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      <div className="job-search-actions">
        {isLoading && (
          <Loader2 size={16} className="animate-spin text-muted" aria-label="Loading suggestions" />
        )}

        {(chips.length > 0 || inputValue) && (
          <button
            type="button"
            className="search-clear-all-btn"
            onClick={e => {
              e.stopPropagation();
              handleClearAll();
            }}
            title="Clear all search filters"
            aria-label="Clear all search filters"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="job-suggestions-dropdown" role="listbox">
          {suggestions.map((item, idx) => (
            <div
              key={`${item.category}-${item.value}-${idx}`}
              role="option"
              aria-selected={idx === highlightedIndex}
              className={`job-suggestion-item ${idx === highlightedIndex ? 'active' : ''}`}
              onMouseEnter={() => setHighlightedIndex(idx)}
              onClick={e => {
                e.stopPropagation();
                handleSelectSuggestion(item);
              }}
            >
              <div className="suggestion-main">
                <Tag size={14} className="suggestion-icon" opacity={0.6} />
                <span className="suggestion-label">{item.label}</span>
              </div>
              <span className={`suggestion-badge suggestion-badge-${item.category}`}>
                {item.category}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
