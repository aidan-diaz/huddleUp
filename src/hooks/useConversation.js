import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, usePaginatedQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { parseConvexError } from '../utils/errorUtils';

/**
 * Custom hook for managing a conversation
 * @param {string} conversationId - The conversation ID
 */
export function useConversation(conversationId) {
  const [error, setError] = useState(null);

  const conversation = useQuery(
    api.conversations.getConversation,
    conversationId ? { conversationId } : 'skip'
  );

  const pinnedMessages = useQuery(
    api.messages.getPinnedMessages,
    conversationId ? { conversationId } : 'skip'
  );

  return {
    conversation,
    pinnedMessages,
    error,
    isLoading: conversation === undefined,
    notFound: conversation === null,
  };
}

/**
 * Custom hook for managing a group
 * @param {string} groupId - The group ID
 */
export function useGroup(groupId) {
  const [error, setError] = useState(null);

  const group = useQuery(
    api.groups.getGroup,
    groupId ? { groupId } : 'skip'
  );

  const pinnedMessages = useQuery(
    api.messages.getPinnedMessages,
    groupId ? { groupId } : 'skip'
  );

  const updateGroup = useMutation(api.groups.updateGroup);
  const addMembers = useMutation(api.groups.addMembers);
  const removeMembers = useMutation(api.groups.removeMembers);
  const updateMemberRole = useMutation(api.groups.updateMemberRole);

  const handleUpdateGroup = useCallback(
    async (updates) => {
      try {
        setError(null);
        await updateGroup({ groupId, ...updates });
      } catch (err) {
        setError(parseConvexError(err).message);
        throw err;
      }
    },
    [groupId, updateGroup]
  );

  const handleAddMembers = useCallback(
    async (memberIds) => {
      try {
        setError(null);
        await addMembers({ groupId, memberIds });
      } catch (err) {
        setError(parseConvexError(err).message);
        throw err;
      }
    },
    [groupId, addMembers]
  );

  const handleRemoveMembers = useCallback(
    async (memberIds) => {
      try {
        setError(null);
        await removeMembers({ groupId, memberIds });
      } catch (err) {
        setError(parseConvexError(err).message);
        throw err;
      }
    },
    [groupId, removeMembers]
  );

  const handleUpdateMemberRole = useCallback(
    async (userId, role) => {
      try {
        setError(null);
        await updateMemberRole({ groupId, userId, role });
      } catch (err) {
        setError(parseConvexError(err).message);
        throw err;
      }
    },
    [groupId, updateMemberRole]
  );

  return {
    group,
    pinnedMessages,
    error,
    isLoading: group === undefined,
    notFound: group === null,
    isAdmin: group?.myRole === 'admin',
    updateGroup: handleUpdateGroup,
    addMembers: handleAddMembers,
    removeMembers: handleRemoveMembers,
    updateMemberRole: handleUpdateMemberRole,
  };
}

/**
 * Custom hook for sending messages
 * @param {Object} options - Options
 * @param {string} options.conversationId - Conversation ID (for DMs)
 * @param {string} options.groupId - Group ID (for groups)
 */
export function useSendMessage({ conversationId, groupId }) {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useMutation(api.messages.sendMessage);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveFileMessage = useMutation(api.files.saveFileMessage);

  const send = useCallback(
    async (content, type = 'text') => {
      if (!conversationId && !groupId) {
        throw new Error('No conversation or group selected');
      }

      setIsSending(true);
      setError(null);

      try {
        await sendMessage({
          content,
          conversationId,
          groupId,
          type,
        });
      } catch (err) {
        const parsed = parseConvexError(err);
        setError(parsed.message);
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, groupId, sendMessage]
  );

  const sendFile = useCallback(
    async (file) => {
      if (!conversationId && !groupId) {
        throw new Error('No conversation or group selected');
      }

      setIsSending(true);
      setError(null);

      try {
        // Get upload URL
        const uploadUrl = await generateUploadUrl();

        // Upload file
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error('Failed to upload file');
        }

        const { storageId } = await response.json();

        // Save file message
        await saveFileMessage({
          storageId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          conversationId,
          groupId,
        });
      } catch (err) {
        const parsed = parseConvexError(err);
        setError(parsed.message);
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, groupId, generateUploadUrl, saveFileMessage]
  );

  return {
    send,
    sendFile,
    isSending,
    error,
    clearError: () => setError(null),
  };
}

/**
 * Custom hook for managing messages in a conversation
 * @param {Object} options - Options
 * @param {string} options.conversationId - Conversation ID (for DMs)
 * @param {string} options.groupId - Group ID (for groups)
 */
export function useMessages({ conversationId, groupId }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.listMessages,
    conversationId
      ? { conversationId, paginationOpts: { numItems: 30 } }
      : groupId
      ? { groupId, paginationOpts: { numItems: 30 } }
      : 'skip',
    { initialNumItems: 30 }
  );

  // Reverse for display (newest at bottom)
  const messages = useMemo(() => {
    return results ? [...results].reverse() : [];
  }, [results]);

  return {
    messages,
    isLoading: status === 'LoadingFirstPage',
    isLoadingMore: status === 'LoadingMore',
    canLoadMore: status === 'CanLoadMore',
    loadMore: () => loadMore(20),
  };
}

export default {
  useConversation,
  useGroup,
  useSendMessage,
  useMessages,
};
