import React, { useState, useRef, useEffect } from 'react';
import { Bot as LuBot, Send as LuSend, X as LuX, FileText as LuFileText, Check as LuCheck, Loader as LuLoader, Sparkles as LuSparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { aiAssist } from '../services/api';

const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Hi! I am your Enterprise AI Assistant. I can help you create invoices, bills, or journal entries. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Determine context based on current path
      const contextMap = {
        '/invoicing': 'create_invoice',
        '/purchasing': 'create_bill',
        '/journal': 'create_journal',
      };
      const context = contextMap[location.pathname] || 'general';

      const res = await aiAssist(userMessage.text, context);
      const { intent, data, message } = res.data;

      const aiResponse = { 
        sender: 'ai', 
        text: message || 'Here is what I found.',
        intent,
        data 
      };

      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      const msg =
        (error.response && error.response.data && error.response.data.message) ||
        (error.message?.includes('401') ? 'Please login to use AI.' : 'Sorry, I encountered an error. Please try again.');
      setMessages(prev => [...prev, { sender: 'ai', text: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (msg) => {
    if (!msg.data) return;

    switch (msg.intent) {
      case 'create_invoice':
        navigate('/invoicing', { state: { draftInvoice: msg.data } });
        setIsOpen(false);
        break;
      case 'create_bill':
        navigate('/purchasing', { state: { draftBill: msg.data } });
        setIsOpen(false);
        break;
      case 'create_journal':
        navigate('/journal', { state: { draftJournal: msg.data } });
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-40 p-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 hover:shadow-primary/30 ${
          isOpen ? 'bg-danger rotate-90' : 'bg-primary'
        } text-white border-2 border-white/20`}
      >
        {isOpen ? <LuX size={24} /> : <LuSparkles size={24} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-40 w-96 h-[500px] bg-[var(--color-surface)] rounded-2xl shadow-2xl flex flex-col border border-[var(--color-border)] animate-fade-in overflow-hidden ring-1 ring-white/10">
          {/* Header */}
          <div className="bg-primary p-4 flex items-center gap-3 shadow-md z-10">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm shadow-inner">
                    <LuBot className="text-white" size={20} />
                </div>
                <div>
                    <h3 className="text-white font-bold text-sm tracking-wide">Enterprise AI</h3>
                    <p className="text-white/80 text-xs opacity-90">Always here to help</p>
                </div>
            </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--color-background)] custom-scrollbar">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-primary text-white rounded-br-none shadow-primary/20'
                      : 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] rounded-bl-none shadow-sm'
                  }`}
                >
                  <p>{typeof msg.text === 'object' ? JSON.stringify(msg.text) : msg.text}</p>
                  
                  {/* Action Button for Drafts */}
                  {msg.data && msg.intent && (
                    <button
                      onClick={() => handleAction(msg)}
                      className="mt-3 w-full py-2.5 bg-[var(--color-background)] text-primary rounded-xl text-xs font-bold hover:bg-[var(--color-surface-hover)] transition-colors flex items-center justify-center gap-2 border border-primary/20"
                    >
                      {msg.intent === 'create_invoice' && 'Review Draft Invoice'}
                      {msg.intent === 'create_bill' && 'Review Draft Bill'}
                      {msg.intent === 'create_journal' && 'Review Journal Entry'}
                      <LuFileText size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[var(--color-surface)] p-3 rounded-2xl rounded-bl-none border border-[var(--color-border)] shadow-sm flex items-center gap-2">
                  <LuLoader className="animate-spin text-primary" size={16} />
                  <span className="text-xs text-[var(--color-text-muted)] font-medium">Processing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
            <div className="flex items-center gap-2 bg-[var(--color-input-bg)] rounded-full px-4 py-2 border border-[var(--color-input-border)] focus-within:border-primary focus-within:bg-[var(--color-surface)] focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask to create an invoice..."
                className="flex-1 bg-transparent outline-none text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)]"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="p-2 bg-primary text-white rounded-full hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 shadow-md shadow-primary/20"
              >
                <LuSend size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
