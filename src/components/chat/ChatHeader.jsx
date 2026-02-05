import PropTypes from 'prop-types';
import UserPresence from '../common/UserPresence';
import './ChatHeader.css';

export default function ChatHeader({
  title,
  subtitle,
  type,
  avatarUrl,
  presenceStatus,
  onShowDetails,
}) {
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
        {type === 'conversation' && (
          <>
            <button
              className="chat-header__action"
              title="Start audio call"
              aria-label="Start audio call"
            >
              📞
            </button>
            <button
              className="chat-header__action"
              title="Start video call"
              aria-label="Start video call"
            >
              📹
            </button>
          </>
        )}
        <button
          className="chat-header__action"
          onClick={onShowDetails}
          title="Show details"
          aria-label="Show chat details"
        >
          ℹ️
        </button>
      </div>
    </header>
  );
}

ChatHeader.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  type: PropTypes.oneOf(['conversation', 'group']).isRequired,
  avatarUrl: PropTypes.string,
  presenceStatus: PropTypes.oneOf(['active', 'away', 'busy', 'inCall', 'offline']),
  onShowDetails: PropTypes.func.isRequired,
};
