import { useRef, useEffect, useCallback, useState } from 'react';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import PropTypes from 'prop-types';
import MessageItem from './MessageItem';
import MessageSkeleton from '../common/MessageSkeleton';
import './MessageList.css';

const INITIAL_NUM_ITEMS = 30;

export default function MessageList({ conversationId, groupId }) {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const prevMessagesLengthRef = useRef(0);

  const currentUser = useQuery(api.users.getCurrentUser);

  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.listMessages,
    conversationId
      ? { conversationId, paginationOpts: { numItems: INITIAL_NUM_ITEMS } }
      : groupId
      ? { groupId, paginationOpts: { numItems: INITIAL_NUM_ITEMS } }
      : 'skip',
    { initialNumItems: INITIAL_NUM_ITEMS }
  );

  // Reverse messages for display (newest at bottom)
  const messages = results ? [...results].reverse() : [];

  // Scroll to bottom on new messages (only if already at bottom)
  useEffect(() => {
    if (
      isAtBottom &&
      messages.length > 0 &&
      messages.length !== prevMessagesLengthRef.current
    ) {
      scrollToBottom();
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, isAtBottom]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if at bottom (with 100px threshold)
    const atBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setIsAtBottom(atBottom);

    // Load more when scrolling near top
    if (container.scrollTop < 200 && status === 'CanLoadMore') {
      loadMore(20);
    }
  }, [status, loadMore]);

  if (status === 'LoadingFirstPage') {
    return (
      <div className="message-list__loading">
        <MessageSkeleton count={8} />
      </div>
    );
  }

  if (!conversationId && !groupId) {
    return (
      <div className="message-list__empty">
        <p>Select a conversation to start messaging</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="message-list"
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
      aria-label="Message history"
    >
      {status === 'LoadingMore' && (
        <div className="message-list__loading-more">
          <MessageSkeleton count={3} />
        </div>
      )}

      {status === 'Exhausted' && messages.length > 0 && (
        <div className="message-list__start">
          <p>Beginning of conversation</p>
        </div>
      )}

      {messages.length === 0 ? (
        <div className="message-list__empty">
          <p>No messages yet</p>
          <p className="message-list__empty-hint">
            Send a message to start the conversation
          </p>
        </div>
      ) : (
        <div className="message-list__items">
          {messages.map((message, index) => {
            const prevMessage = messages[index - 1];
            const showAvatar =
              !prevMessage ||
              prevMessage.senderId !== message.senderId ||
              message.createdAt - prevMessage.createdAt > 5 * 60 * 1000;

            return (
              <MessageItem
                key={message._id}
                message={message}
                isOwnMessage={message.senderId === currentUser?._id}
                showAvatar={showAvatar}
              />
            );
          })}
        </div>
      )}

      <div ref={messagesEndRef} />

      {!isAtBottom && (
        <button
          className="message-list__scroll-bottom"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <span aria-hidden="true">↓</span>
        </button>
      )}
    </div>
  );
}

MessageList.propTypes = {
  conversationId: PropTypes.string,
  groupId: PropTypes.string,
};
