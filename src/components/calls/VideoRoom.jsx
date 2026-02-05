import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks,
  useRoomContext,
  useParticipants,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import PropTypes from 'prop-types';
import '@livekit/components-styles';
import './VideoRoom.css';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://localhost:7880';

/**
 * Main VideoRoom component - handles the LiveKit video call UI
 */
export default function VideoRoom({ callId, token, roomName, callType, onLeave }) {
  const navigate = useNavigate();
  const leaveCall = useMutation(api.calls.leaveCall);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const handleDisconnect = useCallback(async () => {
    try {
      await leaveCall({ callId });
    } catch (err) {
      console.error('Error leaving call:', err);
    }
    onLeave?.();
  }, [callId, leaveCall, onLeave]);

  const handleError = useCallback((err) => {
    console.error('LiveKit error:', err);
    setError(err.message || 'Connection error');
  }, []);

  // Check if LiveKit URL is configured
  if (!LIVEKIT_URL || LIVEKIT_URL === 'wss://localhost:7880') {
    return (
      <div className="video-room video-room--fallback">
        <div className="video-room__fallback-content">
          <div className="video-room__fallback-icon">
            {callType === 'video' ? '📹' : '📞'}
          </div>
          <h2>{callType === 'video' ? 'Video' : 'Audio'} Call</h2>
          <p className="video-room__fallback-message">
            LiveKit server not configured. In production, configure <code>VITE_LIVEKIT_URL</code> to enable video calls.
          </p>
          <div className="video-room__fallback-info">
            <p>Room: {roomName}</p>
            <p>Call ID: {callId}</p>
          </div>
          <button className="btn btn--primary" onClick={handleDisconnect}>
            End Call
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-room">
      <LiveKitRoom
        serverUrl={LIVEKIT_URL}
        token={token}
        connect={true}
        video={callType === 'video'}
        audio={true}
        onConnected={() => setIsConnected(true)}
        onDisconnected={handleDisconnect}
        onError={handleError}
        data-lk-theme="default"
        className="video-room__livekit"
      >
        {error ? (
          <div className="video-room__error">
            <h3>Connection Error</h3>
            <p>{error}</p>
            <button className="btn btn--primary" onClick={handleDisconnect}>
              Leave Call
            </button>
          </div>
        ) : (
          <>
            <RoomAudioRenderer />
            <VideoCallContent 
              callType={callType} 
              roomName={roomName}
              onLeave={handleDisconnect}
            />
          </>
        )}
      </LiveKitRoom>
    </div>
  );
}

VideoRoom.propTypes = {
  callId: PropTypes.string.isRequired,
  token: PropTypes.string.isRequired,
  roomName: PropTypes.string.isRequired,
  callType: PropTypes.oneOf(['audio', 'video']).isRequired,
  onLeave: PropTypes.func,
};

/**
 * Inner component that uses LiveKit hooks (must be inside LiveKitRoom)
 */
function VideoCallContent({ callType, roomName, onLeave }) {
  const room = useRoomContext();
  const participants = useParticipants();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  return (
    <div className="video-room__content">
      <div className="video-room__header">
        <span className="video-room__room-info">
          {callType === 'video' ? '📹' : '📞'} {participants.length} participant{participants.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="video-room__grid">
        {callType === 'video' ? (
          <GridLayout tracks={tracks} className="video-room__grid-layout">
            <ParticipantTile />
          </GridLayout>
        ) : (
          <AudioCallView participants={participants} />
        )}
      </div>

      <ControlBar 
        controls={{
          microphone: true,
          camera: callType === 'video',
          screenShare: callType === 'video',
          leave: true,
          chat: false,
        }}
        className="video-room__controls"
      />
    </div>
  );
}

VideoCallContent.propTypes = {
  callType: PropTypes.oneOf(['audio', 'video']).isRequired,
  roomName: PropTypes.string.isRequired,
  onLeave: PropTypes.func,
};

/**
 * Audio-only call view showing participant avatars
 */
function AudioCallView({ participants }) {
  return (
    <div className="audio-call-view">
      <div className="audio-call-view__participants">
        {participants.map((participant) => (
          <div key={participant.identity} className="audio-call-view__participant">
            <div className="audio-call-view__avatar">
              <span>{participant.name?.[0] || participant.identity?.[0] || '?'}</span>
            </div>
            <span className="audio-call-view__name">
              {participant.name || participant.identity}
            </span>
            {participant.isSpeaking && (
              <span className="audio-call-view__speaking">Speaking...</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

AudioCallView.propTypes = {
  participants: PropTypes.array.isRequired,
};
