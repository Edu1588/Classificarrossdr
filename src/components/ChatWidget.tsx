import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X } from 'lucide-react';
import { Message } from '../types';
import { calculateMaturity } from '../engine';
import { useLead } from '../context/LeadContext';

export default function ChatWidget() {
  const { currentLead, setCurrentLead, addOrUpdateLead, createNewLeadSession } = useLead();
  const [isOpen, setIsOpen] = useState(false);
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
  }, [messages, isTyping, isOpen]);

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
          leadData: currentLead,
          knownLeads: leads.map(l => ({ name: l.name, whatsapp: l.details?.whatsapp }))
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
        durationInSeconds: Math.floor((Date.now() - currentLead.timestamp) / 1000),
      };

      setCurrentLead(updatedLead);
      
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

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-6 w-full max-w-[360px] h-[550px] bg-[#e5ddd5] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-zinc-200"
          >
            {/* Header */}
            <div className="bg-[#075e54] text-white p-4 flex items-center justify-between shadow-md z-10">
              <div className="flex items-center gap-3">
                <img 
                  src="https://classificarros.com.br/img/classificarros-logo-white.svg" 
                  alt="Classificarros" 
                  className="h-6"
                />
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-[#128c7e] rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-3" 
              style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat', backgroundSize: 'contain' }}
            >
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`px-3 py-2 rounded-lg max-w-[85%] text-[14px] leading-relaxed shadow-sm relative ${
                      msg.sender === 'user' 
                        ? 'bg-[#dcf8c6] text-slate-800 rounded-tr-none' 
                        : 'bg-white text-slate-800 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                
                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                     <div className="px-3 py-3 bg-white rounded-lg rounded-tl-none shadow-sm flex items-center gap-1 h-9">
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-2 bg-[#f0f0f0] flex items-center gap-2">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
                className="flex gap-2 w-full"
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Mensagem"
                  disabled={isTyping || step.startsWith('END_')}
                  className="flex-1 px-4 py-2.5 bg-white border-none rounded-full focus:outline-none disabled:opacity-50 shadow-sm text-[14px] text-slate-700 placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isTyping || step.startsWith('END_')}
                  className="w-10 h-10 bg-[#128c7e] text-white rounded-full hover:bg-[#075e54] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0 shadow-sm"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 flex items-center gap-3 z-50">
        {!isOpen && (
          <div className="bg-white text-slate-800 px-4 py-2 rounded-full shadow-md font-medium text-sm animate-bounce cursor-pointer" onClick={() => setIsOpen(true)}>
            Fale Conosco
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
          </svg>
        </button>
      </div>
    </>
  );
}
