import React, { createContext, useState, useContext, useEffect } from 'react';
import { LeadData } from '../types';

interface LeadContextType {
  leads: LeadData[];
  addOrUpdateLead: (lead: LeadData) => void;
  currentLead: LeadData;
  setCurrentLead: React.Dispatch<React.SetStateAction<LeadData>>;
  createNewLeadSession: () => void;
}

export const LeadContext = createContext<LeadContextType | undefined>(undefined);

export const LeadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [leads, setLeads] = useState<LeadData[]>(() => {
    const saved = localStorage.getItem('classificarros_leads');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const generateInitialLead = (): LeadData => ({
    id: `lead-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: 'Desconhecido',
    intent: 'Não definido',
    score: 0,
    maturity: 'Não Classificado',
    details: {},
    timestamp: Date.now(),
  });

  const [currentLead, setCurrentLead] = useState<LeadData>(generateInitialLead());

  useEffect(() => {
    localStorage.setItem('classificarros_leads', JSON.stringify(leads));
  }, [leads]);

  const addOrUpdateLead = (lead: LeadData) => {
    setLeads((prev) => {
      const existingIdx = prev.findIndex(l => l.id === lead.id);
      if (existingIdx >= 0) {
        const newLeads = [...prev];
        newLeads[existingIdx] = lead;
        return newLeads;
      } else {
        return [lead, ...prev];
      }
    });
  };

  const createNewLeadSession = () => {
    setCurrentLead(generateInitialLead());
  };

  return (
    <LeadContext.Provider value={{ leads, addOrUpdateLead, currentLead, setCurrentLead, createNewLeadSession }}>
      {children}
    </LeadContext.Provider>
  );
};

export const useLead = () => {
  const context = useContext(LeadContext);
  if (context === undefined) {
    throw new Error('useLead must be used within a LeadProvider');
  }
  return context;
};
