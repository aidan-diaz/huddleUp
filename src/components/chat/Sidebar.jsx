import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
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
  const { signOut } = useAuthActions();

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
        ☰
      </button>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <h1 className="sidebar__logo">HuddleUp</h1>
        <div className="sidebar__header-actions">
          <NotificationBell />
          <button 
            className="sidebar__toggle"
            onClick={onToggle}
            aria-label="Close sidebar"
          >
            ✕
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
