import './WelcomeView.css';

export default function WelcomeView() {
  return (
    <div className="welcome-view">
      <div className="welcome-view__content">
        <h1 className="welcome-view__title">Welcome to HuddleUp</h1>
        <p className="welcome-view__subtitle">
          Select a conversation or start a new chat to begin messaging
        </p>
        <div className="welcome-view__features">
          <div className="welcome-view__feature">
            <span className="welcome-view__feature-icon">💬</span>
            <div>
              <h3>Direct Messages</h3>
              <p>Chat one-on-one with your contacts</p>
            </div>
          </div>
          <div className="welcome-view__feature">
            <span className="welcome-view__feature-icon">👥</span>
            <div>
              <h3>Group Chats</h3>
              <p>Collaborate with multiple people at once</p>
            </div>
          </div>
          <div className="welcome-view__feature">
            <span className="welcome-view__feature-icon">📞</span>
            <div>
              <h3>Video Calls</h3>
              <p>Start audio or video calls instantly</p>
            </div>
          </div>
          <div className="welcome-view__feature">
            <span className="welcome-view__feature-icon">📅</span>
            <div>
              <h3>Calendar</h3>
              <p>Schedule meetings and manage your time</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
