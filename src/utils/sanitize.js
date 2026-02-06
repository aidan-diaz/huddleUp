/**
 * Sanitization utilities for XSS prevention and input validation
 */

/**
 * HTML entities to escape
 */
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML entities in a string to prevent XSS attacks
 * @param {string} str - The string to sanitize
 * @returns {string} The sanitized string with HTML entities escaped
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize text content for safe display
 * Escapes HTML while preserving newlines
 * @param {string} text - The text to sanitize
 * @returns {string} Sanitized text safe for display
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') {
    return '';
  }
  return escapeHtml(text);
}

/**
 * Sanitize user input before sending to the server
 * Trims whitespace and removes control characters
 * @param {string} input - The input to sanitize
 * @returns {string} Sanitized input
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  // Remove control characters (except newlines and tabs)
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Validate and sanitize a URL
 * Only allows http, https, and mailto protocols
 * @param {string} url - The URL to validate
 * @returns {string|null} The sanitized URL or null if invalid
 */
export function sanitizeUrl(url) {
  if (typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:', 'mailto:'];
    
    if (!allowedProtocols.includes(parsed.protocol)) {
      return null;
    }
    
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Sanitize a filename for safe storage
 * Removes path traversal characters and special chars
 * @param {string} filename - The filename to sanitize
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(filename) {
  if (typeof filename !== 'string') {
    return 'unnamed';
  }

  // Remove path separators and null bytes
  let sanitized = filename.replace(/[/\\:\x00]/g, '');
  
  // Remove leading dots to prevent hidden files
  sanitized = sanitized.replace(/^\.+/, '');
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.slice(sanitized.lastIndexOf('.'));
    const name = sanitized.slice(0, 255 - ext.length);
    sanitized = name + ext;
  }
  
  return sanitized || 'unnamed';
}

/**
 * Validate email format
 * @param {string} email - The email to validate
 * @returns {boolean} True if valid email format
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }
  // Basic email regex - not comprehensive but good enough for most cases
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Truncate text with ellipsis
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
  if (typeof text !== 'string') {
    return '';
  }
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Strip HTML tags from a string
 * @param {string} html - String potentially containing HTML
 * @returns {string} Plain text without HTML tags
 */
export function stripHtml(html) {
  if (typeof html !== 'string') {
    return '';
  }
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Normalize whitespace in a string
 * Replaces multiple spaces/tabs with single space
 * @param {string} str - The string to normalize
 * @returns {string} Normalized string
 */
export function normalizeWhitespace(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.replace(/[ \t]+/g, ' ').trim();
}

export default {
  escapeHtml,
  sanitizeText,
  sanitizeInput,
  sanitizeUrl,
  sanitizeFilename,
  isValidEmail,
  truncateText,
  stripHtml,
  normalizeWhitespace,
};
