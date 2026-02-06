import { useQuery } from 'convex/react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../convex/_generated/api';
import LoadingSpinner from '../common/LoadingSpinner';
import { formatRelativeTime } from '../../utils/dateUtils';
import './GroupList.css';

export default function GroupList() {
  const groups = useQuery(api.groups.listGroups);
  const navigate = useNavigate();
  const { groupId } = useParams();

  if (groups === undefined) {
    return (
      <div className="group-list__loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="group-list__empty">
        <p>No groups yet</p>
        <p className="group-list__empty-hint">
          Create a group to chat with multiple people
        </p>
      </div>
    );
  }

  return (
    <ul className="group-list" role="list">
      {groups.map((group) => (
        <li key={group._id}>
          <button
            className={`group-list__item ${
              groupId === group._id ? 'group-list__item--active' : ''
            }`}
            onClick={() => navigate(`/group/${group._id}`)}
          >
            <div className="group-list__avatar">
              {group.avatarUrl ? (
                <img src={group.avatarUrl} alt="" />
              ) : (
                <span>{group.name[0]}</span>
              )}
            </div>
            <div className="group-list__content">
              <div className="group-list__header">
                <span className="group-list__name">{group.name}</span>
                {group.lastMessage && (
                  <span className="group-list__time">
                    {formatRelativeTime(group.lastMessage.createdAt)}
                  </span>
                )}
              </div>
              <div className="group-list__meta">
                <span className="group-list__members">
                  {group.memberCount} members
                </span>
                {group.myRole === 'admin' && (
                  <span className="group-list__role">Admin</span>
                )}
              </div>
              {group.lastMessage && (
                <p className="group-list__preview">
                  {group.lastMessage.type === 'file'
                    ? '📎 File attachment'
                    : group.lastMessage.type === 'call'
                    ? '📞 Call'
                    : group.lastMessage.content}
                </p>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
