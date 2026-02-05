import PropTypes from 'prop-types';
import './LoadingSpinner.css';

export default function LoadingSpinner({ size = 'medium', className = '' }) {
  return (
    <div
      className={`loading-spinner loading-spinner--${size} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <div className="loading-spinner__circle" />
    </div>
  );
}

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  className: PropTypes.string,
};
