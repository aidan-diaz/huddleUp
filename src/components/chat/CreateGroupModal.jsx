import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../convex/_generated/api';
import PropTypes from 'prop-types';
import LoadingSpinner from '../common/LoadingSpinner';
import './CreateGroupModal.css';

export default function CreateGroupModal({ onClose }) {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const searchResults = useQuery(
    api.users.searchUsers,
    searchTerm.length >= 2 ? { searchTerm, limit: 10 } : 'skip'
  );
  const createGroup = useMutation(api.groups.createGroup);

  const handleSelectMember = (user) => {
    if (!selectedMembers.find((m) => m._id === user._id)) {
      setSelectedMembers([...selectedMembers, user]);
    }
    setSearchTerm('');
  };

  const handleRemoveMember = (userId) => {
    setSelectedMembers(selectedMembers.filter((m) => m._id !== userId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const groupId = await createGroup({
        name: groupName,
        description: description || undefined,
        memberIds: selectedMembers.map((m) => m._id),
      });
      navigate(`/group/${groupId}`);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create group');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="create-group__overlay" onClick={onClose}>
      <div className="create-group" onClick={(e) => e.stopPropagation()}>
        <div className="create-group__header">
          <h2>Create Group</h2>
          <button className="create-group__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-group__form">
          <div className="create-group__field">
            <label htmlFor="groupName">Group Name *</label>
            <input
              id="groupName"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name"
              required
            />
          </div>

          <div className="create-group__field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group about?"
              rows={2}
            />
          </div>

          <div className="create-group__field">
            <label>Add Members</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users to add..."
            />

            {searchTerm.length >= 2 && (
              <div className="create-group__search-results">
                {searchResults === undefined ? (
                  <LoadingSpinner size="small" />
                ) : searchResults.length === 0 ? (
                  <p className="create-group__no-results">No users found</p>
                ) : (
                  <ul>
                    {searchResults
                      .filter((u) => !selectedMembers.find((m) => m._id === u._id))
                      .map((user) => (
                        <li key={user._id}>
                          <button
                            type="button"
                            onClick={() => handleSelectMember(user)}
                          >
                            {user.name || user.email}
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {selectedMembers.length > 0 && (
            <div className="create-group__selected">
              <label>Selected Members ({selectedMembers.length})</label>
              <div className="create-group__tags">
                {selectedMembers.map((member) => (
                  <span key={member._id} className="create-group__tag">
                    {member.name || member.email}
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member._id)}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && <div className="create-group__error">{error}</div>}

          <div className="create-group__actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

CreateGroupModal.propTypes = {
  onClose: PropTypes.func.isRequired,
};
