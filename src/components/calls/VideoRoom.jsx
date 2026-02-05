import { useState, useEffect, useCallback, useRef } from 'react';
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
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { BackgroundProcessor, supportsBackgroundProcessors } from '@livekit/track-processors';
import PropTypes from 'prop-types';
import '@livekit/components-styles';
import './VideoRoom.css';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://localhost:7880';

// Virtual background images - using public domain images
const VIRTUAL_BACKGROUNDS = [
  {
    id: 'blur',
    name: 'Blur',
    type: 'blur',
    icon: '🔵',
  },
  {
    id: 'office',
    name: 'Office',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80',
    icon: '🏢',
  },
  {
    id: 'nature',
    name: 'Nature',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80',
    icon: '🌲',
  },
  {
    id: 'beach',
    name: 'Beach',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80',
    icon: '🏖️',
  },
  {
    id: 'space',
    name: 'Space',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1462332420958-a05d1e002413?w=1920&q=80',
    icon: '🌌',
  },
];

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
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const [backgroundMode, setBackgroundMode] = useState('none');
  const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);
  const [backgroundError, setBackgroundError] = useState(null);
  const processorRef = useRef(null);
  const hasAppliedDefaultBlur = useRef(false);

  // Cleanup processor on unmount
  useEffect(() => {
    return () => {
      if (processorRef.current) {
        processorRef.current.destroy?.();
        processorRef.current = null;
      }
    };
  }, []);

  // Find local camera track from tracks array
  const localCameraTrack = tracks.find(
    (t) => t.participant?.identity === localParticipant?.identity && 
           t.source === Track.Source.Camera &&
           t.publication?.track
  )?.publication?.track;

  // Auto-apply blur by default when camera becomes available
  useEffect(() => {
    if (callType !== 'video' || hasAppliedDefaultBlur.current) return;
    if (!supportsBackgroundProcessors()) return;
    if (!localCameraTrack) return;
    
    hasAppliedDefaultBlur.current = true;
    
    // Apply blur in the background (don't block or show errors for auto-apply)
    const applyDefaultBlur = async () => {
      try {
        const processor = BackgroundProcessor({
          mode: 'background-blur',
          blurRadius: 15,
        });
        await localCameraTrack.setProcessor(processor);
        processorRef.current = processor;
        setBackgroundMode('blur');
        console.log('Auto-applied background blur');
      } catch (err) {
        console.warn('Failed to auto-apply background blur:', err);
        // Silent fail for auto-apply - user can manually try from menu
      }
    };
    
    applyDefaultBlur();
  }, [callType, localCameraTrack]);

  // Apply background effect
  const applyBackground = useCallback(async (background) => {
    if (!localParticipant || callType !== 'video') return;

    setBackgroundError(null);

    // Check browser support first
    if (!supportsBackgroundProcessors()) {
      setBackgroundError('Virtual backgrounds are not supported in your browser. Try Chrome or Edge.');
      return;
    }

    const cameraPublication = localParticipant.getTrackPublication(Track.Source.Camera);
    const cameraTrack = cameraPublication?.track;
    
    if (!cameraTrack) {
      setBackgroundError('Please enable your camera first to use virtual backgrounds.');
      return;
    }

    try {
      // Remove existing processor if any
      if (processorRef.current) {
        await cameraTrack.stopProcessor();
        processorRef.current = null;
      }

      if (background === 'none') {
        setBackgroundMode('none');
        return;
      }

      let processor;
      
      if (background === 'blur') {
        // BackgroundProcessor is a function, not a class
        processor = BackgroundProcessor({
          mode: 'background-blur',
          blurRadius: 15,
        });
      } else {
        // Virtual background with image
        const bg = VIRTUAL_BACKGROUNDS.find(b => b.id === background);
        if (bg && bg.type === 'image') {
          processor = BackgroundProcessor({
            mode: 'virtual-background',
            imagePath: bg.url,
          });
        }
      }

      if (processor) {
        await cameraTrack.setProcessor(processor);
        processorRef.current = processor;
        setBackgroundMode(background);
      }
    } catch (err) {
      console.error('Error applying background:', err);
      // Provide user-friendly error message
      if (err.message?.includes('WebGL') || err.message?.includes('GPU')) {
        setBackgroundError('Virtual backgrounds require WebGL support. Please try a different browser.');
      } else if (err.message?.includes('model') || err.message?.includes('load')) {
        setBackgroundError('Failed to load background processor. Please check your internet connection.');
      } else {
        setBackgroundError(`Failed to apply background: ${err.message || 'Unknown error'}`);
      }
      setBackgroundMode('none');
    }
  }, [localParticipant, callType]);

  const handleBackgroundSelect = (bgId) => {
    applyBackground(bgId);
    setShowBackgroundMenu(false);
  };

  return (
    <div className="video-room__content">
      <div className="video-room__header">
        <span className="video-room__room-info">
          {callType === 'video' ? '📹' : '📞'} {participants.length} participant{participants.length !== 1 ? 's' : ''}
        </span>
        
        {/* Background selector button - only for video calls */}
        {callType === 'video' && (
          <div className="video-room__background-control">
            <button
              className={`video-room__bg-btn ${backgroundMode !== 'none' ? 'video-room__bg-btn--active' : ''}`}
              onClick={() => setShowBackgroundMenu(!showBackgroundMenu)}
              title="Change background"
            >
              🖼️ Background
            </button>
            
            {showBackgroundMenu && (
              <div className="video-room__bg-menu">
                {backgroundError && (
                  <div className="video-room__bg-error">
                    {backgroundError}
                  </div>
                )}
                <button
                  className={`video-room__bg-option ${backgroundMode === 'none' ? 'video-room__bg-option--selected' : ''}`}
                  onClick={() => handleBackgroundSelect('none')}
                >
                  <span className="video-room__bg-icon">❌</span>
                  <span>None</span>
                </button>
                {VIRTUAL_BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    className={`video-room__bg-option ${backgroundMode === bg.id ? 'video-room__bg-option--selected' : ''}`}
                    onClick={() => handleBackgroundSelect(bg.id)}
                  >
                    <span className="video-room__bg-icon">{bg.icon}</span>
                    <span>{bg.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
