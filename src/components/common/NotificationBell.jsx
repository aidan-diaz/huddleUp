import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { createPortal } from 'react-dom';
import { api } from '../../../convex/_generated/api';
import { formatRelativeTime } from '../../utils/dateUtils';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import './NotificationBell.css';

const DROPDOWN_WIDTH = 320;
const DROPDOWN_GAP = 4;
const STORAGE_KEY_SOUND = 'huddleup_notification_sound';

function getSoundPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SOUND);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

/**
 * Play a short notification beep using Web Audio API (no audio file needed).
 * May be blocked until the user has interacted with the page (browser autoplay policy).
 */
function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Ignore if audio is not allowed (e.g. autoplay policy)
  }
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const prevUnreadCountRef = useRef(undefined);
  const [soundEnabled, setSoundEnabled] = useState(getSoundPreference);

  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const notifications = useQuery(api.notifications.listNotifications, { limit: 10 });
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  const {
    isSupported,
    isSubscribed,
    isLoading: pushLoading,
    error: pushError,
    toggleSubscription,
  } = usePushNotifications();

  // Play sound when unread count increases (skip initial load), only if user has sound on
  useEffect(() => {
    if (unreadCount === undefined || !soundEnabled) return;
    const prev = prevUnreadCountRef.current;
    prevUnreadCountRef.current = unreadCount;
    if (prev !== undefined && unreadCount > prev && unreadCount > 0) {
      playNotificationSound();
    }
  }, [unreadCount, soundEnabled]);

  const handleSoundToggle = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY_SOUND, String(next));
    } catch {
      // ignore
    }
  };

  // Position dropdown with fixed coordinates so it's not clipped by sidebar overflow
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const top = rect.bottom + DROPDOWN_GAP;
    let left = rect.left;
    // Keep dropdown in viewport: don't overflow right or left
    const maxLeft = window.innerWidth - DROPDOWN_WIDTH;
    left = Math.min(left, Math.max(0, maxLeft));
    setDropdownPosition({ top, left });
  }, [isOpen]);

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead({ notificationId: notification._id });
    }
    // Navigate based on notification type/reference
    setIsOpen(false);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const dropdownContent = isOpen ? (
    <>
      <div
        className="notification-bell__overlay"
        onClick={() => setIsOpen(false)}
      />
      <div
        className="notification-bell__dropdown"
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: DROPDOWN_WIDTH,
        }}
      >
            <div className="notification-bell__header">
              <h3>Notifications</h3>
              <div className="notification-bell__header-actions">
                {unreadCount > 0 && (
                  <button
                    className="notification-bell__mark-read"
                    onClick={handleMarkAllRead}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  className="notification-bell__settings-btn"
                  onClick={() => setShowSettings(!showSettings)}
                  aria-label="Notification settings"
                >
                  ⚙️
                </button>
              </div>
            </div>

            {showSettings ? (
              <div className="notification-bell__settings">
                <h4>Push Notifications</h4>
                {!isSupported ? (
                  <p className="notification-bell__settings-info">
                    Push notifications are not supported in this browser.
                  </p>
                ) : (
                  <>
                    <div className="notification-bell__settings-row">
                      <span>Play sound for new notifications</span>
                      <button
                        className={`notification-bell__toggle ${soundEnabled ? 'notification-bell__toggle--on' : ''}`}
                        onClick={handleSoundToggle}
                        aria-label={soundEnabled ? 'Mute notification sound' : 'Enable notification sound'}
                      >
                        <span className="notification-bell__toggle-slider" />
                      </button>
                    </div>
                    <div className="notification-bell__settings-row">
                      <span>Enable push notifications</span>
                      <button
                        className={`notification-bell__toggle ${isSubscribed ? 'notification-bell__toggle--on' : ''}`}
                        onClick={toggleSubscription}
                        disabled={pushLoading}
                        aria-label={isSubscribed ? 'Disable push notifications' : 'Enable push notifications'}
                      >
                        <span className="notification-bell__toggle-slider" />
                      </button>
                    </div>
                    {pushError && (
                      <p className="notification-bell__settings-error">{pushError}</p>
                    )}
                    <p className="notification-bell__settings-info">
                      {isSubscribed 
                        ? 'You will receive push notifications for new messages and calls when the tab is in the background or closed. Check your browser and OS notification settings if you don’t see them.'
                        : 'Enable to receive notifications even when the app is closed.'}
                    </p>
                  </>
                )}
                <button
                  className="notification-bell__back-btn"
                  onClick={() => setShowSettings(false)}
                >
                  ← Back to notifications
                </button>
              </div>
            ) : (
              <div className="notification-bell__list">
                {notifications === undefined ? (
                  <div className="notification-bell__loading">Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className="notification-bell__empty">No notifications</div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification._id}
                      className={`notification-bell__item ${
                        !notification.isRead ? 'notification-bell__item--unread' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="notification-bell__item-icon">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="notification-bell__item-content">
                        <p className="notification-bell__item-title">
                          {notification.title}
                        </p>
                        <p className="notification-bell__item-body">
                          {notification.body}
                        </p>
                        <span className="notification-bell__item-time">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
      </div>
    </>
  ) : null;

  return (
    <div className="notification-bell">
      <button
        ref={buttonRef}
        className="notification-bell__button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications ${unreadCount ? `(${unreadCount} unread)` : ''}`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-bell__badge">{unreadCount}</span>
        )}
      </button>
      {createPortal(dropdownContent, document.body)}
    </div>
  );
}

function getNotificationIcon(type) {
  switch (type) {
    case 'message':
      return '💬';
    case 'call':
      return '📞';
    case 'meeting_request':
    case 'meeting_response':
    case 'meeting_update_request':
      return '📅';
    case 'group_invite':
      return '👥';
    default:
      return '🔔';
  }
}
