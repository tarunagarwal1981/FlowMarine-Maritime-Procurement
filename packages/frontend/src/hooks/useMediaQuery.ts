import { useState, useEffect } from 'react';

/**
 * Custom hook for responsive design using media queries
 * @param query - CSS media query string
 * @returns boolean indicating if the media query matches
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQuery.matches);

    // Create event listener
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
};

// Predefined breakpoint hooks for common use cases
export const useIsMobile = () => useMediaQuery('(max-width: 768px)');
export const useIsTablet = () => useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1025px)');
export const useIsSmallMobile = () => useMediaQuery('(max-width: 480px)');
export const useIsLandscape = () => useMediaQuery('(orientation: landscape)');
export const useIsPortrait = () => useMediaQuery('(orientation: portrait)');

// Touch device detection
export const useIsTouchDevice = () => {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore
        navigator.msMaxTouchPoints > 0
      );
    };

    checkTouch();
  }, []);

  return isTouch;
};

// Reduced motion preference
export const usePrefersReducedMotion = () => 
  useMediaQuery('(prefers-reduced-motion: reduce)');

// Dark mode preference
export const usePrefersDarkMode = () => 
  useMediaQuery('(prefers-color-scheme: dark)');

// High contrast preference
export const usePrefersHighContrast = () => 
  useMediaQuery('(prefers-contrast: high)');