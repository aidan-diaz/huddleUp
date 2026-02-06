import { QueryCtx, MutationCtx } from '../_generated/server';

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

// ==========================================
// Phase 8: Security Helpers
// ==========================================

/**
 * Get current user from database by email
 * Throws error if not authenticated or user not found
 */
export async function getCurrentUserOrThrow(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Not authenticated');
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_email', (q) => q.eq('email', identity.email!))
    .first();

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

/**
 * Verify user is a participant in a conversation
 */
export async function verifyConversationAccess(
  ctx: QueryCtx | MutationCtx,
  conversationId: string,
  userId: string
): Promise<void> {
  const conversation = await ctx.db.get(conversationId as any);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (
    conversation.participant1Id !== userId &&
    conversation.participant2Id !== userId
  ) {
    throw new Error('Not authorized to access this conversation');
  }
}

/**
 * Verify user is a member of a group and optionally check role
 */
export async function verifyGroupAccess(
  ctx: QueryCtx | MutationCtx,
  groupId: string,
  userId: string,
  requiredRole?: 'admin' | 'member'
): Promise<{ role: 'admin' | 'member' }> {
  const membership = await ctx.db
    .query('groupMembers')
    .withIndex('by_group_and_user', (q) =>
      q.eq('groupId', groupId as any).eq('userId', userId as any)
    )
    .first();

  if (!membership) {
    throw new Error('Not a member of this group');
  }

  if (requiredRole === 'admin' && membership.role !== 'admin') {
    throw new Error('Admin privileges required');
  }

  return { role: membership.role };
}

/**
 * Check if a string contains potential XSS patterns
 * Note: This is a basic check. Client-side sanitization is still needed.
 */
export function containsSuspiciousContent(content: string): boolean {
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /on\w+\s*=/i, // onclick=, onerror=, etc.
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<form/i,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(content));
}

/**
 * Log suspicious activity for monitoring
 * In production, this would send to a monitoring service
 */
export function logSuspiciousActivity(
  action: string,
  userId: string,
  details: Record<string, unknown>
): void {
  console.warn('[Security Alert]', {
    action,
    userId,
    details,
    timestamp: new Date().toISOString(),
  });
}
