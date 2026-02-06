import PropTypes from 'prop-types';
import './UserPresence.css';

const statusColors = {
  active: 'var(--color-success)',
  away: 'var(--color-warning)',
  busy: 'var(--color-error)',
  inCall: 'var(--color-primary)',
  offline: 'var(--color-text-muted)',
};

export default function UserPresence({ status, size = 'medium', showLabel = false }) {
  return (
    <div className={`user-presence user-presence--${size}`}>
      <span
        className="user-presence__dot"
        style={{ backgroundColor: statusColors[status] || statusColors.offline }}
        title={status}
      />
      {showLabel && (
        <span className="user-presence__label">{status}</span>
      )}
    </div>
  );
}

UserPresence.propTypes = {
  status: PropTypes.oneOf(['active', 'away', 'busy', 'inCall', 'offline']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  showLabel: PropTypes.bool,
};
