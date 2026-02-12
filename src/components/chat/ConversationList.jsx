import { useQuery } from 'convex/react';
import { PaperClipIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../convex/_generated/api';
import UserPresence from '../common/UserPresence';
import LoadingSpinner from '../common/LoadingSpinner';
import { formatRelativeTime } from '../../utils/dateUtils';
import './ConversationList.css';

export default function ConversationList() {
  const conversations = useQuery(api.conversations.listConversations);
  const navigate = useNavigate();
  const { conversationId } = useParams();

  if (conversations === undefined) {
    return (
      <div className="conversation-list__loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="conversation-list__empty">
        <p>No conversations yet</p>
        <p className="conversation-list__empty-hint">
          Start a new chat to begin messaging
        </p>
      </div>
    );
  }

  return (
    <ul className="conversation-list" role="list">
      {conversations.map((conv) => (
        <li key={conv._id}>
          <button
            className={`conversation-list__item ${
              conversationId === conv._id ? 'conversation-list__item--active' : ''
            }`}
            onClick={() => navigate(`/conversation/${conv._id}`)}
          >
            <div className="conversation-list__avatar">
              {conv.otherUser?.avatarUrl ? (
                <img src={conv.otherUser.avatarUrl} alt="" />
              ) : (
                <span>
                  {conv.otherUser?.name?.[0] || conv.otherUser?.email?.[0] || '?'}
                </span>
              )}
              <UserPresence 
                status={conv.otherUser?.presenceStatus || 'offline'} 
                size="small" 
              />
            </div>
            <div className="conversation-list__content">
              <div className="conversation-list__header">
                <span className="conversation-list__name">
                  {conv.otherUser?.name || conv.otherUser?.email || 'Unknown User'}
                </span>
                {conv.lastMessage && (
                  <span className="conversation-list__time">
                    {formatRelativeTime(conv.lastMessage.createdAt)}
                  </span>
                )}
              </div>
              {conv.lastMessage && (
                <p className="conversation-list__preview">
                  {conv.lastMessage.type === 'file' ? (
                    <><PaperClipIcon className="w-4 h-4 inline-block mr-1 align-middle" aria-hidden />File attachment</>
                  ) : conv.lastMessage.type === 'call' ? (
                    <><PhoneIcon className="w-4 h-4 inline-block mr-1 align-middle" aria-hidden />Call</>
                  ) : (
                    conv.lastMessage.content
                  )}
                </p>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
