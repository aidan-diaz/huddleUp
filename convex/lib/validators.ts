import { v } from 'convex/values';

// Presence status validator
export const presenceStatusValidator = v.union(
  v.literal('active'),
  v.literal('away'),
  v.literal('busy'),
  v.literal('inCall'),
  v.literal('offline')
);

// Message type validator
export const messageTypeValidator = v.union(
  v.literal('text'),
  v.literal('file'),
  v.literal('system'),
  v.literal('call')
);

// Call type validator
export const callTypeValidator = v.union(v.literal('audio'), v.literal('video'));

// Call status validator
export const callStatusValidator = v.union(
  v.literal('ringing'),
  v.literal('active'),
  v.literal('ended'),
  v.literal('missed')
);

// Group role validator
export const groupRoleValidator = v.union(
  v.literal('admin'),
  v.literal('member')
);

// Meeting request status validator
export const meetingRequestStatusValidator = v.union(
  v.literal('pending'),
  v.literal('approved'),
  v.literal('denied')
);

// Notification type validator
export const notificationTypeValidator = v.union(
  v.literal('message'),
  v.literal('call'),
  v.literal('meeting_request'),
  v.literal('meeting_response'),
  v.literal('group_invite')
);

// Pagination validator
export const paginationValidator = {
  cursor: v.optional(v.string()),
  limit: v.optional(v.number()),
};

// ==========================================
// Phase 8: Security Validators
// ==========================================

/**
 * Maximum lengths for various fields
 */
export const MAX_LENGTHS = {
  MESSAGE_CONTENT: 10000,
  GROUP_NAME: 100,
  GROUP_DESCRIPTION: 500,
  USER_NAME: 100,
  FILE_NAME: 255,
  NOTIFICATION_TITLE: 200,
  NOTIFICATION_BODY: 1000,
  EVENT_TITLE: 200,
  EVENT_DESCRIPTION: 2000,
} as const;

/**
 * Validator for message content with length limit
 */
export const messageContentValidator = v.string();

/**
 * Validator for group name with length limit
 */
export const groupNameValidator = v.string();

/**
 * Validator for user name with length limit
 */
export const userNameValidator = v.optional(v.string());

/**
 * Validator for email address
 */
export const emailValidator = v.string();

/**
 * Validator for file size (max 20MB)
 */
export const fileSizeValidator = v.number();

/**
 * Validator for positive number
 */
export const positiveNumberValidator = v.number();

/**
 * Validator for timestamp (must be positive number)
 */
export const timestampValidator = v.number();

// ==========================================
// Validation Helper Functions
// ==========================================

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  maxLength: number,
  fieldName: string
): void {
  if (value.length > maxLength) {
    throw new Error(
      `${fieldName} exceeds maximum length of ${maxLength} characters`
    );
  }
}

/**
 * Validate message content
 */
export function validateMessageContent(content: string): void {
  validateStringLength(content, MAX_LENGTHS.MESSAGE_CONTENT, 'Message content');
  
  if (content.trim().length === 0) {
    throw new Error('Message content cannot be empty');
  }
}

/**
 * Validate group name
 */
export function validateGroupName(name: string): void {
  validateStringLength(name, MAX_LENGTHS.GROUP_NAME, 'Group name');
  
  if (name.trim().length === 0) {
    throw new Error('Group name cannot be empty');
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
  if (email.length > 254) {
    throw new Error('Email address is too long');
  }
}

/**
 * Validate timestamp is reasonable (not in far future or past)
 */
export function validateTimestamp(timestamp: number): void {
  const now = Date.now();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  
  if (timestamp < now - oneYearMs || timestamp > now + oneYearMs) {
    throw new Error('Timestamp is out of valid range');
  }
}

/**
 * Sanitize string for storage (basic XSS prevention)
 * Note: This is a basic sanitization. For display, use client-side sanitization.
 */
export function sanitizeString(input: string): string {
  // Remove null bytes and other control characters
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}
