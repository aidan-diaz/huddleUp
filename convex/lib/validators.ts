import { v } from 'convex/values';

// Presence status validator
export const presenceStatusValidator = v.union(
  v.literal('active'),
  v.literal('away'),
  v.literal('busy'),
  v.literal('inCall'),
  v.literal('offline')
);

// Message type validator
export const messageTypeValidator = v.union(
  v.literal('text'),
  v.literal('file'),
  v.literal('system'),
  v.literal('call')
);

// Call type validator
export const callTypeValidator = v.union(v.literal('audio'), v.literal('video'));

// Call status validator
export const callStatusValidator = v.union(
  v.literal('ringing'),
  v.literal('active'),
  v.literal('ended'),
  v.literal('missed')
);

// Group role validator
export const groupRoleValidator = v.union(
  v.literal('admin'),
  v.literal('member')
);

// Meeting request status validator
export const meetingRequestStatusValidator = v.union(
  v.literal('pending'),
  v.literal('approved'),
  v.literal('denied')
);

// Notification type validator
export const notificationTypeValidator = v.union(
  v.literal('message'),
  v.literal('call'),
  v.literal('meeting_request'),
  v.literal('meeting_response'),
  v.literal('group_invite')
);

// Pagination validator
export const paginationValidator = {
  cursor: v.optional(v.string()),
  limit: v.optional(v.number()),
};
