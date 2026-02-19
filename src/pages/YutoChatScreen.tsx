import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface Message {
  id: number;
  sender: string;
  text: string;
  isMe: boolean;
}

const initialMessages: Message[] = [
  { id: 1, sender: "Jack", text: "Hey everyone! Ready for the ride?", isMe: false },
  { id: 2, sender: "Jane", text: "Yes! On my way now", isMe: false },
  { id: 3, sender: "Mike", text: "I'm at the pickup point", isMe: false },
  { id: 4, sender: "You", text: "Perfect, driver is 3 min away", isMe: true },
  { id: 5, sender: "Jack", text: "Cool, see you there!", isMe: false },
  { id: 6, sender: "Jane", text: "Almost there 👍", isMe: false },
];

const members = [
  { name: "Jack", initial: "J" },
  { name: "Jane", initial: "Ja" },
  { name: "Mike", initial: "M" },
];

export default function YutoChatScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const groupName = (location.state as { groupName?: string })?.groupName || "Fare Share";

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (!inputText.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, sender: "You", text: inputText.trim(), isMe: true },
    ]);
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getInitial = (sender: string) => {
    const m = members.find((m) => m.name === sender);
    return m?.initial || sender.charAt(0);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3 border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          className="bg-transparent border-none cursor-pointer text-gray-400 hover:text-black"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <p className="font-bold text-lg text-black">{groupName}</p>
        <div className="w-9 h-9 bg-black rounded-full flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-end gap-2.5 ${msg.isMe ? "flex-row-reverse" : "flex-row"}`}
            >
              {!msg.isMe && (
                <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                  {getInitial(msg.sender)}
                </div>
              )}
              <div
                className={`max-w-[240px] px-4 py-2.5 rounded-2xl ${
                  msg.isMe ? "bg-black text-white" : "bg-gray-100 text-black"
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 h-11 bg-gray-100 border-none rounded-full px-4 text-sm text-black outline-none placeholder-gray-400"
          />
          <button
            onClick={handleSend}
            className="w-11 h-11 bg-black rounded-full flex items-center justify-center border-none cursor-pointer hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
