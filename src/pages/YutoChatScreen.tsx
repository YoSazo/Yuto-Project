import { useState } from "react";
import { useNavigate, useLocation } from 'react-router-dom';

interface Message {
  id: number;
  sender: string;
  text: string;
  time: string;
  isMe: boolean;
}

// Mock messages
const initialMessages: Message[] = [
  { id: 1, sender: "Jack", text: "Hey everyone! Ready for Saturday?", time: "10:30 AM", isMe: false },
  { id: 2, sender: "You", text: "Can't wait! 🎳", time: "10:32 AM", isMe: true },
  { id: 3, sender: "Sarah", text: "I'll be there at 3pm", time: "10:35 AM", isMe: false },
];

export default function YutoChatScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const groupName = location.state?.groupName || "Group Chat";
  
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");

  const handleSend = () => {
    if (newMessage.trim()) {
      const msg: Message = {
        id: messages.length + 1,
        sender: "You",
        text: newMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
      };
      setMessages([...messages, msg]);
      setNewMessage("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-12 pb-4 bg-white border-b border-gray-200">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-bold text-black">{groupName}</h1>
          <p className="text-xs text-gray-500">3 members</p>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[75%] ${msg.isMe ? 'order-2' : ''}`}>
              {!msg.isMe && (
                <p className="text-xs text-gray-500 mb-1 ml-1">{msg.sender}</p>
              )}
              <div className={`px-4 py-3 rounded-2xl ${
                msg.isMe 
                  ? 'bg-black text-white rounded-br-md' 
                  : 'bg-white text-black border border-gray-200 rounded-bl-md'
              }`}>
                <p className="text-sm">{msg.text}</p>
              </div>
              <p className={`text-xs text-gray-400 mt-1 ${msg.isMe ? 'text-right mr-1' : 'ml-1'}`}>
                {msg.time}
              </p>
            </div>
          </div>
        ))}
      </main>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-gray-100 rounded-full text-black placeholder-gray-500 outline-none focus:ring-2 focus:ring-black/20"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className="w-11 h-11 bg-black rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors disabled:bg-gray-300"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
