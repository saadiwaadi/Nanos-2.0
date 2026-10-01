"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { PAKISTAN_CITIES } from "@/lib/cities";

// Client-side session memory cache
let globalCitiesCache: string[] | null = null;
let fetchPromise: Promise<string[]> | null = null;

const FALLBACK_CITIES = PAKISTAN_CITIES.filter(
  (c) => c && c.toLowerCase() !== "other"
).sort((a, b) => a.localeCompare(b));

export interface CityComboboxProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (city: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  hasError?: boolean;
  "aria-describedby"?: string;
}

export function CityCombobox({
  id = "city-combobox",
  name = "city",
  value,
  onChange,
  onBlur,
  placeholder = "Type or search city (e.g. Lahore, Karachi)",
  required = false,
  disabled = false,
  className = "",
  hasError = false,
  "aria-describedby": ariaDescribedBy,
}: CityComboboxProps) {
  const [cities, setCities] = useState<string[]>(() => globalCitiesCache || FALLBACK_CITIES);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const lastValidValueRef = useRef<string>(value || "");
  const isInteractingWithListRef = useRef(false);

  // Sync internal query with external value changes
  useEffect(() => {
    setQuery(value || "");
    if (value) {
      lastValidValueRef.current = value;
    }
  }, [value]);

  // Load operational cities from API
  useEffect(() => {
    if (globalCitiesCache && globalCitiesCache.length > 0) {
      setCities(globalCitiesCache);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetch("/api/cities")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load cities");
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data?.cities) && data.cities.length > 0) {
            globalCitiesCache = data.cities;
            return data.cities;
          }
          return FALLBACK_CITIES;
        })
        .catch((err) => {
          console.warn("Could not fetch operational cities, using fallback:", err);
          return FALLBACK_CITIES;
        });
    }

    fetchPromise.then((loadedCities) => {
      setCities(loadedCities);
    });
  }, []);

  // Filter cities by typed query
  const filteredCities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.toLowerCase().includes(q));
  }, [cities, query]);

  // Auto-scroll highlighted element into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const activeElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen, highlightedIndex]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        commitOrRevert();
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [query, cities]);

  function commitCity(city: string) {
    setQuery(city);
    lastValidValueRef.current = city;
    onChange(city);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  function commitOrRevert() {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      // Cleared input
      setQuery("");
      lastValidValueRef.current = "";
      onChange("");
      return;
    }

    // Exact match search
    const exactMatch = cities.find((c) => c.toLowerCase() === trimmed);
    if (exactMatch) {
      commitCity(exactMatch);
    } else {
      // Revert to last valid selection (or clear if none)
      const prev = lastValidValueRef.current;
      setQuery(prev);
      onChange(prev);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    setHighlightedIndex(0);

    const trimmed = val.trim().toLowerCase();
    const exactMatch = cities.find((c) => c.toLowerCase() === trimmed);
    if (exactMatch) {
      lastValidValueRef.current = exactMatch;
      onChange(exactMatch);
    } else {
      // Clear valid selection until a city is picked
      onChange("");
    }
  }

  function handleFocus() {
    setIsOpen(true);
    // Find current city index to highlight
    if (value) {
      const idx = filteredCities.findIndex(
        (c) => c.toLowerCase() === value.toLowerCase()
      );
      if (idx >= 0) setHighlightedIndex(idx);
    }
  }

  function handleBlur() {
    // If user is clicking/tapping a dropdown item, don't revert yet
    if (isInteractingWithListRef.current) return;

    commitOrRevert();
    setIsOpen(false);
    if (onBlur) onBlur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setHighlightedIndex(0);
        } else if (filteredCities.length > 0) {
          setHighlightedIndex((prev) =>
            prev < filteredCities.length - 1 ? prev + 1 : 0
          );
        }
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setHighlightedIndex(filteredCities.length - 1);
        } else if (filteredCities.length > 0) {
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCities.length - 1
          );
        }
        break;
      }
      case "Enter": {
        if (isOpen) {
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredCities[highlightedIndex]) {
            commitCity(filteredCities[highlightedIndex]);
          } else if (filteredCities.length === 1) {
            commitCity(filteredCities[0]);
          } else {
            commitOrRevert();
            setIsOpen(false);
          }
        }
        break;
      }
      case "Escape": {
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
          setQuery(lastValidValueRef.current);
          onChange(lastValidValueRef.current);
        }
        break;
      }
      case "Tab": {
        if (isOpen) {
          if (highlightedIndex >= 0 && filteredCities[highlightedIndex]) {
            commitCity(filteredCities[highlightedIndex]);
          } else {
            commitOrRevert();
            setIsOpen(false);
          }
        }
        break;
      }
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%" }}
      className={`city-combobox-wrapper ${className}`}
    >
      <input
        ref={inputRef}
        type="text"
        id={id}
        name={name}
        value={query}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        spellCheck="false"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={
          isOpen && highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined
        }
        aria-describedby={ariaDescribedBy}
        style={{
          width: "100%",
          padding: "10px 14px",
          border: hasError ? "1.5px solid #c0392b" : "1.5px solid var(--stone, #D9D6CF)",
          borderRadius: "4px",
          fontSize: "16px",
          minHeight: "44px",
          background: "var(--off-white, #F7F5F0)",
          color: "var(--black, #111111)",
          fontFamily: "var(--font-body, inherit)",
          transition: "border-color 0.15s ease",
          boxSizing: "border-box",
        }}
      />

      {isOpen && (
        <ul
          ref={listRef}
          id={`${id}-listbox`}
          role="listbox"
          onMouseDown={() => {
            isInteractingWithListRef.current = true;
          }}
          onMouseUp={() => {
            isInteractingWithListRef.current = false;
          }}
          onTouchStart={() => {
            isInteractingWithListRef.current = true;
          }}
          onTouchEnd={() => {
            isInteractingWithListRef.current = false;
          }}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 999,
            maxHeight: "240px",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            background: "var(--white, #FFFFFF)",
            border: "1.5px solid var(--stone, #D9D6CF)",
            borderRadius: "6px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
            listStyle: "none",
            padding: "4px 0",
            margin: 0,
          }}
        >
          {filteredCities.length === 0 ? (
            <li
              style={{
                padding: "12px 14px",
                color: "#777777",
                fontSize: "13.5px",
                fontFamily: "var(--font-body, inherit)",
                textAlign: "center",
              }}
            >
              No matching city found
            </li>
          ) : (
            filteredCities.map((city, index) => {
              const isSelected = Boolean(value && city.toLowerCase() === value.toLowerCase());
              const isHighlighted = index === highlightedIndex;

              return (
                <li
                  key={city}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitCity(city);
                  }}
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontSize: "14.5px",
                    fontFamily: "var(--font-body, inherit)",
                    color: "var(--black, #111111)",
                    minHeight: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: isHighlighted
                      ? "var(--off-white, #F7F5F0)"
                      : isSelected
                      ? "#f1f5f9"
                      : "transparent",
                    fontWeight: isSelected ? 600 : 400,
                    transition: "background 0.1s ease",
                  }}
                >
                  <span>{city}</span>
                  {isSelected && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ color: "var(--black, #111111)", marginLeft: 8, flexShrink: 0 }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
