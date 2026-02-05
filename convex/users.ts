import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { presenceStatusValidator } from './lib/validators';
import {
  getCurrentTimestamp,
  PRESENCE_TIMEOUT,
  isPresenceStale,
} from './lib/utils';

/**
 * Create or update a user profile on signup/login
 */
export const createOrUpdateUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Check if user already exists by email
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    const now = getCurrentTimestamp();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        name: args.name ?? existingUser.name,
        avatarUrl: args.avatarUrl ?? existingUser.avatarUrl,
        lastHeartbeat: now,
        presenceStatus: 'active',
      });
      return existingUser._id;
    }

    // Create new user
    const userId = await ctx.db.insert('users', {
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      presenceStatus: 'active',
      lastHeartbeat: now,
      createdAt: now,
    });

    return userId;
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
    const userId = await getAuthUserId(ctx);
    
    if (!userId) {
      return null;
    }

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
    if (!userId) {
      throw new Error('Not authenticated');
    }

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
