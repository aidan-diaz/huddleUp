import { QueryCtx } from '../_generated/server';

/**
 * Get the current authenticated user or throw an error
 * @param ctx - The query context from a Convex function
 */
export async function getAuthenticatedUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Not authenticated');
  }
  return identity;
}

/**
 * Get current timestamp in milliseconds
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}

/**
 * Default pagination limit
 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Maximum pagination limit
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Validate and normalize pagination limit
 */
export function normalizePaginationLimit(limit?: number): number {
  if (!limit || limit <= 0) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(limit, MAX_PAGE_SIZE);
}

/**
 * Allowed file MIME types for uploads
 */
export const ALLOWED_FILE_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  // Archives
  'application/zip',
];

/**
 * Maximum file size in bytes (20MB)
 */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

/**
 * Validate file type
 */
export function isAllowedFileType(mimeType: string): boolean {
  return ALLOWED_FILE_TYPES.includes(mimeType);
}

/**
 * Validate file size
 */
export function isAllowedFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

/**
 * Presence heartbeat timeout in milliseconds (60 seconds)
 */
export const PRESENCE_TIMEOUT = 60 * 1000;

/**
 * Check if user presence is stale
 */
export function isPresenceStale(lastHeartbeat: number): boolean {
  return Date.now() - lastHeartbeat > PRESENCE_TIMEOUT;
}
