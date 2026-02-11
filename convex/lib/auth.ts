import { QueryCtx, MutationCtx } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { getCurrentTimestamp } from './utils';

/**
 * Get the current user's Convex userId from Clerk identity.
 * Looks up user by clerkId (Clerk's subject claim).
 * Throws if not authenticated or user profile not found.
 */
export async function getAuthUserId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<'users'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Not authenticated');
  }

  const clerkId = identity.subject;
  if (!clerkId) {
    throw new Error('Invalid authentication token');
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
    .first();

  if (!user) {
    throw new Error('User profile not found. Please refresh the page.');
  }

  return user._id;
}

/**
 * Get current user ID or null if not authenticated or user not found.
 * Use for queries that need to handle unauthenticated state.
 */
export async function getAuthUserIdOrNull(
  ctx: QueryCtx | MutationCtx
): Promise<Id<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    return null;
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .first();

  return user?._id ?? null;
}

/**
 * Ensure user exists in our database, creating from Clerk identity if needed.
 * Call this on first app load after Clerk sign-in.
 */
export async function ensureUser(ctx: MutationCtx): Promise<Id<'users'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Not authenticated');
  }

  const clerkId = identity.subject;
  if (!clerkId) {
    throw new Error('Invalid authentication token');
  }

  const existing = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
    .first();

  if (existing) {
    return existing._id;
  }

  const now = getCurrentTimestamp();
  const userId = await ctx.db.insert('users', {
    clerkId,
    email: identity.email ?? '',
    name: identity.name ?? undefined,
    avatarUrl: identity.picture ?? undefined,
    presenceStatus: 'offline',
    lastHeartbeat: now,
    createdAt: now,
  });

  return userId;
}
