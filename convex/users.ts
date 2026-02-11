import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId, getAuthUserIdOrNull, ensureUser } from './lib/auth';
import { presenceStatusValidator } from './lib/validators';
import {
  getCurrentTimestamp,
  isPresenceStale,
} from './lib/utils';

/**
 * Ensure user profile exists (create from Clerk identity on first login).
 * Call this when the app loads after Clerk sign-in.
 */
export const ensureUserExists = mutation({
  args: {},
  handler: async (ctx) => {
    return ensureUser(ctx);
  },
});

/**
 * Update user's presence status
 */
export const updatePresenceStatus = mutation({
  args: {
    status: presenceStatusValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error('Not authenticated');
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await ctx.db.patch(userId, {
      presenceStatus: args.status,
      lastHeartbeat: getCurrentTimestamp(),
    });

    return userId;
  },
});

/**
 * Send heartbeat to keep user presence active
 */
export const sendHeartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error('Not authenticated');
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const now = getCurrentTimestamp();
    const updates: { 
      lastHeartbeat: number; 
      presenceStatus?: 'active' | 'away' | 'busy' | 'inCall' | 'offline';
    } = {
      lastHeartbeat: now,
    };

    // If user was offline, set them to active
    if (user.presenceStatus === 'offline') {
      updates.presenceStatus = 'active';
    }

    await ctx.db.patch(userId, updates);
    return userId;
  },
});

/**
 * Get user by ID
 */
export const getUser = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    // Check if presence is stale and update status accordingly
    const effectiveStatus = isPresenceStale(user.lastHeartbeat)
      ? 'offline'
      : user.presenceStatus;

    return {
      ...user,
      presenceStatus: effectiveStatus,
    };
  },
});

/**
 * Get current authenticated user
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserIdOrNull(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    return user;
  },
});

/**
 * Search users by name or email for starting conversations
 */
export const searchUsers = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error('Not authenticated');
    }

    const limit = args.limit ?? 10;
    const searchLower = args.searchTerm.toLowerCase();

    // Get all users (in production, use a search index)
    const allUsers = await ctx.db.query('users').collect();

    // Filter users matching search term (excluding current user)
    const matchingUsers = allUsers
      .filter((user) => {
        if (user._id === userId) return false;
        const nameMatch = user.name?.toLowerCase().includes(searchLower);
        const emailMatch = user.email.toLowerCase().includes(searchLower);
        return nameMatch || emailMatch;
      })
      .slice(0, limit);

    // Add effective presence status
    return matchingUsers.map((user) => ({
      ...user,
      presenceStatus: isPresenceStale(user.lastHeartbeat)
        ? 'offline'
        : user.presenceStatus,
    }));
  },
});

/**
 * Update user profile
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updates: { name?: string; avatarUrl?: string } = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;

    await ctx.db.patch(userId, updates);
    return userId;
  },
});
