import { useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import './AuthForm.css';

export default function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="auth-form">
      <div className="auth-form__container">
        <div className="auth-form__clerk">
          {isSignUp ? (
            <SignUp />
          ) : (
            <SignIn />
          )}
        </div>
      </div>
    </div>
  );
}
