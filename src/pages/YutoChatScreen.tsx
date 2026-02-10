import { useState } from "react";
import YutoSendImg from "../assets/YutoSend.png";

interface Message {
  id: number;
  sender: string;
  text: string;
  isMe: boolean;
  avatar?: string;
}

interface YutoChatScreenProps {
  groupName: string;
  onBack?: () => void;
}

// Sample avatar images (using placeholder initials)
const members = [
  { name: "Jack", initial: "J" },
  { name: "Jane", initial: "Ja" },
  { name: "Mike", initial: "M" },
];

export default function YutoChatScreen({ groupName, onBack }: YutoChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: "Jack", text: "Hey everyone! Ready for Saturday?", isMe: false },
    { id: 2, sender: "Jane", text: "Yes! Can't wait 🎳", isMe: false },
    { id: 3, sender: "Mike", text: "I'm in! What time?", isMe: false },
    { id: 4, sender: "You", text: "Let's meet at 3pm at the venue", isMe: true },
    { id: 5, sender: "Jack", text: "Perfect, see you all there!", isMe: false },
    { id: 6, sender: "Jane", text: "Sounds good 👍", isMe: false },
  ]);
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (inputText.trim()) {
      setMessages([
        ...messages,
        {
          id: messages.length + 1,
          sender: "You",
          text: inputText.trim(),
          isMe: true,
        },
      ]);
      setInputText("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getAvatarForSender = (sender: string) => {
    const member = members.find((m) => m.name === sender);
    return member?.initial || sender.charAt(0).toUpperCase();
  };

  return (
    <div className="bg-white min-h-screen flex items-center justify-center">
      <div className="relative w-[402px] h-[874px] bg-white overflow-hidden border border-gray-200 rounded-[40px]">
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 h-[80px] bg-white border-b border-gray-200 flex items-center justify-between px-[24px] pt-[20px]">
          {/* Back button */}
          <button 
            onClick={onBack}
            className="p-0 bg-transparent border-none cursor-pointer hover:opacity-70 transition-opacity"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          
          {/* Group name */}
          <p className="font-bold text-[22px] text-black">{groupName}</p>
          
          {/* Chat icon (active) */}
          <div className="w-[36px] h-[36px] bg-black rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
          </div>
        </div>
        
        {/* Messages Container */}
        <div className="absolute top-[80px] bottom-[90px] left-0 right-0 overflow-y-auto px-[16px] py-[16px]">
          <div className="flex flex-col gap-[12px]">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-end gap-[10px] ${message.isMe ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                {!message.isMe && (
                  <div className="w-[40px] h-[40px] rounded-full bg-gray-300 border-2 border-black flex items-center justify-center text-black text-[14px] font-bold flex-shrink-0 overflow-hidden">
                    {getAvatarForSender(message.sender)}
                  </div>
                )}
                
                {/* Message bubble */}
                <div
                  className={`max-w-[240px] px-[18px] py-[12px] rounded-full ${
                    message.isMe
                      ? "bg-[#5493b3] text-white"
                      : "bg-gray-200 text-black"
                  }`}
                >
                  <p className="text-[14px] leading-[1.4]">{message.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Input Area */}
        <div className="absolute bottom-[20px] left-[16px] right-[16px]">
          <div className="relative h-[50px]">
            {/* Message Input Pill */}
            <div className="h-[50px] bg-white border border-black rounded-full flex items-center pl-[20px] pr-[80px]">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="w-full bg-transparent border-none outline-none text-[14px] text-black placeholder-gray-400"
              />
            </div>
            
            {/* Send Button - overlapping */}
            <button
              onClick={handleSend}
              className="absolute right-0 top-0 w-[90px] h-[50px] bg-white border border-black rounded-full flex items-center justify-center p-0 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <img 
                src={YutoSendImg} 
                alt="Send" 
                className="w-[32px] h-[32px] object-contain"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
