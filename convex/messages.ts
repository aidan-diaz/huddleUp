import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { paginationOptsValidator } from 'convex/server';
import { getAuthUserId } from './lib/auth';
import { internal } from './_generated/api';
import { getCurrentTimestamp } from './lib/utils';
import { messageTypeValidator } from './lib/validators';

/**
 * Send a message to a direct conversation or group
 */
export const sendMessage = mutation({
  args: {
    content: v.string(),
    conversationId: v.optional(v.id('directConversations')),
    groupId: v.optional(v.id('groups')),
    type: v.optional(messageTypeValidator),
    // File attachment fields
    fileId: v.optional(v.id('_storage')),
    fileName: v.optional(v.string()),
    fileType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
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

    // Validate that exactly one target is specified
    if (!args.conversationId && !args.groupId) {
      throw new Error('Must specify either conversationId or groupId');
    }
    if (args.conversationId && args.groupId) {
      throw new Error('Cannot specify both conversationId and groupId');
    }

    const now = getCurrentTimestamp();
    const messageType = args.type ?? 'text';

    // Validate content for text messages
    if (messageType === 'text' && args.content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }

    // Verify access to conversation or group
    if (args.conversationId) {
      const conversation = await ctx.db.get(args.conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Verify user is a participant
      if (
        conversation.participant1Id !== currentUser._id &&
        conversation.participant2Id !== currentUser._id
      ) {
        throw new Error('Not authorized to send messages in this conversation');
      }

      // Create message
      const messageId = await ctx.db.insert('messages', {
        senderId: currentUser._id,
        content: args.content,
        conversationId: args.conversationId,
        type: messageType,
        fileId: args.fileId,
        fileName: args.fileName,
        fileType: args.fileType,
        fileSize: args.fileSize,
        isDeleted: false,
        createdAt: now,
      });

      // Update conversation's last message time
      await ctx.db.patch(args.conversationId, {
        lastMessageAt: now,
      });

      // Notify the other participant (in-app + push)
      const recipientId =
        conversation.participant1Id === currentUser._id
          ? conversation.participant2Id
          : conversation.participant1Id;
      const senderName = currentUser.name ?? currentUser.email ?? 'Someone';
      const messagePreview =
        messageType === 'file'
          ? (args.fileName ?? 'Sent a file')
          : args.content;
      const pushTitle = `New message from ${senderName}`;
      const pushUrl = `/conversation/${args.conversationId}`;

      await ctx.scheduler.runAfter(0, internal.notifications.notifyNewMessage, {
        recipientId,
        senderName,
        messagePreview,
        conversationId: args.conversationId,
      });
      await ctx.scheduler.runAfter(0, internal.push.sendPushNotification, {
        userId: recipientId,
        title: pushTitle,
        body: messagePreview.length > 100 ? messagePreview.slice(0, 97) + '...' : messagePreview,
        url: pushUrl,
      });

      return messageId;
    }

    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      if (!group) {
        throw new Error('Group not found');
      }

      // Verify user is a member
      const membership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_and_user', (q) =>
          q.eq('groupId', args.groupId!).eq('userId', currentUser._id)
        )
        .first();

      if (!membership) {
        throw new Error('Not a member of this group');
      }

      // Create message
      const messageId = await ctx.db.insert('messages', {
        senderId: currentUser._id,
        content: args.content,
        groupId: args.groupId,
        type: messageType,
        fileId: args.fileId,
        fileName: args.fileName,
        fileType: args.fileType,
        fileSize: args.fileSize,
        isDeleted: false,
        createdAt: now,
      });

      // Update group's last message time
      await ctx.db.patch(args.groupId, {
        lastMessageAt: now,
      });

      // Notify all other group members (in-app + push)
      const members = await ctx.db
        .query('groupMembers')
        .withIndex('by_group', (q) => q.eq('groupId', args.groupId!))
        .collect();
      const senderName = currentUser.name ?? currentUser.email ?? 'Someone';
      const messagePreview =
        messageType === 'file'
          ? (args.fileName ?? 'Sent a file')
          : args.content;
      const pushTitle = `New message in ${group.name}`;
      const pushUrl = `/group/${args.groupId}`;
      const pushBody =
        messagePreview.length > 100
          ? messagePreview.slice(0, 97) + '...'
          : messagePreview;

      for (const member of members) {
        if (member.userId === currentUser._id) continue;
        await ctx.scheduler.runAfter(0, internal.notifications.notifyNewMessage, {
          recipientId: member.userId,
          senderName,
          messagePreview,
          groupId: args.groupId,
          groupName: group.name,
        });
        await ctx.scheduler.runAfter(0, internal.push.sendPushNotification, {
          userId: member.userId,
          title: pushTitle,
          body: pushBody,
          url: pushUrl,
        });
      }

      return messageId;
    }

    throw new Error('Invalid message target');
  },
});

/**
 * List messages for a conversation or group with pagination
 */
export const listMessages = query({
  args: {
    conversationId: v.optional(v.id('directConversations')),
    groupId: v.optional(v.id('groups')),
    paginationOpts: paginationOptsValidator,
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

    // Validate target
    if (!args.conversationId && !args.groupId) {
      throw new Error('Must specify either conversationId or groupId');
    }

    if (args.conversationId) {
      const conversation = await ctx.db.get(args.conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Verify access
      if (
        conversation.participant1Id !== currentUser._id &&
        conversation.participant2Id !== currentUser._id
      ) {
        throw new Error('Not authorized to view this conversation');
      }

      // Get messages
      const messages = await ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) =>
          q.eq('conversationId', args.conversationId)
        )
        .order('desc')
        .paginate(args.paginationOpts);

      // Enrich with sender info
      const enrichedMessages = await Promise.all(
        messages.page.map(async (msg) => {
          const sender = await ctx.db.get(msg.senderId);
          return {
            ...msg,
            sender: sender
              ? {
                  _id: sender._id,
                  name: sender.name,
                  email: sender.email,
                  avatarUrl: sender.avatarUrl,
                }
              : null,
          };
        })
      );

      return {
        ...messages,
        page: enrichedMessages,
      };
    }

    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      if (!group) {
        throw new Error('Group not found');
      }

      // Verify membership
      const membership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_and_user', (q) =>
          q.eq('groupId', args.groupId!).eq('userId', currentUser._id)
        )
        .first();

      if (!membership) {
        throw new Error('Not a member of this group');
      }

      // Get messages
      const messages = await ctx.db
        .query('messages')
        .withIndex('by_group', (q) => q.eq('groupId', args.groupId))
        .order('desc')
        .paginate(args.paginationOpts);

      // Enrich with sender info
      const enrichedMessages = await Promise.all(
        messages.page.map(async (msg) => {
          const sender = await ctx.db.get(msg.senderId);
          return {
            ...msg,
            sender: sender
              ? {
                  _id: sender._id,
                  name: sender.name,
                  email: sender.email,
                  avatarUrl: sender.avatarUrl,
                }
              : null,
          };
        })
      );

      return {
        ...messages,
        page: enrichedMessages,
      };
    }

    throw new Error('Invalid target');
  },
});

/**
 * Pin or unpin a message
 */
export const pinMessage = mutation({
  args: {
    messageId: v.id('messages'),
    pin: v.boolean(),
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

    // Get the message
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    if (message.isDeleted) {
      throw new Error('Cannot pin a deleted message');
    }

    // Verify access
    if (message.conversationId) {
      const conversation = await ctx.db.get(message.conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (
        conversation.participant1Id !== currentUser._id &&
        conversation.participant2Id !== currentUser._id
      ) {
        throw new Error('Not authorized');
      }
    } else if (message.groupId) {
      const membership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_and_user', (q) =>
          q.eq('groupId', message.groupId!).eq('userId', currentUser._id)
        )
        .first();

      if (!membership) {
        throw new Error('Not authorized');
      }
    }

    // Check if already pinned
    const existingPin = await ctx.db
      .query('pinnedMessages')
      .withIndex('by_message', (q) => q.eq('messageId', args.messageId))
      .first();

    if (args.pin) {
      // Pin the message
      if (existingPin) {
        return existingPin._id; // Already pinned
      }

      return await ctx.db.insert('pinnedMessages', {
        messageId: args.messageId,
        conversationId: message.conversationId,
        groupId: message.groupId,
        pinnedBy: currentUser._id,
        pinnedAt: getCurrentTimestamp(),
      });
    } else {
      // Unpin the message
      if (existingPin) {
        await ctx.db.delete(existingPin._id);
      }
      return null;
    }
  },
});

/**
 * Get pinned messages for a conversation or group
 */
export const getPinnedMessages = query({
  args: {
    conversationId: v.optional(v.id('directConversations')),
    groupId: v.optional(v.id('groups')),
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

    // Validate target
    if (!args.conversationId && !args.groupId) {
      throw new Error('Must specify either conversationId or groupId');
    }

    let pinnedMessages;

    if (args.conversationId) {
      const conversation = await ctx.db.get(args.conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Verify access
      if (
        conversation.participant1Id !== currentUser._id &&
        conversation.participant2Id !== currentUser._id
      ) {
        throw new Error('Not authorized');
      }

      pinnedMessages = await ctx.db
        .query('pinnedMessages')
        .withIndex('by_conversation', (q) =>
          q.eq('conversationId', args.conversationId)
        )
        .collect();
    } else if (args.groupId) {
      const membership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_and_user', (q) =>
          q.eq('groupId', args.groupId!).eq('userId', currentUser._id)
        )
        .first();

      if (!membership) {
        throw new Error('Not authorized');
      }

      pinnedMessages = await ctx.db
        .query('pinnedMessages')
        .withIndex('by_group', (q) => q.eq('groupId', args.groupId))
        .collect();
    } else {
      return [];
    }

    // Enrich with message and sender info
    const enriched = await Promise.all(
      pinnedMessages.map(async (pin) => {
        const message = await ctx.db.get(pin.messageId);
        if (!message) return null;

        const sender = await ctx.db.get(message.senderId);
        const pinnedByUser = await ctx.db.get(pin.pinnedBy);

        return {
          _id: pin._id,
          pinnedAt: pin.pinnedAt,
          pinnedBy: pinnedByUser
            ? {
                _id: pinnedByUser._id,
                name: pinnedByUser.name,
              }
            : null,
          message: {
            ...message,
            sender: sender
              ? {
                  _id: sender._id,
                  name: sender.name,
                  email: sender.email,
                  avatarUrl: sender.avatarUrl,
                }
              : null,
          },
        };
      })
    );

    return enriched.filter((p) => p !== null);
  },
});

/**
 * Soft delete a message (sender only)
 */
export const deleteMessage = mutation({
  args: {
    messageId: v.id('messages'),
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

    // Get the message
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Only sender can delete their message
    if (message.senderId !== currentUser._id) {
      throw new Error('Only the sender can delete this message');
    }

    // Soft delete
    await ctx.db.patch(args.messageId, {
      isDeleted: true,
      updatedAt: getCurrentTimestamp(),
    });

    // Remove any pins on this message
    const pins = await ctx.db
      .query('pinnedMessages')
      .withIndex('by_message', (q) => q.eq('messageId', args.messageId))
      .collect();

    for (const pin of pins) {
      await ctx.db.delete(pin._id);
    }

    return args.messageId;
  },
});

/**
 * Edit a message (sender only, text messages only)
 */
export const editMessage = mutation({
  args: {
    messageId: v.id('messages'),
    content: v.string(),
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

    // Get the message
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Only sender can edit
    if (message.senderId !== currentUser._id) {
      throw new Error('Only the sender can edit this message');
    }

    // Cannot edit deleted messages
    if (message.isDeleted) {
      throw new Error('Cannot edit a deleted message');
    }

    // Cannot edit non-text messages
    if (message.type !== 'text') {
      throw new Error('Can only edit text messages');
    }

    // Validate content
    if (args.content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }

    await ctx.db.patch(args.messageId, {
      content: args.content,
      updatedAt: getCurrentTimestamp(),
    });

    return args.messageId;
  },
});
