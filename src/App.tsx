import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LeadProvider } from './context/LeadContext';
import HomePage from './pages/HomePage';
import LeadsPage from './pages/LeadsPage';

export default function App() {
  return (
    <LeadProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/leads" element={<LeadsPage />} />
        </Routes>
      </BrowserRouter>
    </LeadProvider>
  );
}
