/**
 * Error handling utilities for Convex and application errors
 */

/**
 * Standard error types for the application
 */
export const ErrorType = {
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  NETWORK: 'NETWORK',
  SERVER: 'SERVER',
  RATE_LIMIT: 'RATE_LIMIT',
  UNKNOWN: 'UNKNOWN',
};

/**
 * User-friendly error messages for common error types
 */
const ERROR_MESSAGES = {
  [ErrorType.AUTHENTICATION]: 'Please sign in to continue.',
  [ErrorType.AUTHORIZATION]: 'You do not have permission to perform this action.',
  [ErrorType.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorType.VALIDATION]: 'Please check your input and try again.',
  [ErrorType.NETWORK]: 'Unable to connect. Please check your internet connection.',
  [ErrorType.SERVER]: 'Something went wrong on our end. Please try again later.',
  [ErrorType.RATE_LIMIT]: 'Too many requests. Please wait a moment and try again.',
  [ErrorType.UNKNOWN]: 'An unexpected error occurred. Please try again.',
};

/**
 * Parse a Convex error and extract useful information
 * @param {Error} error - The error from Convex
 * @returns {Object} Parsed error with type, message, and details
 */
export function parseConvexError(error) {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  
  // Determine error type based on message patterns
  let type = ErrorType.UNKNOWN;
  let userMessage = ERROR_MESSAGES[ErrorType.UNKNOWN];

  if (errorMessage.includes('Not authenticated') || errorMessage.includes('Unauthorized')) {
    type = ErrorType.AUTHENTICATION;
    userMessage = ERROR_MESSAGES[ErrorType.AUTHENTICATION];
  } else if (errorMessage.includes('Not authorized') || errorMessage.includes('permission')) {
    type = ErrorType.AUTHORIZATION;
    userMessage = ERROR_MESSAGES[ErrorType.AUTHORIZATION];
  } else if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
    type = ErrorType.NOT_FOUND;
    userMessage = ERROR_MESSAGES[ErrorType.NOT_FOUND];
  } else if (errorMessage.includes('validation') || errorMessage.includes('invalid') || 
             errorMessage.includes('required') || errorMessage.includes('cannot be empty')) {
    type = ErrorType.VALIDATION;
    userMessage = errorMessage; // Use the specific validation error
  } else if (errorMessage.includes('network') || errorMessage.includes('fetch') ||
             errorMessage.includes('Failed to fetch')) {
    type = ErrorType.NETWORK;
    userMessage = ERROR_MESSAGES[ErrorType.NETWORK];
  } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
    type = ErrorType.RATE_LIMIT;
    userMessage = ERROR_MESSAGES[ErrorType.RATE_LIMIT];
  } else if (errorMessage.includes('server') || errorMessage.includes('internal')) {
    type = ErrorType.SERVER;
    userMessage = ERROR_MESSAGES[ErrorType.SERVER];
  }

  return {
    type,
    message: userMessage,
    originalMessage: errorMessage,
    isRetryable: isRetryableError(type),
  };
}

/**
 * Check if an error type is retryable
 * @param {string} errorType - The error type
 * @returns {boolean} Whether the error is retryable
 */
export function isRetryableError(errorType) {
  const retryableTypes = [
    ErrorType.NETWORK,
    ErrorType.SERVER,
    ErrorType.RATE_LIMIT,
  ];
  return retryableTypes.includes(errorType);
}

/**
 * Create a retry function with exponential backoff
 * @param {Function} fn - The async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} The result of the function
 */
export async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry = null,
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const parsedError = parseConvexError(error);

      // Don't retry non-retryable errors
      if (!parsedError.isRetryable) {
        throw error;
      }

      // Don't wait after the last attempt
      if (attempt < maxAttempts) {
        if (onRetry) {
          onRetry(attempt, delay, error);
        }
        
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Resolves after the duration
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Log error to monitoring service (placeholder)
 * In production, integrate with Sentry or similar
 * @param {Error} error - The error to log
 * @param {Object} context - Additional context
 */
export function logError(error, context = {}) {
  const parsedError = parseConvexError(error);
  
  // In production, send to Sentry or similar service
  console.error('[Error]', {
    ...parsedError,
    context,
    timestamp: new Date().toISOString(),
    stack: error?.stack,
  });

  // Placeholder for Sentry integration:
  // if (typeof Sentry !== 'undefined') {
  //   Sentry.captureException(error, { extra: context });
  // }
}

/**
 * Create a standardized error response object
 * @param {string} type - Error type
 * @param {string} message - Error message
 * @param {Object} details - Additional details
 * @returns {Object} Error response object
 */
export function createErrorResponse(type, message, details = {}) {
  return {
    success: false,
    error: {
      type,
      message,
      ...details,
    },
    timestamp: Date.now(),
  };
}

/**
 * Handle mutation errors with consistent error handling
 * @param {Function} mutationFn - The mutation function to call
 * @param {Object} args - Arguments to pass to the mutation
 * @param {Object} options - Options for error handling
 * @returns {Promise} The result or throws a parsed error
 */
export async function handleMutation(mutationFn, args, options = {}) {
  const { 
    onSuccess = null, 
    onError = null,
    retry = false,
  } = options;

  try {
    const wrappedFn = () => mutationFn(args);
    const result = retry 
      ? await withRetry(wrappedFn) 
      : await wrappedFn();
    
    if (onSuccess) {
      onSuccess(result);
    }
    
    return result;
  } catch (error) {
    const parsedError = parseConvexError(error);
    
    if (onError) {
      onError(parsedError);
    }
    
    throw parsedError;
  }
}

export default {
  ErrorType,
  parseConvexError,
  isRetryableError,
  withRetry,
  logError,
  createErrorResponse,
  handleMutation,
};
