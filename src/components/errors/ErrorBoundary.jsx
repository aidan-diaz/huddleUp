import { Component } from 'react';
import PropTypes from 'prop-types';
import { logError } from '../../utils/errorUtils';
import './ErrorBoundary.css';

/**
 * Error boundary component to catch and handle React errors
 * Provides a user-friendly fallback UI with retry functionality
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    
    // Log error to monitoring service
    logError(error, {
      componentStack: errorInfo?.componentStack,
      errorBoundary: this.props.name || 'ErrorBoundary',
    });
  }

  handleRetry = () => {
    this.setState((prevState) => ({ 
      hasError: false, 
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
    }));
    
    // Call optional onRetry callback
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ 
              error: this.state.error, 
              resetError: this.handleRetry 
            })
          : this.props.fallback;
      }

      const showReload = this.state.retryCount >= 2;
      const errorMessage = this.state.error?.message || 'An unexpected error occurred';

      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary__icon" aria-hidden="true">
            ⚠️
          </div>
          <h2 className="error-boundary__title">Something went wrong</h2>
          <p className="error-boundary__message">
            {this.props.level === 'critical' 
              ? "We're sorry, but the application encountered a critical error."
              : "We're sorry, but something unexpected happened."
            }
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <details className="error-boundary__details">
              <summary>Error Details</summary>
              <pre className="error-boundary__stack">
                {errorMessage}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}

          <div className="error-boundary__actions">
            {!showReload ? (
              <button
                className="btn btn--primary"
                onClick={this.handleRetry}
                type="button"
              >
                Try again
              </button>
            ) : (
              <>
                <button
                  className="btn btn--secondary"
                  onClick={this.handleRetry}
                  type="button"
                >
                  Try again
                </button>
                <button
                  className="btn btn--primary"
                  onClick={this.handleReload}
                  type="button"
                >
                  Reload page
                </button>
              </>
            )}
          </div>
          
          {showReload && (
            <p className="error-boundary__help">
              If the problem persists, please contact support.
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  name: PropTypes.string,
  level: PropTypes.oneOf(['normal', 'critical']),
  onRetry: PropTypes.func,
};

ErrorBoundary.defaultProps = {
  level: 'normal',
};

export default ErrorBoundary;
