import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, User, Send, Car, RotateCcw } from 'lucide-react';
import { Message } from '../types';
import { calculateMaturity } from '../engine';
import { useLead } from '../context/LeadContext';

export default function ChatPage() {
  const { currentLead, setCurrentLead, addOrUpdateLead, createNewLeadSession } = useLead();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-0',
      sender: 'bot',
      text: 'Olá! Seja bem-vindo à Classificarros.\n\nPara que eu consiga te atender melhor, qual o seu nome?',
    },
  ]);
  const [step, setStep] = useState<string>('START');
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: `msg-${Date.now()}`, sender: 'user', text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: newMessages,
          currentState: step,
          leadData: currentLead
        }),
      });
      const data = await response.json();
      
      if (data.isOffensive) {
         setMessages((prev) => [...prev, {
            id: `msg-${Date.now() + 1}`,
            sender: 'bot',
            text: data.botText || "Por favor, vamos manter o respeito na nossa conversa. Como posso ajudar com seu carro?"
         }]);
         setIsTyping(false);
         return;
      }

      const action = data;
      
      const newScore = currentLead.score + (action.scoreIncrement || 0);
      const updatedLead = {
        ...currentLead,
        name: action.dataKey === 'name' ? action.dataValue : currentLead.name,
        intent: action.dataKey === 'intent' ? action.dataValue : currentLead.intent,
        score: newScore,
        maturity: calculateMaturity(newScore),
        details: action.dataKey && action.dataKey !== 'name' && action.dataKey !== 'intent' && action.dataValue
          ? { ...currentLead.details, [action.dataKey]: action.dataValue }
          : currentLead.details,
      };

      setCurrentLead(updatedLead);
      
      // Save/update the lead in the context if it has interactions
      if (updatedLead.score > 0 || updatedLead.name !== 'Desconhecido') {
        addOrUpdateLead(updatedLead);
      }

      if (action.nextStep) {
         setStep(action.nextStep);
      }

      const botMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: 'bot',
        text: action.botText || 'Entendido!'
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, {
        id: `msg-${Date.now() + 1}`,
        sender: 'bot',
        text: 'Desculpe, estou com dificuldades de conexão no momento. Pode tentar novamente?',
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const resetFlow = () => {
    setMessages([
      {
        id: `msg-${Date.now()}`,
        sender: 'bot',
        text: 'Olá! Seja bem-vindo à Classificarros.\n\nPara que eu consiga te atender melhor, qual o seu nome?',
      },
    ]);
    setStep('START');
    createNewLeadSession();
    setInputValue('');
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-4xl mx-auto h-[90vh] flex flex-col">
        
        {/* CHATBOT SECTION */}
        <div className="h-full bg-zinc-50 rounded-2xl shadow-2xl border border-zinc-800 flex flex-col overflow-hidden relative">
          {/* Header */}
          <div className="bg-zinc-950 text-white p-4 flex flex-col sm:flex-row justify-between items-center shadow-md z-10 gap-4">
            <div className="flex items-center gap-4">
              <img 
                src="https://classificarros.com.br/img/classificarros-logo-white.svg" 
                alt="Classificarros" 
                className="h-8"
              />
              <div className="hidden sm:block border-l border-zinc-700 h-8 pl-4">
                <p className="text-zinc-300 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  Assistente Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-300">
              <div className="hidden md:flex flex-col text-right">
                <span>Rua Carolina Florence, 410 - Guanabara - Campinas/SP</span>
                <span className="text-red-500 font-medium whitespace-nowrap">WhatsApp: (19) 9 9122-9804</span>
              </div>
              <button 
                onClick={resetFlow}
                className="p-2 bg-zinc-800 hover:bg-red-600 rounded-lg transition-colors flex items-center gap-2 text-sm text-white"
                title="Reiniciar conversa"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-100" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
                    <div className="flex flex-col gap-1 mt-1">
                      <div className={`px-4 py-2 rounded-2xl whitespace-pre-wrap text-[15px] leading-relaxed shadow-sm relative ${
                        msg.sender === 'user' 
                          ? 'bg-zinc-800 text-white rounded-tr-sm' 
                          : 'bg-white text-zinc-800 border border-zinc-200 rounded-tl-sm'
                      }`}>
                        {msg.text}
                      </div>
                      
                      {/* Options removed to force conversational interaction */}
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="flex gap-2 max-w-[85%]">
                     <div className="px-4 py-3 bg-white border border-zinc-200 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5 h-10">
                        <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-bounce"></div>
                     </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-zinc-200 border-t border-zinc-300 flex items-center gap-2">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
              className="flex gap-2 w-full"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Digite uma mensagem..."
                disabled={isTyping || step.startsWith('END_')}
                className="flex-1 px-4 py-3 bg-white border-none rounded-full focus:outline-none focus:ring-2 focus:ring-red-600 transition-all disabled:opacity-50 shadow-sm text-[15px] text-zinc-900 placeholder:text-zinc-400"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping || step.startsWith('END_')}
                className="w-12 h-12 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0 shadow-sm"
              >
                <Send className="w-5 h-5 ml-1" />
              </button>
            </form>
          </div>
        </div>
        
        {/* Mobile Contact Info */}
        <div className="md:hidden mt-4 text-center text-zinc-400 text-xs space-y-1">
          <p>Rua Carolina Florence, 410 - Guanabara - Campinas/SP</p>
          <p className="text-red-500 font-medium">WhatsApp: (19) 9 9122-9804</p>
        </div>
      </div>
    </div>
  );
}
