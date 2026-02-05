import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import PropTypes from 'prop-types';
import { formatDistanceToNow } from 'date-fns';
import './CallHistory.css';

/**
 * CallHistory - Shows call history for a conversation or group
 */
export default function CallHistory({ conversationId, groupId }) {
  const callHistory = useQuery(
    api.calls.getCallHistory,
    conversationId || groupId
      ? { conversationId, groupId, limit: 20 }
      : 'skip'
  );

  if (!callHistory || callHistory.length === 0) {
    return (
      <div className="call-history call-history--empty">
        <p>No call history</p>
      </div>
    );
  }

  return (
    <div className="call-history">
      <h3 className="call-history__title">Call History</h3>
      <ul className="call-history__list">
        {callHistory.map((call) => (
          <li key={call._id} className="call-history__item">
            <div className="call-history__icon">
              {call.type === 'video' ? '📹' : '📞'}
            </div>
            <div className="call-history__details">
              <span className="call-history__type">
                {call.type === 'video' ? 'Video' : 'Audio'} call
              </span>
              <span className="call-history__status">
                {call.status === 'missed' ? (
                  <span className="call-history__missed">Missed</span>
                ) : call.status === 'ended' ? (
                  <span className="call-history__duration">
                    {call.formattedDuration || 'Unknown duration'}
                  </span>
                ) : (
                  <span className="call-history__active">In progress</span>
                )}
              </span>
            </div>
            <div className="call-history__time">
              {formatDistanceToNow(new Date(call.createdAt), { addSuffix: true })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

CallHistory.propTypes = {
  conversationId: PropTypes.string,
  groupId: PropTypes.string,
};
