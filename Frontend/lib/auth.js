/**
 * Authentication utility functions
 * Handles token validation, expiration checks, and authentication state
 */

/**
 * Check if a JWT token is expired
 * @param {string} token - JWT token string
 * @returns {boolean} - True if token is expired or invalid
 */
export const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    // JWT tokens have 3 parts separated by dots: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]));
    
    // Check if token has expiration claim
    if (!payload.exp) return true;

    // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    // If we can't parse the token, consider it expired
    return true;
  }
};

/**
 * Check if user is authenticated
 * @returns {boolean} - True if user has a valid, non-expired token
 */
export const isAuthenticated = () => {
  if (typeof window === 'undefined') return false;
  
  const token = localStorage.getItem('access_token');
  if (!token) return false;

  // Check if token is expired
  if (isTokenExpired(token)) {
    // Clear expired token
    clearAuthData();
    return false;
  }

  return true;
};

/**
 * Get the stored access token
 * @returns {string|null} - Access token or null if not found
 */
export const getAccessToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
};

/**
 * Clear all authentication data
 */
export const clearAuthData = () => {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('access_token');
  localStorage.removeItem('session_token');
  localStorage.removeItem('user');
  localStorage.removeItem('user_info');
};

/**
 * Set authentication data (for OAuth callbacks)
 * @param {string} accessToken - JWT access token
 * @param {string} sessionToken - Session token
 * @param {object} user - User object
 */
export const setAuthData = (accessToken, sessionToken, user = null) => {
  if (typeof window === 'undefined') return;
  
  if (accessToken) {
    localStorage.setItem('access_token', accessToken);
  }
  if (sessionToken) {
    localStorage.setItem('session_token', sessionToken);
  }
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
};

/**
 * Get the current user from localStorage
 * @returns {object|null} - User object or null if not found
 */
export const getCurrentUser = () => {
  if (typeof window === 'undefined') return null;
  
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch (error) {
    return null;
  }
};

/**
 * Check if current route requires authentication
 * @param {string} pathname - Current route pathname
 * @returns {boolean} - True if route requires authentication
 */
export const requiresAuth = (pathname) => {
  // Routes that don't require authentication
  const publicRoutes = ['/auth', '/api'];
  
  // Check if pathname starts with any public route
  return !publicRoutes.some(route => pathname.startsWith(route));
};

