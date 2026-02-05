import { useState, useEffect } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import PropTypes from 'prop-types';
import './IncomingCallModal.css';

/**
 * IncomingCallModal - Shows incoming call notifications and allows accept/decline
 */
export default function IncomingCallModal({ onAnswer }) {
  const incomingCalls = useQuery(api.calls.getIncomingCalls);
  const joinCall = useAction(api.calls.joinCall);
  const endCall = useMutation(api.calls.endCall);
  const [answeringCallId, setAnsweringCallId] = useState(null);

  // Get the first incoming call (we'll handle one at a time)
  const incomingCall = incomingCalls?.[0];

  const handleAnswer = async (call) => {
    try {
      setAnsweringCallId(call._id);
      const result = await joinCall({ callId: call._id });
      onAnswer?.({
        callId: call._id,
        token: result.token,
        roomName: result.roomName,
        callType: call.type,
      });
    } catch (error) {
      console.error('Error answering call:', error);
      setAnsweringCallId(null);
    }
  };

  const handleDecline = async (call) => {
    try {
      await endCall({ callId: call._id });
    } catch (error) {
      console.error('Error declining call:', error);
    }
  };

  if (!incomingCall) {
    return null;
  }

  const isAnswering = answeringCallId === incomingCall._id;

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call">
        <div className="incoming-call__content">
          <div className="incoming-call__icon">
            {incomingCall.type === 'video' ? '📹' : '📞'}
          </div>
          
          <div className="incoming-call__avatar">
            {incomingCall.initiator?.avatarUrl ? (
              <img src={incomingCall.initiator.avatarUrl} alt="" />
            ) : (
              <span>{incomingCall.initiator?.name?.[0] || '?'}</span>
            )}
          </div>

          <h2 className="incoming-call__title">Incoming {incomingCall.type} call</h2>
          <p className="incoming-call__caller">
            {incomingCall.initiator?.name || incomingCall.initiator?.email || 'Unknown'}
          </p>

          <div className="incoming-call__actions">
            <button
              className="incoming-call__btn incoming-call__btn--decline"
              onClick={() => handleDecline(incomingCall)}
              disabled={isAnswering}
              aria-label="Decline call"
            >
              <span>✕</span>
              Decline
            </button>
            <button
              className="incoming-call__btn incoming-call__btn--accept"
              onClick={() => handleAnswer(incomingCall)}
              disabled={isAnswering}
              aria-label="Accept call"
            >
              {isAnswering ? (
                <>
                  <span className="incoming-call__spinner"></span>
                  Connecting...
                </>
              ) : (
                <>
                  <span>{incomingCall.type === 'video' ? '📹' : '📞'}</span>
                  Accept
                </>
              )}
            </button>
          </div>
        </div>

        <div className="incoming-call__ring"></div>
      </div>
    </div>
  );
}

IncomingCallModal.propTypes = {
  onAnswer: PropTypes.func,
};
