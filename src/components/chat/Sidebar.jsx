import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { useClerk } from '@clerk/clerk-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Bars3Icon, XMarkIcon, ChatBubbleLeftRightIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { api } from '../../../convex/_generated/api';
import PropTypes from 'prop-types';
import ConversationList from './ConversationList';
import GroupList from './GroupList';
import UserSearch from './UserSearch';
import CreateGroupModal from './CreateGroupModal';
import NotificationBell from '../common/NotificationBell';
import UserPresence from '../common/UserPresence';
import './Sidebar.css';

export default function Sidebar({ isOpen, onToggle }) {
  const [activeTab, setActiveTab] = useState('conversations');
  const [showSearch, setShowSearch] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  
  const currentUser = useQuery(api.users.getCurrentUser);
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const isCalendarView = location.pathname === '/calendar';

  // Handle URL-based modal triggers from WelcomeView buttons
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new-chat') {
      setShowSearch(true);
      setSearchParams({}, { replace: true }); // Clear the param
    } else if (action === 'new-group') {
      setShowCreateGroup(true);
      setSearchParams({}, { replace: true }); // Clear the param
    }
  }, [searchParams, setSearchParams]);

  const handleSignOut = async () => {
    await signOut();
  };

  if (!isOpen) {
    return (
      <button 
        className="sidebar__toggle sidebar__toggle--collapsed"
        onClick={onToggle}
        aria-label="Open sidebar"
      >
        <Bars3Icon className="w-6 h-6" aria-hidden />
      </button>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <h1 
          className="sidebar__logo sidebar__logo--clickable"
          onClick={() => navigate('/')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/')}
        >
          HuddleUp
        </h1>
        <div className="sidebar__header-actions">
          <NotificationBell />
          <button 
            className="sidebar__toggle"
            onClick={onToggle}
            aria-label="Close sidebar"
          >
            <XMarkIcon className="w-5 h-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="sidebar__user">
        {currentUser ? (
          <div className="sidebar__user-info">
            <div className="sidebar__user-avatar">
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" />
              ) : (
                <span>{currentUser.name?.[0] || currentUser.email[0]}</span>
              )}
              <UserPresence status={currentUser.presenceStatus} size="small" />
            </div>
            <div className="sidebar__user-details">
              <span className="sidebar__user-name">
                {currentUser.name || currentUser.email}
              </span>
              <span className="sidebar__user-status">
                {currentUser.presenceStatus}
              </span>
            </div>
          </div>
        ) : (
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">Loading user...</span>
          </div>
        )}
        <button 
          className="sidebar__signout"
          onClick={handleSignOut}
          aria-label="Sign out"
        >
          Sign Out
        </button>
      </div>

      <div className="sidebar__actions">
        <button
          className="sidebar__action-btn"
          onClick={() => setShowSearch(true)}
        >
          + New Chat
        </button>
        <button
          className="sidebar__action-btn"
          onClick={() => setShowCreateGroup(true)}
        >
          + New Group
        </button>
      </div>

      <div className="sidebar__nav-links">
        <button
          className={`sidebar__nav-link ${!isCalendarView ? 'sidebar__nav-link--active' : ''}`}
          onClick={() => navigate('/')}
        >
          <ChatBubbleLeftRightIcon className="sidebar__nav-icon w-4 h-4" aria-hidden />
          Messages
        </button>
        <button
          className={`sidebar__nav-link ${isCalendarView ? 'sidebar__nav-link--active' : ''}`}
          onClick={() => navigate('/calendar')}
        >
          <CalendarIcon className="sidebar__nav-icon w-4 h-4" aria-hidden />
          Calendar
        </button>
      </div>

      <nav className="sidebar__tabs">
        <button
          className={`sidebar__tab ${activeTab === 'conversations' ? 'sidebar__tab--active' : ''}`}
          onClick={() => setActiveTab('conversations')}
        >
          Chats
        </button>
        <button
          className={`sidebar__tab ${activeTab === 'groups' ? 'sidebar__tab--active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          Groups
        </button>
      </nav>

      <div className="sidebar__content">
        {activeTab === 'conversations' ? (
          <ConversationList />
        ) : (
          <GroupList />
        )}
      </div>

      {showSearch && (
        <UserSearch onClose={() => setShowSearch(false)} />
      )}

      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} />
      )}
    </aside>
  );
}

Sidebar.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};
