import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { format } from 'date-fns';
import PropTypes from 'prop-types';
import './MeetingRequests.css';

/**
 * MeetingRequests - Shows incoming and outgoing meeting requests
 */
export default function MeetingRequests() {
  const [activeTab, setActiveTab] = useState('incoming');
  
  const pendingRequests = useQuery(api.calendar.listPendingRequests);
  const sentRequests = useQuery(api.calendar.listSentRequests, {});
  
  const respondToRequest = useMutation(api.calendar.respondToRequest);
  const cancelRequest = useMutation(api.calendar.cancelRequest);
  
  const [respondingId, setRespondingId] = useState(null);

  const handleRespond = async (requestId, status) => {
    try {
      setRespondingId(requestId);
      await respondToRequest({ requestId, status });
    } catch (error) {
      console.error('Error responding to request:', error);
    } finally {
      setRespondingId(null);
    }
  };

  const handleCancel = async (requestId) => {
    if (!confirm('Cancel this meeting request?')) return;
    
    try {
      await cancelRequest({ requestId });
    } catch (error) {
      console.error('Error canceling request:', error);
    }
  };

  return (
    <div className="meeting-requests">
      <div className="meeting-requests__tabs">
        <button
          className={`meeting-requests__tab ${activeTab === 'incoming' ? 'meeting-requests__tab--active' : ''}`}
          onClick={() => setActiveTab('incoming')}
        >
          Incoming
          {pendingRequests && pendingRequests.length > 0 && (
            <span className="meeting-requests__badge">{pendingRequests.length}</span>
          )}
        </button>
        <button
          className={`meeting-requests__tab ${activeTab === 'outgoing' ? 'meeting-requests__tab--active' : ''}`}
          onClick={() => setActiveTab('outgoing')}
        >
          Sent
        </button>
      </div>

      <div className="meeting-requests__content">
        {activeTab === 'incoming' ? (
          <IncomingRequests
            requests={pendingRequests || []}
            onRespond={handleRespond}
            respondingId={respondingId}
          />
        ) : (
          <OutgoingRequests
            requests={sentRequests || []}
            onCancel={handleCancel}
          />
        )}
      </div>
    </div>
  );
}

/**
 * IncomingRequests - List of incoming meeting requests
 */
function IncomingRequests({ requests, onRespond, respondingId }) {
  if (requests.length === 0) {
    return (
      <div className="meeting-requests__empty">
        <p>No pending meeting requests</p>
      </div>
    );
  }

  return (
    <div className="meeting-requests__list">
      {requests.map((request) => (
        <div key={request._id} className="meeting-request-card">
          <div className="meeting-request-card__header">
            <div className="meeting-request-card__avatar">
              {request.requester?.avatarUrl ? (
                <img src={request.requester.avatarUrl} alt="" />
              ) : (
                <span>{request.requester?.name?.[0] || '?'}</span>
              )}
            </div>
            <div className="meeting-request-card__info">
              <span className="meeting-request-card__from">
                {request.requester?.name || request.requester?.email || 'Unknown'}
              </span>
              <span className="meeting-request-card__date">
                {format(new Date(request.createdAt), 'MMM d, yyyy')}
              </span>
            </div>
          </div>

          <h3 className="meeting-request-card__title">{request.title}</h3>
          
          {request.description && (
            <p className="meeting-request-card__description">{request.description}</p>
          )}

          <div className="meeting-request-card__time">
            <span>📅</span>
            <span>
              {format(new Date(request.proposedStartTime), 'EEEE, MMMM d, yyyy')}
            </span>
          </div>
          <div className="meeting-request-card__time">
            <span>🕒</span>
            <span>
              {format(new Date(request.proposedStartTime), 'h:mm a')} - {format(new Date(request.proposedEndTime), 'h:mm a')}
            </span>
          </div>

          <div className="meeting-request-card__actions">
            <button
              className="btn btn--secondary"
              onClick={() => onRespond(request._id, 'denied')}
              disabled={respondingId === request._id}
            >
              Decline
            </button>
            <button
              className="btn btn--primary"
              onClick={() => onRespond(request._id, 'approved')}
              disabled={respondingId === request._id}
            >
              {respondingId === request._id ? 'Processing...' : 'Accept'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

IncomingRequests.propTypes = {
  requests: PropTypes.array.isRequired,
  onRespond: PropTypes.func.isRequired,
  respondingId: PropTypes.string,
};

/**
 * OutgoingRequests - List of sent meeting requests
 */
function OutgoingRequests({ requests, onCancel }) {
  if (requests.length === 0) {
    return (
      <div className="meeting-requests__empty">
        <p>No sent meeting requests</p>
      </div>
    );
  }

  return (
    <div className="meeting-requests__list">
      {requests.map((request) => (
        <div key={request._id} className="meeting-request-card">
          <div className="meeting-request-card__header">
            <div className="meeting-request-card__avatar">
              {request.recipient?.avatarUrl ? (
                <img src={request.recipient.avatarUrl} alt="" />
              ) : (
                <span>{request.recipient?.name?.[0] || '?'}</span>
              )}
            </div>
            <div className="meeting-request-card__info">
              <span className="meeting-request-card__from">
                To: {request.recipient?.name || request.recipient?.email || 'Unknown'}
              </span>
              <span className="meeting-request-card__date">
                {format(new Date(request.createdAt), 'MMM d, yyyy')}
              </span>
            </div>
            <span className={`meeting-request-card__status meeting-request-card__status--${request.status}`}>
              {request.status}
            </span>
          </div>

          <h3 className="meeting-request-card__title">{request.title}</h3>
          
          {request.description && (
            <p className="meeting-request-card__description">{request.description}</p>
          )}

          <div className="meeting-request-card__time">
            <span>📅</span>
            <span>
              {format(new Date(request.proposedStartTime), 'EEEE, MMMM d, yyyy')}
            </span>
          </div>
          <div className="meeting-request-card__time">
            <span>🕒</span>
            <span>
              {format(new Date(request.proposedStartTime), 'h:mm a')} - {format(new Date(request.proposedEndTime), 'h:mm a')}
            </span>
          </div>

          {request.responseMessage && (
            <div className="meeting-request-card__response">
              <strong>Response:</strong> {request.responseMessage}
            </div>
          )}

          {request.status === 'pending' && (
            <div className="meeting-request-card__actions">
              <button
                className="btn btn--secondary"
                onClick={() => onCancel(request._id)}
              >
                Cancel Request
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

OutgoingRequests.propTypes = {
  requests: PropTypes.array.isRequired,
  onCancel: PropTypes.func.isRequired,
};
