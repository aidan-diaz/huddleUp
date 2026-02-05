import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import PropTypes from 'prop-types';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ChatHeader from './ChatHeader';
import DetailPanel from './DetailPanel';
import LoadingSpinner from '../common/LoadingSpinner';
import MessageSkeleton from '../common/MessageSkeleton';
import './ChatView.css';

export default function ChatView({ type }) {
  const { conversationId, groupId } = useParams();
  const [showDetails, setShowDetails] = useState(false);

  // Fetch conversation or group details
  const conversation = useQuery(
    api.conversations.getConversation,
    type === 'conversation' && conversationId ? { conversationId } : 'skip'
  );

  const group = useQuery(
    api.groups.getGroup,
    type === 'group' && groupId ? { groupId } : 'skip'
  );

  const isLoading = 
    (type === 'conversation' && conversation === undefined) ||
    (type === 'group' && group === undefined);

  const hasError =
    (type === 'conversation' && conversationId && conversation === null) ||
    (type === 'group' && groupId && group === null);

  if (isLoading) {
    return (
      <div className="chat-view">
        <div className="chat-view__loading">
          <MessageSkeleton count={8} />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="chat-view">
        <div className="chat-view__error">
          <h2>Chat not found</h2>
          <p>This conversation may have been deleted or you don&apos;t have access.</p>
        </div>
      </div>
    );
  }

  const chatTitle = type === 'conversation'
    ? conversation?.otherUser?.name || conversation?.otherUser?.email || 'Unknown'
    : group?.name || 'Unknown Group';

  const chatSubtitle = type === 'conversation'
    ? conversation?.otherUser?.presenceStatus
    : `${group?.members?.length || 0} members`;

  return (
    <div className="chat-view">
      <ChatHeader
        title={chatTitle}
        subtitle={chatSubtitle}
        type={type}
        avatarUrl={
          type === 'conversation'
            ? conversation?.otherUser?.avatarUrl
            : group?.avatarUrl
        }
        presenceStatus={
          type === 'conversation'
            ? conversation?.otherUser?.presenceStatus
            : undefined
        }
        onShowDetails={() => setShowDetails(!showDetails)}
      />

      <div className="chat-view__body">
        <div className="chat-view__messages">
          <MessageList
            conversationId={type === 'conversation' ? conversationId : undefined}
            groupId={type === 'group' ? groupId : undefined}
          />
        </div>

        {showDetails && (
          <DetailPanel
            type={type}
            conversation={conversation}
            group={group}
            onClose={() => setShowDetails(false)}
          />
        )}
      </div>

      <MessageInput
        conversationId={type === 'conversation' ? conversationId : undefined}
        groupId={type === 'group' ? groupId : undefined}
      />
    </div>
  );
}

ChatView.propTypes = {
  type: PropTypes.oneOf(['conversation', 'group']).isRequired,
};
