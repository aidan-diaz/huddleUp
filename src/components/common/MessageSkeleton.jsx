import PropTypes from 'prop-types';
import './MessageSkeleton.css';

/**
 * Skeleton loader for message items during loading states
 */
export default function MessageSkeleton({ count = 5 }) {
  return (
    <div className="message-skeleton" aria-hidden="true" aria-label="Loading messages">
      {Array.from({ length: count }).map((_, index) => {
        const isOwn = index % 3 === 0;
        const hasAvatar = index % 2 === 0;
        const shortMessage = index % 4 === 0;

        return (
          <div
            key={index}
            className={`message-skeleton__item ${isOwn ? 'message-skeleton__item--own' : ''} ${hasAvatar ? 'message-skeleton__item--with-avatar' : ''}`}
          >
            {!isOwn && hasAvatar && (
              <div className="message-skeleton__avatar skeleton-pulse" />
            )}
            <div className="message-skeleton__bubble">
              {!isOwn && hasAvatar && (
                <div className="message-skeleton__sender skeleton-pulse" />
              )}
              <div
                className={`message-skeleton__text skeleton-pulse ${shortMessage ? 'message-skeleton__text--short' : ''}`}
              />
              <div className="message-skeleton__time skeleton-pulse" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

MessageSkeleton.propTypes = {
  count: PropTypes.number,
};
