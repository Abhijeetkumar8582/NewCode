/**
 * Cookie-based storage utility for persisting data across page refreshes
 * Uses cookies instead of localStorage for better server-side compatibility
 */

const COOKIE_PREFIX = 'epiplex_';

/**
 * Set a cookie
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {number} days - Days until expiration (default: 7 days)
 */
export const setCookie = (name, value, days = 7) => {
  if (typeof document === 'undefined') return;
  
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  
  const cookieName = `${COOKIE_PREFIX}${name}`;
  document.cookie = `${cookieName}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};

/**
 * Get a cookie value
 * @param {string} name - Cookie name
 * @returns {string|null} - Cookie value or null if not found
 */
export const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  
  const cookieName = `${COOKIE_PREFIX}${name}`;
  const nameEQ = cookieName + '=';
  const cookies = document.cookie.split(';');
  
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i];
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1, cookie.length);
    }
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length, cookie.length));
    }
  }
  return null;
};

/**
 * Remove a cookie
 * @param {string} name - Cookie name
 */
export const removeCookie = (name) => {
  if (typeof document === 'undefined') return;
  
  const cookieName = `${COOKIE_PREFIX}${name}`;
  document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
};

/**
 * Store JSON data in cookie
 * @param {string} name - Cookie name
 * @param {any} data - Data to store (will be JSON stringified)
 * @param {number} days - Days until expiration
 */
export const setCookieData = (name, data, days = 7) => {
  try {
    const jsonString = JSON.stringify(data);
    setCookie(name, jsonString, days);
  } catch (error) {
    console.error(`Failed to store cookie data for ${name}:`, error);
  }
};

/**
 * Get JSON data from cookie
 * @param {string} name - Cookie name
 * @returns {any|null} - Parsed data or null if not found/invalid
 */
export const getCookieData = (name) => {
  try {
    const cookieValue = getCookie(name);
    if (!cookieValue) return null;
    return JSON.parse(cookieValue);
  } catch (error) {
    console.error(`Failed to parse cookie data for ${name}:`, error);
    return null;
  }
};

/**
 * Check if cookie exists
 * @param {string} name - Cookie name
 * @returns {boolean} - True if cookie exists
 */
export const hasCookie = (name) => {
  return getCookie(name) !== null;
};
