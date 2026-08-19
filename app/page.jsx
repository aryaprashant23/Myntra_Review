'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  ShoppingBag, 
  Clock, 
  MapPin, 
  CreditCard, 
  Shirt, 
  RefreshCw, 
  Send, 
  Bot, 
  User, 
  Quote, 
  ArrowUpRight,
  ExternalLink,
  ChevronDown,
  Layers,
  MessageSquareQuote
} from 'lucide-react';

const THEME_ICONS = {
  price_wait: Clock,
  delivery_return: MapPin,
  other: CreditCard,
  quality_concern: Shirt,
  fit_uncertainty: Shirt
};

// Rich Markdown / Table / List Parser for Chat
function FormattedChatContent({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let currentTable = null;
  let currentList = null;

  const renderInline = (text) => {
    if (!text) return text;
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
    const parts = text.split(regex);

    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: '#ffffff', fontWeight: '700' }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} style={{ color: '#e2e8f0' }}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '4px', color: '#00f0ff', fontSize: '0.85em' }}>{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const flushTable = () => {
    if (currentTable && currentTable.length > 0) {
      const headerRow = currentTable[0];
      const dataRows = currentTable.slice(1).filter(row => !row.every(cell => /^[-:\s|]+$/.test(cell)));

      elements.push(
        <div key={`table-${elements.length}`} className="chat-table-wrapper">
          <table className="chat-table">
            <thead>
              <tr>
                {headerRow.map((h, hi) => (
                  <th key={hi}>{renderInline(h.trim())}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{renderInline(cell.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      currentTable = null;
    }
  };

  const flushList = () => {
    if (currentList && currentList.items.length > 0) {
      if (currentList.type === 'ol') {
        elements.push(
          <ol key={`ol-${elements.length}`} style={{ paddingLeft: '20px', margin: '8px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {currentList.items.map((item, ii) => (
              <li key={ii} style={{ color: '#e2e8f0', fontSize: '0.88rem', lineHeight: '1.5' }}>{renderInline(item)}</li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} style={{ paddingLeft: '18px', margin: '8px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {currentList.items.map((item, ii) => (
              <li key={ii} style={{ color: '#e2e8f0', fontSize: '0.88rem', lineHeight: '1.5' }}>{renderInline(item)}</li>
            ))}
          </ul>
        );
      }
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Markdown table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());
      if (!currentTable) currentTable = [];
      currentTable.push(cells);
      continue;
    } else {
      flushTable();
    }

    // Bullet list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const itemText = trimmed.slice(2);
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(itemText);
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const itemText = numMatch[2];
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(itemText);
      continue;
    }

    flushList();

    if (!trimmed) {
      elements.push(<div key={`space-${i}`} style={{ height: '6px' }} />);
      continue;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={`h4-${i}`} style={{ color: '#ff3f6c', fontSize: '0.95rem', fontWeight: '700', margin: '12px 0 6px' }}>{renderInline(trimmed.slice(4))}</h4>);
      continue;
    }
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      const hText = trimmed.replace(/^#+\s*/, '');
      elements.push(<h3 key={`h3-${i}`} style={{ color: '#00f0ff', fontSize: '1.02rem', fontWeight: '700', margin: '14px 0 8px' }}>{renderInline(hText)}</h3>);
      continue;
    }

    elements.push(
      <p key={`p-${i}`} style={{ margin: '4px 0', lineHeight: '1.55', color: '#cbd5e1', fontSize: '0.88rem' }}>
        {renderInline(trimmed)}
      </p>
    );
  }

  flushTable();
  flushList();

  return <div>{elements}</div>;
}

export default function Dashboard() {
  const [insights, setInsights] = useState([]);
  const [totalCount, setTotalCount] = useState(26);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState('pct');
  const [expandedQuotes, setExpandedQuotes] = useState({});

  // Chat State
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm the **Myntra Wishlist Conversion Copilot**. I analyze real shopper reviews to explain why users save fashion items to their wishlist or cart but hesitate to complete the purchase. Ask me anything, or click a suggestion below!"
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch live insights from Supabase via API
  const fetchInsights = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/insights');
      const data = await res.json();
      if (data.insights && data.insights.length > 0) {
        setInsights(data.insights);
        setTotalCount(data.totalFeedbackCount || 26);
      }
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  // Send message to Groq AI
  const handleSendMessage = async (userText) => {
    const textToSend = userText || inputMessage;
    if (!textToSend.trim() || chatLoading) return;

    const newMessages = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    setInputMessage('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend })
      });
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: "Sorry, I couldn't reach the AI engine right now. Please verify your Groq API key in Vercel." }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const toggleQuotes = (themeId) => {
    setExpandedQuotes(prev => ({
      ...prev,
      [themeId]: !prev[themeId]
    }));
  };

  const sortedInsights = [...insights].sort((a, b) => {
    if (sortBy === 'pct') return b.pct_of_total - a.pct_of_total;
    return b.mention_count - a.mention_count;
  });

  const topTheme = insights.length > 0 ? insights[0] : null;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px 60px' }}>
      
      {/* Top Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ 
            width: '44px', 
            height: '44px', 
            borderRadius: '12px', 
            background: 'linear-gradient(135deg, #ff3f6c, #ff6b8b)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(255, 63, 108, 0.4)'
          }}>
            <ShoppingBag size={24} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: '700', letterSpacing: '-0.5px' }}>
              Myntra Wishlist-to-Purchase Intelligence
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Real-time AI analysis of blocked checkouts & wishlist drop-off intent
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="badge-live">
            <span className="pulse-dot"></span>
            Live Pipeline Active ({totalCount} Feedback Records)
          </div>
          <button 
            onClick={fetchInsights} 
            disabled={refreshing}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Syncing...' : 'Sync Live Data'}
          </button>
        </div>
      </header>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        
        {/* Metric 1 */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '10px' }}>
            <span>TOTAL FEEDBACK ANALYZED</span>
            <Sparkles size={16} color="#00f0ff" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#00f0ff', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Play Store + Reddit + App Store</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '3px solid #ff3f6c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '10px' }}>
            <span>TOP WISHLIST DROP-OFF DRIVER</span>
            <TrendingUp size={16} color="#ff3f6c" />
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff' }}>
            {topTheme ? topTheme.theme_label : 'Price Drop & Discount Waiting'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#ff6b8b', marginTop: '6px' }}>
            {topTheme ? `${topTheme.pct_of_total}% of all wishlist dropouts` : '40.0% of all mentions'}
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '10px' }}>
            <span>DROP-OFF FRICTION BOTTLENECK</span>
            <MapPin size={16} color="#9d4edd" />
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff' }}>
            Pincode Undeliverability
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            33.3% stuck at final checkout step
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '10px' }}>
            <span>AI NORMALIZATION MODEL</span>
            <Bot size={16} color="#00f0ff" />
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#ffffff' }}>
            Groq Llama 3.3 / GPT-OSS
          </div>
          <div style={{ fontSize: '0.78rem', color: '#00f0ff', marginTop: '6px' }}>
            100% Free-Tier Architecture ($0 API Cost)
          </div>
        </div>

      </div>

      {/* Main Dashboard Layout (Grid) */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.95fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Themes & Drop-off Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="glass-panel" style={{ padding: '24px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                  Wishlist Drop-off Reasons & Blockers
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  Quantified from verified customer complaints and purchase hesitation posts
                </p>
              </div>

              {/* Sort Selector */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setSortBy('pct')}
                  style={{
                    background: sortBy === 'pct' ? 'var(--myntra-gradient)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  % Share
                </button>
                <button
                  onClick={() => setSortBy('count')}
                  style={{
                    background: sortBy === 'count' ? 'var(--myntra-gradient)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Mentions
                </button>
              </div>
            </div>

            {/* List of Theme Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sortedInsights.map((item, idx) => {
                const IconComponent = THEME_ICONS[item.theme] || Sparkles;
                const isExpanded = expandedQuotes[item.id] !== false; // expanded by default

                return (
                  <div 
                    key={item.id || idx} 
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 'var(--radius-md)',
                      padding: '18px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '8px', 
                          background: 'rgba(255, 63, 108, 0.15)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}>
                          <IconComponent size={16} color="#ff3f6c" />
                        </div>
                        <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#f8fafc' }}>
                          {item.theme_label}
                        </h3>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ 
                          fontSize: '1rem', 
                          fontWeight: '800', 
                          color: '#00f0ff',
                          fontFamily: 'Outfit'
                        }}>
                          {item.pct_of_total}%
                        </span>
                        <span style={{ 
                          background: 'rgba(255,255,255,0.06)', 
                          padding: '3px 8px', 
                          borderRadius: '6px', 
                          fontSize: '0.72rem', 
                          color: 'var(--text-muted)' 
                        }}>
                          {item.mention_count} mentions
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="progress-track" style={{ marginBottom: '14px' }}>
                      <div 
                        className="progress-fill" 
                        style={{ width: `${Math.max(item.pct_of_total, 5)}%` }}
                      ></div>
                    </div>

                    {/* Affected Segments */}
                    {item.segment_breakdown && Object.keys(item.segment_breakdown).length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                          Categories:
                        </span>
                        {Object.entries(item.segment_breakdown).map(([seg, pct]) => (
                          <span 
                            key={seg}
                            style={{
                              background: 'rgba(0, 240, 255, 0.08)',
                              border: '1px solid rgba(0, 240, 255, 0.2)',
                              color: '#00f0ff',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: '500'
                            }}
                          >
                            {seg}: {pct}%
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Real Customer Quotes */}
                    {item.sample_quotes && item.sample_quotes.length > 0 && (
                      <div>
                        <button
                          onClick={() => toggleQuotes(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ff6b8b',
                            fontSize: '0.78rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginBottom: '10px'
                          }}
                        >
                          <MessageSquareQuote size={13} />
                          {isExpanded ? 'Hide Customer Evidence Quotes' : `Show ${item.sample_quotes.length} Customer Evidence Quotes`}
                          <ChevronDown size={12} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                        </button>

                        {isExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {item.sample_quotes.map((quote, qIdx) => (
                              <div key={qIdx} className="quote-bubble">
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <Quote size={14} color="#ff3f6c" style={{ flexShrink: 0, marginTop: '2px' }} />
                                  <span>"{quote}"</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

          </div>

        </div>

        {/* Right Column: AI Wishlist Copilot Chat */}
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', position: 'sticky', top: '20px' }}>
          
          {/* Chat Header */}
          <div style={{ 
            padding: '18px 20px', 
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, #00f0ff, #ff3f6c)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <Bot size={18} color="#000000" />
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700' }}>Wishlist AI Copilot</h3>
                <span style={{ fontSize: '0.72rem', color: '#00f0ff' }}>Grounded in live Supabase data</span>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="chat-window">
            <div className="chat-messages">
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}
                >
                  {msg.role === 'assistant' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.75rem', color: '#ff6b8b', fontWeight: '600' }}>
                      <Sparkles size={12} />
                      Groq Llama 3.3 Analyst
                    </div>
                  )}
                  <FormattedChatContent content={msg.content} />
                </div>
              ))}

              {chatLoading && (
                <div className="chat-bubble-ai" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={14} className="animate-spin" color="#00f0ff" />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Analyzing customer quotes & themes...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Suggestions */}
            <div style={{ padding: '0 16px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleSendMessage("Why do shoppers hesitate on wishlisted footwear?")}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#cbd5e1',
                  borderRadius: 'var(--radius-full)',
                  padding: '5px 10px',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                👠 Why footwear hesitation?
              </button>
              <button
                onClick={() => handleSendMessage("What is the biggest complaint regarding price drops & sales?")}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#cbd5e1',
                  borderRadius: 'var(--radius-full)',
                  padding: '5px 10px',
                  fontSize: '0.72rem',
                  cursor: 'pointer'
                }}
              >
                🏷️ Price drop complaints
              </button>
              <button
                onClick={() => handleSendMessage("Explain the pincode and delivery availability blocker.")}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#cbd5e1',
                  borderRadius: 'var(--radius-full)',
                  padding: '5px 10px',
                  fontSize: '0.72rem',
                  cursor: 'pointer'
                }}
              >
                📦 Pincode delivery blocker
              </button>
            </div>

            {/* Input Box */}
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
              style={{ 
                padding: '14px 16px', 
                borderTop: '1px solid var(--border-subtle)',
                background: 'rgba(0,0,0,0.2)',
                display: 'flex',
                gap: '8px'
              }}
            >
              <input 
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about wishlist dropout reasons..."
                disabled={chatLoading}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <button 
                type="submit" 
                disabled={chatLoading || !inputMessage.trim()}
                className="btn-primary"
                style={{ padding: '0 16px', borderRadius: 'var(--radius-md)' }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>

        </div>

      </div>

    </div>
  );
}
