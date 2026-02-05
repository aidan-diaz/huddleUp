import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getCurrentTimestamp, isPresenceStale } from './lib/utils';

/**
 * Create a new group chat with initial members
 */
export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    memberIds: v.array(v.id('users')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get current user
    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!currentUser) {
      throw new Error('User not found');
    }

    // Validate group name
    if (args.name.trim().length === 0) {
      throw new Error('Group name cannot be empty');
    }

    const now = getCurrentTimestamp();

    // Create the group
    const groupId = await ctx.db.insert('groups', {
      name: args.name.trim(),
      description: args.description?.trim(),
      creatorId: currentUser._id,
      createdAt: now,
    });

    // Add creator as admin
    await ctx.db.insert('groupMembers', {
      groupId,
      userId: currentUser._id,
      role: 'admin',
      joinedAt: now,
    });

    // Add other members
    const uniqueMemberIds = [...new Set(args.memberIds)].filter(
      (id) => id !== currentUser._id
    );

    for (const memberId of uniqueMemberIds) {
      // Verify member exists
      const member = await ctx.db.get(memberId);
      if (member) {
        await ctx.db.insert('groupMembers', {
          groupId,
          userId: memberId,
          role: 'member',
          joinedAt: now,
        });
      }
    }

    return groupId;
  },
});

/**
 * Add members to a group (admin only)
 */
export const addMembers = mutation({
  args: {
    groupId: v.id('groups'),
    memberIds: v.array(v.id('users')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get current user
    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!currentUser) {
      throw new Error('User not found');
    }

    // Verify group exists
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // Check if current user is admin
    const currentMembership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_and_user', (q) =>
        q.eq('groupId', args.groupId).eq('userId', currentUser._id)
      )
      .first();

    if (!currentMembership || currentMembership.role !== 'admin') {
      throw new Error('Only admins can add members');
    }

    const now = getCurrentTimestamp();
    const addedMembers: string[] = [];

    for (const memberId of args.memberIds) {
      // Check if already a member
      const existingMembership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_and_user', (q) =>
          q.eq('groupId', args.groupId).eq('userId', memberId)
        )
        .first();

      if (existingMembership) {
        continue; // Already a member
      }

      // Verify user exists
      const user = await ctx.db.get(memberId);
      if (!user) {
        continue; // User doesn't exist
      }

      await ctx.db.insert('groupMembers', {
        groupId: args.groupId,
        userId: memberId,
        role: 'member',
        joinedAt: now,
      });

      addedMembers.push(memberId);
    }

    return addedMembers;
  },
});

/**
 * Remove members from a group (admin only, or self-removal)
 */
export const removeMembers = mutation({
  args: {
    groupId: v.id('groups'),
    memberIds: v.array(v.id('users')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get current user
    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!currentUser) {
      throw new Error('User not found');
    }

    // Verify group exists
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // Check current user's membership
    const currentMembership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_and_user', (q) =>
        q.eq('groupId', args.groupId).eq('userId', currentUser._id)
      )
      .first();

    if (!currentMembership) {
      throw new Error('Not a member of this group');
    }

    const isAdmin = currentMembership.role === 'admin';
    const removedMembers: string[] = [];

    for (const memberId of args.memberIds) {
      // Users can remove themselves, admins can remove anyone
      if (memberId !== currentUser._id && !isAdmin) {
        continue; // Non-admins can only remove themselves
      }

      // Prevent removing the last admin
      if (memberId === currentUser._id && isAdmin) {
        const adminCount = await ctx.db
          .query('groupMembers')
          .withIndex('by_group', (q) => q.eq('groupId', args.groupId))
          .filter((q) => q.eq(q.field('role'), 'admin'))
          .collect();

        if (adminCount.length <= 1) {
          throw new Error(
            'Cannot remove the last admin. Transfer ownership first.'
          );
        }
      }

      const membership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_and_user', (q) =>
          q.eq('groupId', args.groupId).eq('userId', memberId)
        )
        .first();

      if (membership) {
        await ctx.db.delete(membership._id);
        removedMembers.push(memberId);
      }
    }

    return removedMembers;
  },
});

/**
 * Update group details (admin only)
 */
export const updateGroup = mutation({
  args: {
    groupId: v.id('groups'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get current user
    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!currentUser) {
      throw new Error('User not found');
    }

    // Verify group exists
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // Check if current user is admin
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_and_user', (q) =>
        q.eq('groupId', args.groupId).eq('userId', currentUser._id)
      )
      .first();

    if (!membership || membership.role !== 'admin') {
      throw new Error('Only admins can update group details');
    }

    // Build updates
    const updates: {
      name?: string;
      description?: string;
      avatarUrl?: string;
    } = {};

    if (args.name !== undefined) {
      if (args.name.trim().length === 0) {
        throw new Error('Group name cannot be empty');
      }
      updates.name = args.name.trim();
    }
    if (args.description !== undefined) {
      updates.description = args.description.trim();
    }
    if (args.avatarUrl !== undefined) {
      updates.avatarUrl = args.avatarUrl;
    }

    await ctx.db.patch(args.groupId, updates);
    return args.groupId;
  },
});

/**
 * Update member role (admin only)
 */
export const updateMemberRole = mutation({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
    role: v.union(v.literal('admin'), v.literal('member')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get current user
    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!currentUser) {
      throw new Error('User not found');
    }

    // Check if current user is admin
    const currentMembership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_and_user', (q) =>
        q.eq('groupId', args.groupId).eq('userId', currentUser._id)
      )
      .first();

    if (!currentMembership || currentMembership.role !== 'admin') {
      throw new Error('Only admins can change member roles');
    }

    // Get target membership
    const targetMembership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_and_user', (q) =>
        q.eq('groupId', args.groupId).eq('userId', args.userId)
      )
      .first();

    if (!targetMembership) {
      throw new Error('User is not a member of this group');
    }

    // Prevent demoting the last admin
    if (targetMembership.role === 'admin' && args.role === 'member') {
      const adminCount = await ctx.db
        .query('groupMembers')
        .withIndex('by_group', (q) => q.eq('groupId', args.groupId))
        .filter((q) => q.eq(q.field('role'), 'admin'))
        .collect();

      if (adminCount.length <= 1) {
        throw new Error('Cannot demote the last admin');
      }
    }

    await ctx.db.patch(targetMembership._id, { role: args.role });
    return targetMembership._id;
  },
});

/**
 * List all groups for the current user
 */
export const listGroups = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get current user
    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!currentUser) {
      return [];
    }

    // Get all memberships for current user
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_user', (q) => q.eq('userId', currentUser._id))
      .collect();

    // Get group details and last messages
    const groups = await Promise.all(
      memberships.map(async (membership) => {
        const group = await ctx.db.get(membership.groupId);
        if (!group) return null;

        // Get member count
        const members = await ctx.db
          .query('groupMembers')
          .withIndex('by_group', (q) => q.eq('groupId', membership.groupId))
          .collect();

        // Get last message
        const lastMessage = await ctx.db
          .query('messages')
          .withIndex('by_group', (q) => q.eq('groupId', membership.groupId))
          .order('desc')
          .first();

        return {
          _id: group._id,
          name: group.name,
          description: group.description,
          avatarUrl: group.avatarUrl,
          memberCount: members.length,
          myRole: membership.role,
          lastMessage: lastMessage
            ? {
                content: lastMessage.isDeleted
                  ? 'Message deleted'
                  : lastMessage.content,
                createdAt: lastMessage.createdAt,
                senderId: lastMessage.senderId,
                type: lastMessage.type,
              }
            : null,
          lastMessageAt: group.lastMessageAt,
          createdAt: group.createdAt,
        };
      })
    );

    // Filter nulls and sort by last message time
    return groups
      .filter((g) => g !== null)
      .sort((a, b) => {
        const aTime = a!.lastMessageAt ?? a!.createdAt;
        const bTime = b!.lastMessageAt ?? b!.createdAt;
        return bTime - aTime;
      });
  },
});

/**
 * Get a specific group with full details and members
 */
export const getGroup = query({
  args: {
    groupId: v.id('groups'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get current user
    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!currentUser) {
      throw new Error('User not found');
    }

    // Verify group exists
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // Check membership
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_and_user', (q) =>
        q.eq('groupId', args.groupId).eq('userId', currentUser._id)
      )
      .first();

    if (!membership) {
      throw new Error('Not a member of this group');
    }

    // Get all members with user details
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (q) => q.eq('groupId', args.groupId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        if (!user) return null;

        return {
          _id: m._id,
          userId: user._id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          presenceStatus: isPresenceStale(user.lastHeartbeat)
            ? 'offline'
            : user.presenceStatus,
          role: m.role,
          joinedAt: m.joinedAt,
        };
      })
    );

    return {
      _id: group._id,
      name: group.name,
      description: group.description,
      avatarUrl: group.avatarUrl,
      creatorId: group.creatorId,
      members: members.filter((m) => m !== null),
      myRole: membership.role,
      createdAt: group.createdAt,
    };
  },
});
