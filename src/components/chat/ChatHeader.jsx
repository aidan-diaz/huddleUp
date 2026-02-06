import { useState } from 'react';
import PropTypes from 'prop-types';
import UserPresence from '../common/UserPresence';
import { useCall } from '../../hooks/useCall';
import { ScheduleMeetingModal } from '../calendar';
import './ChatHeader.css';

export default function ChatHeader({
  title,
  subtitle,
  type,
  avatarUrl,
  presenceStatus,
  conversationId,
  groupId,
  otherUserId,
  onShowDetails,
}) {
  const { startCall, isInCall } = useCall();
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const handleStartCall = async (callType) => {
    if (isInCall || isStartingCall) return;
    
    try {
      setIsStartingCall(true);
      await startCall({
        conversationId: type === 'conversation' ? conversationId : undefined,
        groupId: type === 'group' ? groupId : undefined,
        type: callType,
      });
    } catch (error) {
      console.error('Error starting call:', error);
    } finally {
      setIsStartingCall(false);
    }
  };

  return (
    <header className="chat-header">
      <div className="chat-header__info">
        <div className="chat-header__avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <span>{title?.[0] || '?'}</span>
          )}
          {presenceStatus && (
            <UserPresence status={presenceStatus} size="small" />
          )}
        </div>
        <div className="chat-header__text">
          <h2 className="chat-header__title">{title}</h2>
          <p className="chat-header__subtitle">
            {type === 'conversation' && presenceStatus ? (
              <span className={`chat-header__status chat-header__status--${presenceStatus}`}>
                {presenceStatus}
              </span>
            ) : (
              subtitle
            )}
          </p>
        </div>
      </div>

      <div className="chat-header__actions">
        {type === 'conversation' && otherUserId && (
          <button
            className="chat-header__action"
            title="Schedule meeting"
            aria-label="Schedule meeting"
            onClick={() => setShowScheduleModal(true)}
          >
            📅
          </button>
        )}
        <button
          className="chat-header__action"
          title="Start audio call"
          aria-label="Start audio call"
          onClick={() => handleStartCall('audio')}
          disabled={isInCall || isStartingCall}
        >
          📞
        </button>
        <button
          className="chat-header__action"
          title="Start video call"
          aria-label="Start video call"
          onClick={() => handleStartCall('video')}
          disabled={isInCall || isStartingCall}
        >
          📹
        </button>
        <button
          className="chat-header__action"
          onClick={onShowDetails}
          title="Show details"
          aria-label="Show chat details"
        >
          ℹ️
        </button>
      </div>

      {type === 'conversation' && otherUserId && (
        <ScheduleMeetingModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          recipientId={otherUserId}
          recipientName={title}
        />
      )}
    </header>
  );
}

ChatHeader.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  type: PropTypes.oneOf(['conversation', 'group']).isRequired,
  avatarUrl: PropTypes.string,
  presenceStatus: PropTypes.oneOf(['active', 'away', 'busy', 'inCall', 'offline']),
  conversationId: PropTypes.string,
  groupId: PropTypes.string,
  otherUserId: PropTypes.string,
  onShowDetails: PropTypes.func.isRequired,
};
