import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I’m your Travel Assistant. How can I help you plan your trip?'
    }
  ]);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();

    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMessage }
    ]);

    setMessage('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {})
        },
        body: JSON.stringify({
          message: userMessage,
          history: messages
        })
      });

      const data = await response.json();

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.response
        }
      ]);

      window.dispatchEvent(
        new Event('tripUpdated')
      );
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {isOpen && (
        <div className="chatbot">
          <div className="chatbot-header">
            <div>
              <span className="chatbot-eyebrow">
                ROAMLY ASSISTANT
              </span>
              <h3>Travel Assistant</h3>
            </div>

            <button
              type="button"
              className="chatbot-close"
              onClick={() => setIsOpen(false)}
            >
              <X size={19} />
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`chat-message ${msg.role}`}
              >
                <span className="chat-label">
                  {msg.role === 'user'
                    ? 'You'
                    : 'Roamly'}
                </span>

                <div className="chat-bubble">
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-message assistant">
                <span className="chat-label">
                  Roamly
                </span>

                <div className="chat-bubble typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
          </div>

          <div className="chatbot-input">
            <input
              value={message}
              onChange={e =>
                setMessage(e.target.value)
              }
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  sendMessage();
                }
              }}
              placeholder="Ask me anything..."
            />

            <button
              type="button"
              onClick={sendMessage}
              disabled={loading}
            >
              →
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`chatbot-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={
          isOpen
            ? 'Close travel assistant'
            : 'Open travel assistant'
        }
      >
        {isOpen ? (
          <X size={24} />
        ) : (
          <MessageCircle size={24} />
        )}
      </button>
    </>
  );
}

export default Chatbot;