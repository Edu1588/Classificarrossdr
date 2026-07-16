import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LeadProvider } from './context/LeadContext';
import ChatPage from './pages/ChatPage';
import LeadsPage from './pages/LeadsPage';

export default function App() {
  return (
    <LeadProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/leads" element={<LeadsPage />} />
        </Routes>
      </BrowserRouter>
    </LeadProvider>
  );
}
