import { useNavigate, useSearchParams } from 'react-router-dom';
import './WelcomeView.css';

export default function WelcomeView() {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const handleNewChat = () => {
    setSearchParams({ action: 'new-chat' });
  };

  const handleNewGroup = () => {
    setSearchParams({ action: 'new-group' });
  };

  const handleVideoCalls = () => {
    // Video calls require an existing conversation
    // Open the new chat modal with a hint
    setSearchParams({ action: 'new-chat' });
  };

  const handleCalendar = () => {
    navigate('/calendar');
  };

  return (
    <div className="welcome-view">
      <div className="welcome-view__content">
        <h1 className="welcome-view__title">Welcome to HuddleUp</h1>
        <p className="welcome-view__subtitle">
          Select a conversation or start a new chat to begin messaging
        </p>
        <div className="welcome-view__features">
          <button 
            className="welcome-view__feature welcome-view__feature--interactive"
            onClick={handleNewChat}
          >
            <span className="welcome-view__feature-icon">💬</span>
            <div>
              <h3>Direct Messages</h3>
              <p>Chat one-on-one with your contacts</p>
            </div>
          </button>
          <button 
            className="welcome-view__feature welcome-view__feature--interactive"
            onClick={handleNewGroup}
          >
            <span className="welcome-view__feature-icon">👥</span>
            <div>
              <h3>Group Chats</h3>
              <p>Collaborate with multiple people at once</p>
            </div>
          </button>
          <button 
            className="welcome-view__feature welcome-view__feature--interactive"
            onClick={handleVideoCalls}
          >
            <span className="welcome-view__feature-icon">📞</span>
            <div>
              <h3>Video Calls</h3>
              <p>Start audio or video calls instantly</p>
            </div>
          </button>
          <button 
            className="welcome-view__feature welcome-view__feature--interactive"
            onClick={handleCalendar}
          >
            <span className="welcome-view__feature-icon">📅</span>
            <div>
              <h3>Calendar</h3>
              <p>Schedule meetings and manage your time</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
