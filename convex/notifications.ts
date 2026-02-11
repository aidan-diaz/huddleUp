import { v } from 'convex/values';
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from './_generated/server';
import { internal } from './_generated/api';
import { getAuthUserId } from './lib/auth';
import { getCurrentTimestamp } from './lib/utils';
import { notificationTypeValidator } from './lib/validators';

/**
 * Create a notification (internal use)
 */
export const createNotification = internalMutation({
  args: {
    userId: v.id('users'),
    type: notificationTypeValidator,
    title: v.string(),
    body: v.string(),
    referenceId: v.optional(v.string()),
    referenceType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert('notifications', {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      referenceId: args.referenceId,
      referenceType: args.referenceType,
      isRead: false,
      createdAt: getCurrentTimestamp(),
    });

    return notificationId;
  },
});

/**
 * List notifications for current user
 */
export const listNotifications = query({
  args: {
    limit: v.optional(v.number()),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user) return [];

    const limit = args.limit ?? 50;

    let notificationsQuery = ctx.db.query('notifications');

    if (args.unreadOnly) {
      notificationsQuery = notificationsQuery.withIndex('by_user_and_read', (q) =>
        q.eq('userId', user._id).eq('isRead', false)
      );
    } else {
      notificationsQuery = notificationsQuery.withIndex('by_user', (q) =>
        q.eq('userId', user._id)
      );
    }

    const notifications = await notificationsQuery.order('desc').take(limit);

    return notifications;
  },
});

/**
 * Get unread notification count
 */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const user = await ctx.db.get(userId);
    if (!user) return 0;

    const unreadNotifications = await ctx.db
      .query('notifications')
      .withIndex('by_user_and_read', (q) =>
        q.eq('userId', user._id).eq('isRead', false)
      )
      .collect();

    return unreadNotifications.length;
  },
});

/**
 * Mark a notification as read
 */
export const markAsRead = mutation({
  args: {
    notificationId: v.id('notifications'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const user = await ctx.db.get(userId);
    if (!user) throw new Error('User not found');

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId !== user._id) {
      throw new Error('Not authorized');
    }

    await ctx.db.patch(args.notificationId, {
      isRead: true,
    });

    return args.notificationId;
  },
});

/**
 * Mark all notifications as read
 */
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const user = await ctx.db.get(userId);
    if (!user) throw new Error('User not found');

    const unreadNotifications = await ctx.db
      .query('notifications')
      .withIndex('by_user_and_read', (q) =>
        q.eq('userId', user._id).eq('isRead', false)
      )
      .collect();

    for (const notification of unreadNotifications) {
      await ctx.db.patch(notification._id, {
        isRead: true,
      });
    }

    return unreadNotifications.length;
  },
});

/**
 * Delete a notification
 */
export const deleteNotification = mutation({
  args: {
    notificationId: v.id('notifications'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const user = await ctx.db.get(userId);
    if (!user) throw new Error('User not found');

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId !== user._id) {
      throw new Error('Not authorized');
    }

    await ctx.db.delete(args.notificationId);
    return args.notificationId;
  },
});

/**
 * Save push subscription
 */
export const savePushSubscription = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const user = await ctx.db.get(userId);
    if (!user) throw new Error('User not found');

    const existingSubscription = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();

    if (existingSubscription) {
      // Update existing subscription
      await ctx.db.patch(existingSubscription._id, {
        userId: user._id,
        p256dh: args.p256dh,
        auth: args.auth,
      });
      return existingSubscription._id;
    }

    // Create new subscription
    const subscriptionId = await ctx.db.insert('pushSubscriptions', {
      userId: user._id,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      createdAt: getCurrentTimestamp(),
    });

    return subscriptionId;
  },
});

/**
 * Remove push subscription
 */
export const removePushSubscription = mutation({
  args: {
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const subscription = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();

    if (subscription && subscription.userId === userId) {
      await ctx.db.delete(subscription._id);
    }

    return true;
  },
});

/**
 * Internal query – get push subscriptions for a user (backend only).
 * Used by convex/push.ts sendPushNotification action.
 */
export const getUserPushSubscriptions = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('pushSubscriptions')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
  },
});

/**
 * Helper to notify user about new message
 */
export const notifyNewMessage = internalMutation({
  args: {
    recipientId: v.id('users'),
    senderName: v.string(),
    messagePreview: v.string(),
    conversationId: v.optional(v.id('directConversations')),
    groupId: v.optional(v.id('groups')),
    groupName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const title = args.groupName
      ? `New message in ${args.groupName}`
      : `New message from ${args.senderName}`;

    const body = args.messagePreview.length > 100
      ? args.messagePreview.substring(0, 100) + '...'
      : args.messagePreview;

    await ctx.db.insert('notifications', {
      userId: args.recipientId,
      type: 'message',
      title,
      body,
      referenceId: args.conversationId ?? args.groupId,
      referenceType: args.conversationId ? 'conversation' : 'group',
      isRead: false,
      createdAt: getCurrentTimestamp(),
    });
  },
});

/**
 * Helper to notify user about incoming call
 */
export const notifyIncomingCall = internalMutation({
  args: {
    recipientId: v.id('users'),
    callerName: v.string(),
    callType: v.union(v.literal('audio'), v.literal('video')),
    callId: v.id('calls'),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('notifications', {
      userId: args.recipientId,
      type: 'call',
      title: `Incoming ${args.callType} call`,
      body: `${args.callerName} is calling you`,
      referenceId: args.callId,
      referenceType: 'call',
      isRead: false,
      createdAt: getCurrentTimestamp(),
    });
  },
});

/**
 * Helper to notify user about meeting request
 */
export const notifyMeetingRequest = internalMutation({
  args: {
    recipientId: v.id('users'),
    requesterName: v.string(),
    meetingTitle: v.string(),
    requestId: v.id('meetingRequests'),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('notifications', {
      userId: args.recipientId,
      type: 'meeting_request',
      title: 'New meeting request',
      body: `${args.requesterName} requested: ${args.meetingTitle}`,
      referenceId: args.requestId,
      referenceType: 'meetingRequest',
      isRead: false,
      createdAt: getCurrentTimestamp(),
    });
  },
});

/**
 * Helper to notify user about a meeting update request (someone wants to change a shared meeting)
 */
export const notifyMeetingUpdateRequest = internalMutation({
  args: {
    respondentId: v.id('users'),
    requesterName: v.string(),
    meetingTitle: v.string(),
    updateRequestId: v.id('meetingUpdateRequests'),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('notifications', {
      userId: args.respondentId,
      type: 'meeting_update_request',
      title: 'Meeting change requested',
      body: `${args.requesterName} wants to update: ${args.meetingTitle}`,
      referenceId: args.updateRequestId,
      referenceType: 'meetingUpdateRequest',
      isRead: false,
      createdAt: getCurrentTimestamp(),
    });
  },
});
