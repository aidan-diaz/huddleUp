import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import ChatView from './ChatView';
import WelcomeView from './WelcomeView';
import { CalendarView } from '../calendar';
import './ChatLayout.css';

export default function ChatLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="chat-layout">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <main className="chat-layout__main">
        <Routes>
          <Route path="/" element={<WelcomeView />} />
          <Route path="/conversation/:conversationId" element={<ChatView type="conversation" />} />
          <Route path="/group/:groupId" element={<ChatView type="group" />} />
          <Route path="/calendar" element={<CalendarView />} />
        </Routes>
      </main>
    </div>
  );
}
