import { v } from 'convex/values';
import { mutation, query, action, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { getCurrentTimestamp } from './lib/utils';
import { callTypeValidator, callStatusValidator } from './lib/validators';

/**
 * Create a new call and generate LiveKit room
 */
export const createCall = action({
  args: {
    conversationId: v.optional(v.id('directConversations')),
    groupId: v.optional(v.id('groups')),
    type: callTypeValidator,
  },
  handler: async (ctx, args): Promise<{ callId: string; token: string; roomName: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Validate target
    if (!args.conversationId && !args.groupId) {
      throw new Error('Must specify either conversationId or groupId');
    }

    // Generate unique room name
    const roomName = `huddleup-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create call record
    const callId = await ctx.runMutation(internal.calls.createCallRecord, {
      conversationId: args.conversationId,
      groupId: args.groupId,
      type: args.type,
      roomName,
      initiatorEmail: identity.email!,
    });

    // Generate LiveKit token for initiator
    const token = await generateLiveKitToken(
      roomName,
      identity.email!,
      identity.name || identity.email!
    );

    return { callId, token, roomName };
  },
});

/**
 * Internal mutation to create call record
 */
export const createCallRecord = internalMutation({
  args: {
    conversationId: v.optional(v.id('directConversations')),
    groupId: v.optional(v.id('groups')),
    type: callTypeValidator,
    roomName: v.string(),
    initiatorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Get initiator user
    const initiator = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.initiatorEmail))
      .first();

    if (!initiator) {
      throw new Error('User not found');
    }

    const now = getCurrentTimestamp();

    // Create call
    const callId = await ctx.db.insert('calls', {
      conversationId: args.conversationId,
      groupId: args.groupId,
      initiatorId: initiator._id,
      type: args.type,
      status: 'ringing',
      roomName: args.roomName,
      createdAt: now,
    });

    // Add initiator as participant
    await ctx.db.insert('callParticipants', {
      callId,
      userId: initiator._id,
      joinedAt: now,
    });

    // Update user presence to inCall
    await ctx.db.patch(initiator._id, {
      presenceStatus: 'inCall',
    });

    return callId;
  },
});

/**
 * Join an existing call
 */
export const joinCall = action({
  args: {
    callId: v.id('calls'),
  },
  handler: async (ctx, args): Promise<{ token: string; roomName: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get call details and join
    const result = await ctx.runMutation(internal.calls.addParticipant, {
      callId: args.callId,
      userEmail: identity.email!,
    });

    // Generate LiveKit token
    const token = await generateLiveKitToken(
      result.roomName,
      identity.email!,
      identity.name || identity.email!
    );

    return { token, roomName: result.roomName };
  },
});

/**
 * Internal mutation to add participant to call
 */
export const addParticipant = internalMutation({
  args: {
    callId: v.id('calls'),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.callId);
    if (!call) {
      throw new Error('Call not found');
    }

    if (call.status === 'ended' || call.status === 'missed') {
      throw new Error('Call has already ended');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.userEmail))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // Verify user has access to the call
    if (call.conversationId) {
      const conversation = await ctx.db.get(call.conversationId);
      if (
        !conversation ||
        (conversation.participant1Id !== user._id &&
          conversation.participant2Id !== user._id)
      ) {
        throw new Error('Not authorized to join this call');
      }
    } else if (call.groupId) {
      const membership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_and_user', (q) =>
          q.eq('groupId', call.groupId!).eq('userId', user._id)
        )
        .first();

      if (!membership) {
        throw new Error('Not authorized to join this call');
      }
    }

    const now = getCurrentTimestamp();

    // Check if already a participant
    const existingParticipant = await ctx.db
      .query('callParticipants')
      .withIndex('by_call', (q) => q.eq('callId', args.callId))
      .filter((q) => q.eq(q.field('userId'), user._id))
      .first();

    if (!existingParticipant) {
      // Add as participant
      await ctx.db.insert('callParticipants', {
        callId: args.callId,
        userId: user._id,
        joinedAt: now,
      });
    } else if (existingParticipant.leftAt) {
      // Rejoin - clear leftAt
      await ctx.db.patch(existingParticipant._id, {
        joinedAt: now,
        leftAt: undefined,
      });
    }

    // Update call status to active if it was ringing
    if (call.status === 'ringing') {
      await ctx.db.patch(args.callId, {
        status: 'active',
        startedAt: now,
      });
    }

    // Update user presence
    await ctx.db.patch(user._id, {
      presenceStatus: 'inCall',
    });

    return { roomName: call.roomName };
  },
});

/**
 * Leave a call
 */
export const leaveCall = mutation({
  args: {
    callId: v.id('calls'),
  },
  handler: async (ctx, args) => {
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

    const call = await ctx.db.get(args.callId);
    if (!call) {
      throw new Error('Call not found');
    }

    const now = getCurrentTimestamp();

    // Find participant record
    const participant = await ctx.db
      .query('callParticipants')
      .withIndex('by_call', (q) => q.eq('callId', args.callId))
      .filter((q) => q.eq(q.field('userId'), user._id))
      .first();

    if (participant && !participant.leftAt) {
      await ctx.db.patch(participant._id, {
        leftAt: now,
      });
    }

    // Update user presence back to active
    await ctx.db.patch(user._id, {
      presenceStatus: 'active',
    });

    // Check if all participants have left
    const activeParticipants = await ctx.db
      .query('callParticipants')
      .withIndex('by_call', (q) => q.eq('callId', args.callId))
      .filter((q) => q.eq(q.field('leftAt'), undefined))
      .collect();

    // If no active participants, end the call
    if (activeParticipants.length === 0 && call.status === 'active') {
      const duration = call.startedAt ? now - call.startedAt : 0;

      await ctx.db.patch(args.callId, {
        status: 'ended',
        endedAt: now,
        duration,
      });

      // Create system message for call duration
      if (call.conversationId || call.groupId) {
        await ctx.db.insert('messages', {
          senderId: call.initiatorId,
          content: `Call ended - Duration: ${formatDuration(duration)}`,
          conversationId: call.conversationId,
          groupId: call.groupId,
          type: 'call',
          callDuration: duration,
          isDeleted: false,
          createdAt: now,
        });
      }
    }

    return args.callId;
  },
});

/**
 * End a call (initiator only or when everyone leaves)
 */
export const endCall = mutation({
  args: {
    callId: v.id('calls'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const call = await ctx.db.get(args.callId);
    if (!call) {
      throw new Error('Call not found');
    }

    if (call.status === 'ended') {
      return args.callId;
    }

    const now = getCurrentTimestamp();
    const duration = call.startedAt ? now - call.startedAt : 0;
    const finalStatus = call.status === 'ringing' ? 'missed' : 'ended';

    // End the call
    await ctx.db.patch(args.callId, {
      status: finalStatus,
      endedAt: now,
      duration: finalStatus === 'ended' ? duration : undefined,
    });

    // Update all participants' leftAt and presence
    const participants = await ctx.db
      .query('callParticipants')
      .withIndex('by_call', (q) => q.eq('callId', args.callId))
      .collect();

    for (const participant of participants) {
      if (!participant.leftAt) {
        await ctx.db.patch(participant._id, {
          leftAt: now,
        });
      }

      const user = await ctx.db.get(participant.userId);
      if (user && user.presenceStatus === 'inCall') {
        await ctx.db.patch(participant.userId, {
          presenceStatus: 'active',
        });
      }
    }

    // Create system message
    if (finalStatus === 'ended' && (call.conversationId || call.groupId)) {
      await ctx.db.insert('messages', {
        senderId: call.initiatorId,
        content: `Call ended - Duration: ${formatDuration(duration)}`,
        conversationId: call.conversationId,
        groupId: call.groupId,
        type: 'call',
        callDuration: duration,
        isDeleted: false,
        createdAt: now,
      });
    } else if (finalStatus === 'missed' && (call.conversationId || call.groupId)) {
      await ctx.db.insert('messages', {
        senderId: call.initiatorId,
        content: 'Missed call',
        conversationId: call.conversationId,
        groupId: call.groupId,
        type: 'call',
        isDeleted: false,
        createdAt: now,
      });
    }

    return args.callId;
  },
});

/**
 * Get call history for a conversation or group
 */
export const getCallHistory = query({
  args: {
    conversationId: v.optional(v.id('directConversations')),
    groupId: v.optional(v.id('groups')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!user) {
      return [];
    }

    const limit = args.limit ?? 20;

    let calls;
    if (args.conversationId) {
      // Verify access
      const conversation = await ctx.db.get(args.conversationId);
      if (
        !conversation ||
        (conversation.participant1Id !== user._id &&
          conversation.participant2Id !== user._id)
      ) {
        return [];
      }

      calls = await ctx.db
        .query('calls')
        .withIndex('by_conversation', (q) =>
          q.eq('conversationId', args.conversationId)
        )
        .order('desc')
        .take(limit);
    } else if (args.groupId) {
      // Verify membership
      const membership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_and_user', (q) =>
          q.eq('groupId', args.groupId!).eq('userId', user._id)
        )
        .first();

      if (!membership) {
        return [];
      }

      calls = await ctx.db
        .query('calls')
        .withIndex('by_group', (q) => q.eq('groupId', args.groupId))
        .order('desc')
        .take(limit);
    } else {
      return [];
    }

    // Enrich with initiator info
    return Promise.all(
      calls.map(async (call) => {
        const initiator = await ctx.db.get(call.initiatorId);
        return {
          ...call,
          initiator: initiator
            ? {
                _id: initiator._id,
                name: initiator.name,
                email: initiator.email,
              }
            : null,
          formattedDuration: call.duration
            ? formatDuration(call.duration)
            : null,
        };
      })
    );
  },
});

/**
 * Get active call for current user
 */
export const getActiveCall = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!user) {
      return null;
    }

    // Find active call participation
    const participation = await ctx.db
      .query('callParticipants')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .filter((q) => q.eq(q.field('leftAt'), undefined))
      .first();

    if (!participation) {
      return null;
    }

    const call = await ctx.db.get(participation.callId);
    if (!call || call.status === 'ended' || call.status === 'missed') {
      return null;
    }

    return call;
  },
});

/**
 * Get incoming calls (calls in ringing state where user is a potential participant)
 */
export const getIncomingCalls = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!user) {
      return [];
    }

    // Get all ringing calls
    const ringingCalls = await ctx.db
      .query('calls')
      .withIndex('by_status', (q) => q.eq('status', 'ringing'))
      .collect();

    // Filter to calls user can join
    const incomingCalls = [];

    for (const call of ringingCalls) {
      // Skip if user is the initiator
      if (call.initiatorId === user._id) {
        continue;
      }

      // Check if user has access
      let hasAccess = false;

      if (call.conversationId) {
        const conversation = await ctx.db.get(call.conversationId);
        if (
          conversation &&
          (conversation.participant1Id === user._id ||
            conversation.participant2Id === user._id)
        ) {
          hasAccess = true;
        }
      } else if (call.groupId) {
        const membership = await ctx.db
          .query('groupMembers')
          .withIndex('by_group_and_user', (q) =>
            q.eq('groupId', call.groupId!).eq('userId', user._id)
          )
          .first();

        if (membership) {
          hasAccess = true;
        }
      }

      if (hasAccess) {
        const initiator = await ctx.db.get(call.initiatorId);
        incomingCalls.push({
          ...call,
          initiator: initiator
            ? {
                _id: initiator._id,
                name: initiator.name,
                email: initiator.email,
                avatarUrl: initiator.avatarUrl,
              }
            : null,
        });
      }
    }

    return incomingCalls;
  },
});

/**
 * Helper function to generate LiveKit token
 * In production, use the @livekit/server-sdk package
 */
async function generateLiveKitToken(
  roomName: string,
  identity: string,
  name: string
): Promise<string> {
  // Get environment variables
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    // Return a placeholder for development without LiveKit configured
    console.warn('LiveKit credentials not configured. Using placeholder token.');
    return `dev-token-${roomName}-${identity}`;
  }

  // In production, use the LiveKit Server SDK to generate proper JWT tokens
  // For now, we'll create a basic structure
  // You would use: import { AccessToken } from 'livekit-server-sdk';
  
  // Placeholder implementation - replace with actual LiveKit SDK in production
  const tokenData = {
    room: roomName,
    identity,
    name,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
  };

  // This is a simplified placeholder - use livekit-server-sdk in production
  return Buffer.from(JSON.stringify(tokenData)).toString('base64');
}

/**
 * Format duration in seconds to human readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
