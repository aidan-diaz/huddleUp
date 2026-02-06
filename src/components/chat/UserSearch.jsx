import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../convex/_generated/api';
import PropTypes from 'prop-types';
import UserPresence from '../common/UserPresence';
import LoadingSpinner from '../common/LoadingSpinner';
import './UserSearch.css';

export default function UserSearch({ onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const searchResults = useQuery(
    api.users.searchUsers,
    searchTerm.length >= 2 ? { searchTerm, limit: 10 } : 'skip'
  );
  const getOrCreateConversation = useMutation(api.conversations.getOrCreateConversation);

  const handleSelectUser = async (userId) => {
    setIsLoading(true);
    try {
      const conversationId = await getOrCreateConversation({ otherUserId: userId });
      navigate(`/conversation/${conversationId}`);
      onClose();
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="user-search__overlay" onClick={onClose}>
      <div className="user-search" onClick={(e) => e.stopPropagation()}>
        <div className="user-search__header">
          <h2>New Chat</h2>
          <button className="user-search__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="user-search__input-wrapper">
          <input
            type="text"
            className="user-search__input"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        <div className="user-search__results">
          {searchTerm.length < 2 ? (
            <p className="user-search__hint">
              Type at least 2 characters to search
            </p>
          ) : searchResults === undefined ? (
            <div className="user-search__loading">
              <LoadingSpinner />
            </div>
          ) : searchResults.length === 0 ? (
            <p className="user-search__empty">No users found</p>
          ) : (
            <ul className="user-search__list">
              {searchResults.map((user) => (
                <li key={user._id}>
                  <button
                    className="user-search__item"
                    onClick={() => handleSelectUser(user._id)}
                    disabled={isLoading}
                  >
                    <div className="user-search__avatar">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" />
                      ) : (
                        <span>{user.name?.[0] || user.email[0]}</span>
                      )}
                      <UserPresence status={user.presenceStatus} size="small" />
                    </div>
                    <div className="user-search__info">
                      <span className="user-search__name">
                        {user.name || user.email}
                      </span>
                      {user.name && (
                        <span className="user-search__email">{user.email}</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

UserSearch.propTypes = {
  onClose: PropTypes.func.isRequired,
};
