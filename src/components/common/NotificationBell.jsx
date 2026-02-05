import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatRelativeTime } from '../../utils/dateUtils';
import './NotificationBell.css';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const notifications = useQuery(api.notifications.listNotifications, { limit: 10 });
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

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

  return (
    <div className="notification-bell">
      <button
        className="notification-bell__button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications ${unreadCount ? `(${unreadCount} unread)` : ''}`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-bell__badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="notification-bell__overlay"
            onClick={() => setIsOpen(false)}
          />
          <div className="notification-bell__dropdown">
            <div className="notification-bell__header">
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button
                  className="notification-bell__mark-read"
                  onClick={handleMarkAllRead}
                >
                  Mark all read
                </button>
              )}
            </div>
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
          </div>
        </>
      )}
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
      return '📅';
    case 'group_invite':
      return '👥';
    default:
      return '🔔';
  }
}
