export type Sender = 'bot' | 'user';

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  options?: string[];
}

export interface LeadData {
  id: string;
  name: string;
  intent: string;
  score: number;
  maturity: 'Frio' | 'Morno' | 'Quente' | 'Não Classificado';
  details: Record<string, string>;
  timestamp: number;
}

export type StepAction = {
  nextStep: string;
  botText: string;
  options?: string[];
  scoreIncrement?: number;
  dataKey?: string;
  dataValue?: string;
};
