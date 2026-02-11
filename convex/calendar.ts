import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { getAuthUserId } from './lib/auth';
import { getCurrentTimestamp } from './lib/utils';

/**
 * Create a calendar event
 */
export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    isAllDay: v.optional(v.boolean()),
    isPublic: v.optional(v.boolean()),
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

    // Validate times
    if (args.endTime <= args.startTime) {
      throw new Error('End time must be after start time');
    }

    if (args.title.trim().length === 0) {
      throw new Error('Title cannot be empty');
    }

    const now = getCurrentTimestamp();

    const eventId = await ctx.db.insert('calendarEvents', {
      userId: user._id,
      title: args.title.trim(),
      description: args.description?.trim(),
      startTime: args.startTime,
      endTime: args.endTime,
      isAllDay: args.isAllDay ?? false,
      isPublic: args.isPublic ?? false,
      createdAt: now,
    });

    return eventId;
  },
});

/**
 * Update a calendar event
 */
export const updateEvent = mutation({
  args: {
    eventId: v.id('calendarEvents'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    isAllDay: v.optional(v.boolean()),
    isPublic: v.optional(v.boolean()),
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

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Verify ownership
    if (event.userId !== user._id) {
      throw new Error('Not authorized to update this event');
    }

    // If this event is part of a meeting with another user, require their approval
    if (event.meetingRequestId) {
      const meetingRequest = await ctx.db.get(event.meetingRequestId);
      if (!meetingRequest) {
        throw new Error('Meeting not found');
      }
      const respondentId =
        meetingRequest.requesterId === user._id
          ? meetingRequest.recipientId
          : meetingRequest.requesterId;
      const respondent = await ctx.db.get(respondentId);

      // Check for existing pending update request
      const existing = await ctx.db
        .query('meetingUpdateRequests')
        .withIndex('by_meeting_request', (q) =>
          q.eq('meetingRequestId', event.meetingRequestId)
        )
        .filter((q) => q.eq(q.field('status'), 'pending'))
        .first();
      if (existing) {
        throw new Error(
          'You already have a pending update request for this meeting. Wait for the other participant to approve or deny it.'
        );
      }

      const proposedTitle = (args.title !== undefined ? args.title.trim() : event.title) || event.title;
      if (proposedTitle.length === 0) {
        throw new Error('Title cannot be empty');
      }
      const proposedStartTime = args.startTime ?? event.startTime;
      const proposedEndTime = args.endTime ?? event.endTime;
      if (proposedEndTime <= proposedStartTime) {
        throw new Error('End time must be after start time');
      }

      const now = getCurrentTimestamp();
      const updateRequestId = await ctx.db.insert('meetingUpdateRequests', {
        meetingRequestId: event.meetingRequestId,
        requestedByUserId: user._id,
        respondentUserId: respondentId,
        proposedTitle,
        proposedDescription: args.description !== undefined ? args.description.trim() : event.description,
        proposedStartTime,
        proposedEndTime,
        proposedIsAllDay: args.isAllDay ?? event.isAllDay,
        proposedIsPublic: args.isPublic ?? event.isPublic,
        status: 'pending',
        createdAt: now,
      });

      // Notify the other participant (must return, not throw, so the transaction commits and the notification is sent)
      await ctx.scheduler.runAfter(0, internal.notifications.notifyMeetingUpdateRequest, {
        respondentId,
        requesterName: user.name ?? user.email,
        meetingTitle: proposedTitle,
        updateRequestId,
      });

      return {
        requiresApproval: true as const,
        message: `${respondent?.name ?? respondent?.email ?? 'The other participant'} must approve the change before it takes effect. They have been notified.`,
      };
    }

    // Build updates (solo event – apply directly)
    const updates: {
      title?: string;
      description?: string;
      startTime?: number;
      endTime?: number;
      isAllDay?: boolean;
      isPublic?: boolean;
      updatedAt: number;
    } = {
      updatedAt: getCurrentTimestamp(),
    };

    if (args.title !== undefined) {
      if (args.title.trim().length === 0) {
        throw new Error('Title cannot be empty');
      }
      updates.title = args.title.trim();
    }
    if (args.description !== undefined) {
      updates.description = args.description.trim();
    }
    if (args.startTime !== undefined) {
      updates.startTime = args.startTime;
    }
    if (args.endTime !== undefined) {
      updates.endTime = args.endTime;
    }
    if (args.isAllDay !== undefined) {
      updates.isAllDay = args.isAllDay;
    }
    if (args.isPublic !== undefined) {
      updates.isPublic = args.isPublic;
    }

    // Validate times if both are being updated or set
    const newStartTime = updates.startTime ?? event.startTime;
    const newEndTime = updates.endTime ?? event.endTime;
    if (newEndTime <= newStartTime) {
      throw new Error('End time must be after start time');
    }

    await ctx.db.patch(args.eventId, updates);
    return args.eventId;
  },
});

/**
 * Delete a calendar event
 */
export const deleteEvent = mutation({
  args: {
    eventId: v.id('calendarEvents'),
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

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    if (event.userId !== user._id) {
      throw new Error('Not authorized to delete this event');
    }

    await ctx.db.delete(args.eventId);
    return args.eventId;
  },
});

/**
 * List events for current user in a date range
 */
export const listEvents = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return [];
    }

    // Get events that overlap with the date range
    const events = await ctx.db
      .query('calendarEvents')
      .withIndex('by_user_and_time', (q) =>
        q.eq('userId', user._id).gte('startTime', args.startDate)
      )
      .filter((q) => q.lte(q.field('startTime'), args.endDate))
      .collect();

    return events;
  },
});

/**
 * Get a single event
 */
export const getEvent = query({
  args: {
    eventId: v.id('calendarEvents'),
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

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Can view if owner or if event is public
    if (event.userId !== user._id && !event.isPublic) {
      throw new Error('Not authorized to view this event');
    }

    return event;
  },
});

/**
 * Get another user's public calendar (available slots)
 */
export const getPublicCalendar = query({
  args: {
    userId: v.id('users'),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get only public events for the specified user
    const events = await ctx.db
      .query('calendarEvents')
      .withIndex('by_user_and_time', (q) =>
        q.eq('userId', args.userId).gte('startTime', args.startDate)
      )
      .filter((q) =>
        q.and(
          q.lte(q.field('startTime'), args.endDate),
          q.eq(q.field('isPublic'), true)
        )
      )
      .collect();

    // Return only the times (not full details) for privacy
    return events.map((event) => ({
      _id: event._id,
      startTime: event.startTime,
      endTime: event.endTime,
      isAllDay: event.isAllDay,
      // Don't expose title/description for public calendar
    }));
  },
});

// ==================== Meeting Requests ====================

/**
 * Request a meeting with another user
 */
export const requestMeeting = mutation({
  args: {
    recipientId: v.id('users'),
    title: v.string(),
    description: v.optional(v.string()),
    proposedStartTime: v.number(),
    proposedEndTime: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error('Not authenticated');
    }

    const requester = await ctx.db.get(userId);
    if (!requester) {
      throw new Error('User not found');
    }

    // Verify recipient exists
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient) {
      throw new Error('Recipient not found');
    }

    // Can't request meeting with yourself
    if (requester._id === args.recipientId) {
      throw new Error('Cannot request meeting with yourself');
    }

    // Validate times
    if (args.proposedEndTime <= args.proposedStartTime) {
      throw new Error('End time must be after start time');
    }

    if (args.title.trim().length === 0) {
      throw new Error('Title cannot be empty');
    }

    const now = getCurrentTimestamp();

    const requestId = await ctx.db.insert('meetingRequests', {
      requesterId: requester._id,
      recipientId: args.recipientId,
      title: args.title.trim(),
      description: args.description?.trim(),
      proposedStartTime: args.proposedStartTime,
      proposedEndTime: args.proposedEndTime,
      status: 'pending',
      createdAt: now,
    });

    return requestId;
  },
});

/**
 * Respond to a meeting request (approve/deny)
 */
export const respondToRequest = mutation({
  args: {
    requestId: v.id('meetingRequests'),
    status: v.union(v.literal('approved'), v.literal('denied')),
    responseMessage: v.optional(v.string()),
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

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('Meeting request not found');
    }

    // Only recipient can respond
    if (request.recipientId !== user._id) {
      throw new Error('Not authorized to respond to this request');
    }

    // Can only respond to pending requests
    if (request.status !== 'pending') {
      throw new Error('Request has already been responded to');
    }

    const now = getCurrentTimestamp();

    // Update request status
    await ctx.db.patch(args.requestId, {
      status: args.status,
      responseMessage: args.responseMessage?.trim(),
      respondedAt: now,
    });

    // If approved, create calendar events for both users (linked so updates require approval)
    if (args.status === 'approved') {
      // Create event for recipient
      const recipientEventId = await ctx.db.insert('calendarEvents', {
        userId: user._id,
        title: request.title,
        description: request.description,
        startTime: request.proposedStartTime,
        endTime: request.proposedEndTime,
        isAllDay: false,
        isPublic: false,
        meetingRequestId: args.requestId,
        createdAt: now,
      });

      // Create event for requester
      await ctx.db.insert('calendarEvents', {
        userId: request.requesterId,
        title: request.title,
        description: request.description,
        startTime: request.proposedStartTime,
        endTime: request.proposedEndTime,
        isAllDay: false,
        isPublic: false,
        meetingRequestId: args.requestId,
        createdAt: now,
      });

      // Update request with event ID
      await ctx.db.patch(args.requestId, {
        eventId: recipientEventId,
      });
    }

    return args.requestId;
  },
});

/**
 * List pending meeting requests for current user (incoming)
 */
export const listPendingRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return [];
    }

    const requests = await ctx.db
      .query('meetingRequests')
      .withIndex('by_recipient_and_status', (q) =>
        q.eq('recipientId', user._id).eq('status', 'pending')
      )
      .collect();

    // Enrich with requester info
    return Promise.all(
      requests.map(async (request) => {
        const requester = await ctx.db.get(request.requesterId);
        return {
          ...request,
          requester: requester
            ? {
                _id: requester._id,
                name: requester.name,
                email: requester.email,
                avatarUrl: requester.avatarUrl,
              }
            : null,
        };
      })
    );
  },
});

/**
 * List sent meeting requests (outgoing)
 */
export const listSentRequests = query({
  args: {
    status: v.optional(
      v.union(v.literal('pending'), v.literal('approved'), v.literal('denied'))
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return [];
    }

    let requests = await ctx.db
      .query('meetingRequests')
      .withIndex('by_requester', (q) => q.eq('requesterId', user._id))
      .collect();

    // Filter by status if provided
    if (args.status) {
      requests = requests.filter((r) => r.status === args.status);
    }

    // Enrich with recipient info
    return Promise.all(
      requests.map(async (request) => {
        const recipient = await ctx.db.get(request.recipientId);
        return {
          ...request,
          recipient: recipient
            ? {
                _id: recipient._id,
                name: recipient.name,
                email: recipient.email,
                avatarUrl: recipient.avatarUrl,
              }
            : null,
        };
      })
    );
  },
});

/**
 * Cancel a meeting request (requester only)
 */
export const cancelRequest = mutation({
  args: {
    requestId: v.id('meetingRequests'),
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

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('Meeting request not found');
    }

    // Only requester can cancel
    if (request.requesterId !== user._id) {
      throw new Error('Not authorized to cancel this request');
    }

    // Can only cancel pending requests
    if (request.status !== 'pending') {
      throw new Error('Can only cancel pending requests');
    }

    await ctx.db.delete(args.requestId);
    return args.requestId;
  },
});

// ==================== Meeting Update Requests ====================

/**
 * List pending meeting update requests that need the current user's approval
 */
export const listPendingMeetingUpdateRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const updateRequests = await ctx.db
      .query('meetingUpdateRequests')
      .withIndex('by_respondent_and_status', (q) =>
        q.eq('respondentUserId', userId).eq('status', 'pending')
      )
      .collect();

    return Promise.all(
      updateRequests.map(async (ur) => {
        const meetingRequest = await ctx.db.get(ur.meetingRequestId);
        const requester = await ctx.db.get(ur.requestedByUserId);
        return {
          ...ur,
          meetingRequest,
          requester: requester
            ? {
                _id: requester._id,
                name: requester.name,
                email: requester.email,
                avatarUrl: requester.avatarUrl,
              }
            : null,
        };
      })
    );
  },
});

/**
 * Respond to a meeting update request (approve or deny)
 */
export const respondToMeetingUpdate = mutation({
  args: {
    updateRequestId: v.id('meetingUpdateRequests'),
    status: v.union(v.literal('approved'), v.literal('denied')),
    responseMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error('Not authenticated');
    }

    const updateRequest = await ctx.db.get(args.updateRequestId);
    if (!updateRequest) {
      throw new Error('Meeting update request not found');
    }

    if (updateRequest.respondentUserId !== userId) {
      throw new Error('Not authorized to respond to this update request');
    }

    if (updateRequest.status !== 'pending') {
      throw new Error('This update request has already been responded to');
    }

    const now = getCurrentTimestamp();

    if (args.status === 'approved') {
      // Get both events linked to this meeting and patch them
      const events = await ctx.db
        .query('calendarEvents')
        .withIndex('by_meeting_request', (q) =>
          q.eq('meetingRequestId', updateRequest.meetingRequestId)
        )
        .collect();

      const patch = {
        title: updateRequest.proposedTitle,
        description: updateRequest.proposedDescription,
        startTime: updateRequest.proposedStartTime,
        endTime: updateRequest.proposedEndTime,
        isAllDay: updateRequest.proposedIsAllDay,
        isPublic: updateRequest.proposedIsPublic,
        updatedAt: now,
      };

      for (const ev of events) {
        await ctx.db.patch(ev._id, patch);
      }
    }

    await ctx.db.patch(args.updateRequestId, {
      status: args.status,
      responseMessage: args.responseMessage?.trim(),
      respondedAt: now,
    });

    return args.updateRequestId;
  },
});
