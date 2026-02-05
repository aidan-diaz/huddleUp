import { defineSchema, defineTable } from 'convex/server';
import { authTables } from '@convex-dev/auth/server';
import { v } from 'convex/values';

export default defineSchema({
  ...authTables,

  // User profiles with presence status
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    presenceStatus: v.union(
      v.literal('active'),
      v.literal('away'),
      v.literal('busy'),
      v.literal('inCall'),
      v.literal('offline')
    ),
    lastHeartbeat: v.number(),
    createdAt: v.number(),
  })
    .index('by_email', ['email'])
    .index('by_presence', ['presenceStatus']),

  // 1:1 conversation records
  directConversations: defineTable({
    participant1Id: v.id('users'),
    participant2Id: v.id('users'),
    lastMessageAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_participant1', ['participant1Id'])
    .index('by_participant2', ['participant2Id'])
    .index('by_participants', ['participant1Id', 'participant2Id']),

  // Group chat metadata
  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    creatorId: v.id('users'),
    lastMessageAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index('by_creator', ['creatorId']),

  // Group membership with roles
  groupMembers: defineTable({
    groupId: v.id('groups'),
    userId: v.id('users'),
    role: v.union(v.literal('admin'), v.literal('member')),
    joinedAt: v.number(),
  })
    .index('by_group', ['groupId'])
    .index('by_user', ['userId'])
    .index('by_group_and_user', ['groupId', 'userId']),

  // All messages (DM and group) with polymorphic reference
  messages: defineTable({
    senderId: v.id('users'),
    content: v.string(),
    // Polymorphic: either conversationId or groupId will be set
    conversationId: v.optional(v.id('directConversations')),
    groupId: v.optional(v.id('groups')),
    // Message type
    type: v.union(
      v.literal('text'),
      v.literal('file'),
      v.literal('system'),
      v.literal('call')
    ),
    // For file messages
    fileId: v.optional(v.id('_storage')),
    fileName: v.optional(v.string()),
    fileType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    // For call messages
    callDuration: v.optional(v.number()),
    // Soft delete
    isDeleted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index('by_conversation', ['conversationId', 'createdAt'])
    .index('by_group', ['groupId', 'createdAt'])
    .index('by_sender', ['senderId']),

  // Pinned message references
  pinnedMessages: defineTable({
    messageId: v.id('messages'),
    conversationId: v.optional(v.id('directConversations')),
    groupId: v.optional(v.id('groups')),
    pinnedBy: v.id('users'),
    pinnedAt: v.number(),
  })
    .index('by_conversation', ['conversationId'])
    .index('by_group', ['groupId'])
    .index('by_message', ['messageId']),

  // Call records with duration
  calls: defineTable({
    conversationId: v.optional(v.id('directConversations')),
    groupId: v.optional(v.id('groups')),
    initiatorId: v.id('users'),
    type: v.union(v.literal('audio'), v.literal('video')),
    status: v.union(
      v.literal('ringing'),
      v.literal('active'),
      v.literal('ended'),
      v.literal('missed')
    ),
    roomName: v.string(),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_conversation', ['conversationId'])
    .index('by_group', ['groupId'])
    .index('by_status', ['status']),

  // Call participation tracking
  callParticipants: defineTable({
    callId: v.id('calls'),
    userId: v.id('users'),
    joinedAt: v.number(),
    leftAt: v.optional(v.number()),
  })
    .index('by_call', ['callId'])
    .index('by_user', ['userId']),

  // User calendar events
  calendarEvents: defineTable({
    userId: v.id('users'),
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    isAllDay: v.boolean(),
    isPublic: v.boolean(),
    // Optional link to a call or meeting
    callId: v.optional(v.id('calls')),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_time', ['userId', 'startTime']),

  // Meeting request records with status
  meetingRequests: defineTable({
    requesterId: v.id('users'),
    recipientId: v.id('users'),
    title: v.string(),
    description: v.optional(v.string()),
    proposedStartTime: v.number(),
    proposedEndTime: v.number(),
    status: v.union(
      v.literal('pending'),
      v.literal('approved'),
      v.literal('denied')
    ),
    responseMessage: v.optional(v.string()),
    // Created event ID after approval
    eventId: v.optional(v.id('calendarEvents')),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index('by_requester', ['requesterId'])
    .index('by_recipient', ['recipientId'])
    .index('by_recipient_and_status', ['recipientId', 'status']),

  // In-app notification storage
  notifications: defineTable({
    userId: v.id('users'),
    type: v.union(
      v.literal('message'),
      v.literal('call'),
      v.literal('meeting_request'),
      v.literal('meeting_response'),
      v.literal('group_invite')
    ),
    title: v.string(),
    body: v.string(),
    // Reference to related entity
    referenceId: v.optional(v.string()),
    referenceType: v.optional(v.string()),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_read', ['userId', 'isRead']),

  // Browser push subscription storage
  pushSubscriptions: defineTable({
    userId: v.id('users'),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_endpoint', ['endpoint']),
});
