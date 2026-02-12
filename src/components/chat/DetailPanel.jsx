import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { XMarkIcon, ArrowUpIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { api } from '../../../convex/_generated/api';
import PropTypes from 'prop-types';
import UserPresence from '../common/UserPresence';
import LoadingSpinner from '../common/LoadingSpinner';
import { formatRelativeTime } from '../../utils/dateUtils';
import './DetailPanel.css';

export default function DetailPanel({ type, conversation, group, onClose }) {
  const [activeTab, setActiveTab] = useState('info');

  // Get pinned messages
  const pinnedMessages = useQuery(
    api.messages.getPinnedMessages,
    type === 'conversation' && conversation?._id
      ? { conversationId: conversation._id }
      : type === 'group' && group?._id
      ? { groupId: group._id }
      : 'skip'
  );

  if (type === 'conversation') {
    return (
      <aside className="detail-panel">
        <div className="detail-panel__header">
          <h3>Details</h3>
          <button
            className="detail-panel__close"
            onClick={onClose}
            aria-label="Close details"
          >
            <XMarkIcon className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <div className="detail-panel__content">
          <div className="detail-panel__profile">
            <div className="detail-panel__avatar">
              {conversation?.otherUser?.avatarUrl ? (
                <img src={conversation.otherUser.avatarUrl} alt="" />
              ) : (
                <span>
                  {conversation?.otherUser?.name?.[0] ||
                    conversation?.otherUser?.email?.[0] ||
                    '?'}
                </span>
              )}
              <UserPresence
                status={conversation?.otherUser?.presenceStatus || 'offline'}
                size="medium"
              />
            </div>
            <h4 className="detail-panel__name">
              {conversation?.otherUser?.name || conversation?.otherUser?.email}
            </h4>
            <p className="detail-panel__status">
              {conversation?.otherUser?.presenceStatus}
            </p>
          </div>

          <div className="detail-panel__tabs">
            <button
              className={`detail-panel__tab ${activeTab === 'info' ? 'detail-panel__tab--active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              Info
            </button>
            <button
              className={`detail-panel__tab ${activeTab === 'pinned' ? 'detail-panel__tab--active' : ''}`}
              onClick={() => setActiveTab('pinned')}
            >
              Pinned ({pinnedMessages?.length || 0})
            </button>
          </div>

          {activeTab === 'info' && (
            <div className="detail-panel__section">
              <h5>Email</h5>
              <p>{conversation?.otherUser?.email}</p>
              <h5>Conversation Started</h5>
              <p>{conversation?.createdAt && formatRelativeTime(conversation.createdAt)}</p>
            </div>
          )}

          {activeTab === 'pinned' && (
            <PinnedMessagesList messages={pinnedMessages} />
          )}
        </div>
      </aside>
    );
  }

  // Group details
  return (
    <aside className="detail-panel">
      <div className="detail-panel__header">
        <h3>Group Details</h3>
        <button
          className="detail-panel__close"
          onClick={onClose}
          aria-label="Close details"
        >
          <XMarkIcon className="w-5 h-5" aria-hidden />
        </button>
      </div>

      <div className="detail-panel__content">
        <div className="detail-panel__profile">
          <div className="detail-panel__avatar detail-panel__avatar--group">
            {group?.avatarUrl ? (
              <img src={group.avatarUrl} alt="" />
            ) : (
              <span>{group?.name?.[0] || '?'}</span>
            )}
          </div>
          <h4 className="detail-panel__name">{group?.name}</h4>
          {group?.description && (
            <p className="detail-panel__description">{group.description}</p>
          )}
        </div>

        <div className="detail-panel__tabs">
          <button
            className={`detail-panel__tab ${activeTab === 'members' ? 'detail-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Members ({group?.members?.length || 0})
          </button>
          <button
            className={`detail-panel__tab ${activeTab === 'pinned' ? 'detail-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('pinned')}
          >
            Pinned ({pinnedMessages?.length || 0})
          </button>
        </div>

        {activeTab === 'members' && (
          <MembersList members={group?.members} myRole={group?.myRole} groupId={group?._id} />
        )}

        {activeTab === 'pinned' && (
          <PinnedMessagesList messages={pinnedMessages} />
        )}
      </div>
    </aside>
  );
}

function MembersList({ members, myRole, groupId }) {
  const updateMemberRole = useMutation(api.groups.updateMemberRole);
  const removeMembers = useMutation(api.groups.removeMembers);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateMemberRole({ groupId, userId, role: newRole });
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleRemove = async (userId) => {
    if (window.confirm('Remove this member from the group?')) {
      try {
        await removeMembers({ groupId, memberIds: [userId] });
      } catch (error) {
        console.error('Failed to remove member:', error);
      }
    }
  };

  if (!members || members.length === 0) {
    return <p className="detail-panel__empty">No members</p>;
  }

  return (
    <ul className="detail-panel__members">
      {members.map((member) => (
        <li key={member._id} className="detail-panel__member">
          <div className="detail-panel__member-avatar">
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt="" />
            ) : (
              <span>{member.name?.[0] || member.email?.[0] || '?'}</span>
            )}
            <UserPresence status={member.presenceStatus} size="small" />
          </div>
          <div className="detail-panel__member-info">
            <span className="detail-panel__member-name">
              {member.name || member.email}
            </span>
            <span className="detail-panel__member-role">{member.role}</span>
          </div>
          {myRole === 'admin' && member.role !== 'admin' && (
            <div className="detail-panel__member-actions">
              <button
                className="detail-panel__member-action"
                onClick={() => handleRoleChange(member.userId, 'admin')}
                title="Make admin"
              >
                <ArrowUpIcon className="w-5 h-5" aria-hidden />
              </button>
              <button
                className="detail-panel__member-action"
                onClick={() => handleRemove(member.userId)}
                title="Remove"
              >
                <XMarkIcon className="w-5 h-5" aria-hidden />
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function PinnedMessagesList({ messages }) {
  const unpinMessage = useMutation(api.messages.pinMessage);

  const handleUnpin = async (messageId) => {
    try {
      await unpinMessage({ messageId, pin: false });
    } catch (error) {
      console.error('Failed to unpin:', error);
    }
  };

  if (!messages || messages.length === 0) {
    return <p className="detail-panel__empty">No pinned messages</p>;
  }

  return (
    <ul className="detail-panel__pinned">
      {messages.map((pin) => (
        <li key={pin._id} className="detail-panel__pinned-item">
          <div className="detail-panel__pinned-content">
            <span className="detail-panel__pinned-sender">
              {pin.message?.sender?.name || 'Unknown'}
            </span>
            <p className="detail-panel__pinned-text">{pin.message?.content}</p>
            <span className="detail-panel__pinned-time">
              {formatRelativeTime(pin.pinnedAt)}
            </span>
          </div>
          <button
            className="detail-panel__pinned-unpin"
            onClick={() => handleUnpin(pin.message?._id)}
            title="Unpin"
          >
            <MapPinIcon className="w-5 h-5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

DetailPanel.propTypes = {
  type: PropTypes.oneOf(['conversation', 'group']).isRequired,
  conversation: PropTypes.object,
  group: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};

MembersList.propTypes = {
  members: PropTypes.array,
  myRole: PropTypes.string,
  groupId: PropTypes.string,
};

PinnedMessagesList.propTypes = {
  messages: PropTypes.array,
};
