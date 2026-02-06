import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import {
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  isAllowedFileType,
  isAllowedFileSize,
} from './lib/utils';

/**
 * Generate a signed upload URL for file uploads
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error('Not authenticated');
    }

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Validate file before saving
 * Returns validation errors if any
 */
export const validateFile = query({
  args: {
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const errors: string[] = [];

    if (!isAllowedFileType(args.fileType)) {
      errors.push(
        `File type "${args.fileType}" is not allowed. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`
      );
    }

    if (!isAllowedFileSize(args.fileSize)) {
      const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
      errors.push(`File size exceeds maximum limit of ${maxSizeMB}MB`);
    }

    if (args.fileName.trim().length === 0) {
      errors.push('File name cannot be empty');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
});

/**
 * Save file metadata after successful upload
 * This is typically called after the file has been uploaded using the generated URL
 */
export const saveFileMessage = mutation({
  args: {
    storageId: v.id('_storage'),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    content: v.optional(v.string()), // optional caption/message with the file
    conversationId: v.optional(v.id('directConversations')),
    groupId: v.optional(v.id('groups')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error('Not authenticated');
    }

    const currentUser = await ctx.db.get(userId);
    if (!currentUser) {
      throw new Error('User not found');
    }

    // Validate file
    if (!isAllowedFileType(args.fileType)) {
      throw new Error(`File type "${args.fileType}" is not allowed`);
    }

    if (!isAllowedFileSize(args.fileSize)) {
      throw new Error('File size exceeds maximum limit');
    }

    // Validate target
    if (!args.conversationId && !args.groupId) {
      throw new Error('Must specify either conversationId or groupId');
    }
    if (args.conversationId && args.groupId) {
      throw new Error('Cannot specify both conversationId and groupId');
    }

    const now = Date.now();

    // Verify access and create message
    if (args.conversationId) {
      const conversation = await ctx.db.get(args.conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (
        conversation.participant1Id !== currentUser._id &&
        conversation.participant2Id !== currentUser._id
      ) {
        throw new Error('Not authorized');
      }

      const messageContent =
        args.content != null && args.content.trim() !== ''
          ? args.content.trim()
          : args.fileName;

      const messageId = await ctx.db.insert('messages', {
        senderId: currentUser._id,
        content: messageContent,
        conversationId: args.conversationId,
        type: 'file',
        fileId: args.storageId,
        fileName: args.fileName,
        fileType: args.fileType,
        fileSize: args.fileSize,
        isDeleted: false,
        createdAt: now,
      });

      await ctx.db.patch(args.conversationId, {
        lastMessageAt: now,
      });

      return messageId;
    }

    if (args.groupId) {
      const membership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_and_user', (q) =>
          q.eq('groupId', args.groupId!).eq('userId', currentUser._id)
        )
        .first();

      if (!membership) {
        throw new Error('Not a member of this group');
      }

      const messageContent =
        args.content != null && args.content.trim() !== ''
          ? args.content.trim()
          : args.fileName;

      const messageId = await ctx.db.insert('messages', {
        senderId: currentUser._id,
        content: messageContent,
        groupId: args.groupId,
        type: 'file',
        fileId: args.storageId,
        fileName: args.fileName,
        fileType: args.fileType,
        fileSize: args.fileSize,
        isDeleted: false,
        createdAt: now,
      });

      await ctx.db.patch(args.groupId, {
        lastMessageAt: now,
      });

      return messageId;
    }

    throw new Error('Invalid target');
  },
});

/**
 * Get a file URL by storage ID
 */
export const getFileUrl = query({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Delete a file from storage
 * Only the uploader can delete the file
 */
export const deleteFile = mutation({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error('Not authenticated');
    }

    const currentUser = await ctx.db.get(userId);
    if (!currentUser) {
      throw new Error('User not found');
    }

    // Get the message
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Only sender can delete
    if (message.senderId !== currentUser._id) {
      throw new Error('Only the sender can delete this file');
    }

    // Only file messages can be deleted this way
    if (message.type !== 'file') {
      throw new Error('This message is not a file');
    }

    // Delete from storage if file exists
    if (message.fileId) {
      await ctx.storage.delete(message.fileId);
    }

    // Soft delete the message
    await ctx.db.patch(args.messageId, {
      isDeleted: true,
      updatedAt: Date.now(),
    });

    return args.messageId;
  },
});

/**
 * Get file info with download URL
 */
export const getFileInfo = query({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error('Not authenticated');
    }

    const currentUser = await ctx.db.get(userId);
    if (!currentUser) {
      throw new Error('User not found');
    }

    // Get the message
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('Message not found');
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

    // Get file URL
    const url = message.fileId
      ? await ctx.storage.getUrl(message.fileId)
      : null;

    return {
      _id: message._id,
      fileName: message.fileName,
      fileType: message.fileType,
      fileSize: message.fileSize,
      url,
      isDeleted: message.isDeleted,
    };
  },
});

/**
 * Check if file type is an image (for preview)
 */
export const isImageFile = (fileType: string): boolean => {
  return fileType.startsWith('image/');
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
