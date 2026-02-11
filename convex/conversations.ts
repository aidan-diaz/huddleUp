import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId } from './lib/auth';
import { getCurrentTimestamp, isPresenceStale } from './lib/utils';

/**
 * Get or create a direct conversation between two users
 */
export const getOrCreateConversation = mutation({
  args: {
    otherUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error('Not authenticated');
    }

    // Get current user
    const currentUser = await ctx.db.get(userId);

    if (!currentUser) {
      throw new Error('User not found');
    }

    // Verify other user exists
    const otherUser = await ctx.db.get(args.otherUserId);
    if (!otherUser) {
      throw new Error('Other user not found');
    }

    // Ensure consistent ordering for lookups (smaller ID first)
    const [participant1Id, participant2Id] =
      currentUser._id < args.otherUserId
        ? [currentUser._id, args.otherUserId]
        : [args.otherUserId, currentUser._id];

    // Check if conversation already exists
    const existingConversation = await ctx.db
      .query('directConversations')
      .withIndex('by_participants', (q) =>
        q.eq('participant1Id', participant1Id).eq('participant2Id', participant2Id)
      )
      .first();

    if (existingConversation) {
      return existingConversation._id;
    }

    // Create new conversation
    const conversationId = await ctx.db.insert('directConversations', {
      participant1Id,
      participant2Id,
      createdAt: getCurrentTimestamp(),
    });

    return conversationId;
  },
});

/**
 * List all direct conversations for the current user with last message preview
 */
export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get current user
    const currentUser = await ctx.db.get(userId);

    if (!currentUser) {
      return [];
    }

    // Get conversations where user is participant1
    const conversationsAsP1 = await ctx.db
      .query('directConversations')
      .withIndex('by_participant1', (q) =>
        q.eq('participant1Id', currentUser._id)
      )
      .collect();

    // Get conversations where user is participant2
    const conversationsAsP2 = await ctx.db
      .query('directConversations')
      .withIndex('by_participant2', (q) =>
        q.eq('participant2Id', currentUser._id)
      )
      .collect();

    // Combine and deduplicate
    const allConversations = [...conversationsAsP1, ...conversationsAsP2];

    // Enrich with other user info and last message
    const enrichedConversations = await Promise.all(
      allConversations.map(async (conv) => {
        // Get the other participant
        const otherUserId =
          conv.participant1Id === currentUser._id
            ? conv.participant2Id
            : conv.participant1Id;
        const otherUser = await ctx.db.get(otherUserId);

        // Get last message
        const lastMessage = await ctx.db
          .query('messages')
          .withIndex('by_conversation', (q) => q.eq('conversationId', conv._id))
          .order('desc')
          .first();

        return {
          _id: conv._id,
          otherUser: otherUser
            ? {
                _id: otherUser._id,
                name: otherUser.name,
                email: otherUser.email,
                avatarUrl: otherUser.avatarUrl,
                presenceStatus: isPresenceStale(otherUser.lastHeartbeat)
                  ? 'offline'
                  : otherUser.presenceStatus,
              }
            : null,
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
          lastMessageAt: conv.lastMessageAt,
          createdAt: conv.createdAt,
        };
      })
    );

    // Sort by last message time (most recent first)
    return enrichedConversations.sort((a, b) => {
      const aTime = a.lastMessageAt ?? a.createdAt;
      const bTime = b.lastMessageAt ?? b.createdAt;
      return bTime - aTime;
    });
  },
});

/**
 * Get a specific conversation by ID with full details
 */
export const getConversation = query({
  args: {
    conversationId: v.id('directConversations'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error('Not authenticated');
    }

    // Get current user
    const currentUser = await ctx.db.get(userId);

    if (!currentUser) {
      throw new Error('User not found');
    }

    // Get conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Verify user is a participant
    if (
      conversation.participant1Id !== currentUser._id &&
      conversation.participant2Id !== currentUser._id
    ) {
      throw new Error('Not authorized to view this conversation');
    }

    // Get the other participant
    const otherUserId =
      conversation.participant1Id === currentUser._id
        ? conversation.participant2Id
        : conversation.participant1Id;
    const otherUser = await ctx.db.get(otherUserId);

    return {
      _id: conversation._id,
      otherUser: otherUser
        ? {
            _id: otherUser._id,
            name: otherUser.name,
            email: otherUser.email,
            avatarUrl: otherUser.avatarUrl,
            presenceStatus: isPresenceStale(otherUser.lastHeartbeat)
              ? 'offline'
              : otherUser.presenceStatus,
          }
        : null,
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt,
    };
  },
});
