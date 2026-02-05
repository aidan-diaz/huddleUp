import { useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import PropTypes from 'prop-types';
import './AuthForm.css';

export default function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signIn } = useAuthActions();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('password', {
        email,
        password,
        flow: isSignUp ? 'signUp' : 'signIn',
        ...(isSignUp && name ? { name } : {}),
      });
      console.log('Sign in result:', result);
      
      // If signingIn is true, the auth state should update automatically
      // Keep loading state while waiting for auth to propagate
      if (result.signingIn) {
        console.log('Sign in successful, waiting for auth state to update...');
        // Don't set isLoading to false - let the Authenticated component handle it
        return;
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err.message || 'Authentication failed. Please try again.');
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
  };

  return (
    <div className="auth-form">
      <div className="auth-form__container">
        <div className="auth-form__header">
          <h1 className="auth-form__title">HuddleUp</h1>
          <p className="auth-form__subtitle">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form__form">
          {isSignUp && (
            <div className="auth-form__field">
              <label htmlFor="name" className="auth-form__label">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="auth-form__input"
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          )}

          <div className="auth-form__field">
            <label htmlFor="email" className="auth-form__label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-form__input"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-form__field">
            <label htmlFor="password" className="auth-form__label">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-form__input"
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <div className="auth-form__error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-form__submit btn btn--primary"
            disabled={isLoading}
          >
            {isLoading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="auth-form__footer">
          <p className="auth-form__switch">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              onClick={toggleMode}
              className="auth-form__switch-btn"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
