import { useState } from "react";
import svgPaths from "../imports/svg-haowxjp8c3";
import imgChatGptImageOct142025022518Pm1 from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

function MapPin({ onClick }: { onClick?: () => void }) {
  return (
    <div 
      className="absolute left-[97px] size-[31px] top-[787px] cursor-pointer hover:opacity-70 transition-opacity"
      onClick={onClick}
    >
      <svg className="block size-full" fill="none" viewBox="0 0 48 48">
        <path d="M42 20C42 34 24 46 24 46C24 46 6 34 6 20C6 15.2261 7.89642 10.6477 11.2721 7.27208C14.6477 3.89642 19.2261 2 24 2C28.7739 2 33.3523 3.89642 36.7279 7.27208C40.1036 10.6477 42 15.2261 42 20Z" stroke="#1E1E1E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M24 26C27.3137 26 30 23.3137 30 20C30 16.6863 27.3137 14 24 14C20.6863 14 18 16.6863 18 20C18 23.3137 20.6863 26 24 26Z" stroke="#1E1E1E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function User({ onClick }: { onClick?: () => void }) {
  return (
    <div 
      className="absolute left-[274px] size-[31px] top-[787px] cursor-pointer hover:opacity-70 transition-opacity"
      onClick={onClick}
    >
      <svg className="block size-full" fill="none" viewBox="0 0 31 31">
        <path d={svgPaths.p28866700} stroke="#1E1E1E" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      </svg>
    </div>
  );
}

function Home({ onClick }: { onClick?: () => void }) {
  return (
    <div 
      className="absolute h-[31px] left-[185px] top-[787px] w-[32px] cursor-pointer hover:opacity-70 transition-opacity"
      onClick={onClick}
    >
      <svg className="block size-full" fill="none" viewBox="0 0 32 31">
        <path d={svgPaths.p2eef9e80} stroke="#1E1E1E" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      </svg>
    </div>
  );
}

function MessageIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
      <path d="M42 23C42.0069 25.6397 41.3901 28.2438 40.2 30.6C38.7889 33.4235 36.6195 35.7984 33.9349 37.4586C31.2503 39.1188 28.1565 39.9988 25 40C22.3603 40.0069 19.7562 39.3901 17.4 38.2L6 42L9.8 30.6C8.60986 28.2438 7.99312 25.6397 8 23C8.00122 19.8435 8.88122 16.7497 10.5414 14.0651C12.2017 11.3805 14.5765 9.21114 17.4 7.8C19.7562 6.60987 22.3603 5.99312 25 6H26C30.1687 6.22999 34.1061 7.98953 37.0583 10.9417C40.0105 13.8939 41.77 17.8313 42 22V23Z" stroke="#1E1E1E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Confetti component
function Confetti() {
  const colors = ['#5493b3', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
  const confettiPieces = Array(30).fill(0).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1 + Math.random() * 1,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute w-2 h-2 rounded-sm animate-bounce"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            animation: `fall ${piece.duration}s ease-in-out ${piece.delay}s forwards`,
            top: '-10px',
          }}
        />
      ))}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(180px) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

interface Member {
  name: string;
  isReady: boolean;
  isLeader: boolean;
}

interface MemberCircleProps {
  member: Member;
  position: { top: string; left: string };
  isPlaceholder?: boolean;
  zIndex?: number;
}

function MemberCircle({ member, position, isPlaceholder = false, zIndex = 1 }: MemberCircleProps) {
  const isLeader = member.isLeader && !isPlaceholder;
  const circleSize = '80px';
  const fontSize = '24px';
  
  return (
    <div 
      className="absolute flex flex-col items-center"
      style={{ top: position.top, left: position.left, zIndex }}
    >
      <div 
        className={`rounded-full flex items-center justify-center font-bold relative border ${
          isPlaceholder 
            ? 'bg-white border-dashed border-gray-400 text-gray-400' 
            : member.isReady 
              ? 'bg-black border-black text-white' 
              : 'bg-white border-black text-black'
        }`}
        style={{ width: circleSize, height: circleSize, fontSize }}
      >
        {isPlaceholder ? <span className="text-[32px]">?</span> : member.name.charAt(0).toUpperCase()}
        {isLeader && (
          <span className="absolute -top-1 -right-1 text-[16px] bg-white rounded-full border border-black p-[2px]">👑</span>
        )}
      </div>
      <p className="text-[12px] text-black mt-[6px] font-semibold">
        {isPlaceholder ? 'Empty' : member.name}
      </p>
      {isLeader && (
        <p className="text-[10px] text-gray-500">Host</p>
      )}
      {!isPlaceholder && !isLeader && (
        <p className={`text-[10px] font-bold ${member.isReady ? 'text-green-600' : 'text-gray-400'}`}>
          {member.isReady ? '✓ Ready' : 'Not Ready'}
        </p>
      )}
    </div>
  );
}

interface YutoGroupScreenProps {
  groupName: string;
  venue: { name: string; price: string } | null;
  peopleCount: number;
  onBack: () => void;
  onNavigate?: (screen: string) => void;
  isFareShare?: boolean;
}

export default function YutoGroupScreen({ groupName, venue, peopleCount, onBack, onNavigate, isFareShare }: YutoGroupScreenProps) {
  const totalPool = venue ? parseInt(venue.price) * peopleCount : 0;
  
  const fakeFriends = ["Jack", "Jane", "Mike", "Sara"];
  
  const [members, setMembers] = useState<Member[]>([
    { name: "You", isReady: false, isLeader: true }
  ]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [yutoStarted, setYutoStarted] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'buy-goods' | 'paybill' | 'phone' | null>(null);
  const [tillNumber, setTillNumber] = useState('');
  const [businessNo, setBusinessNo] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  
  const isPartyFull = members.length >= peopleCount;
  const allReady = members.length === peopleCount && members.every(m => m.isReady);
  const youAreReady = members.find(m => m.name === "You")?.isReady || false;
  
  // Calculate fill percentage for Yuto
  const paidCount = members.filter(m => m.isReady).length;
  const fillPercentage = members.length > 0 ? (paidCount / members.length) * 100 : 0;
  
  const handleInviteFriend = () => {
    if (!isPartyFull) {
      const nextFriendIndex = members.length - 1;
      if (nextFriendIndex < fakeFriends.length) {
        setMembers([...members, { 
          name: fakeFriends[nextFriendIndex], 
          isReady: false, 
          isLeader: false 
        }]);
      }
    }
  };
  
  const handlePayYuto = () => {
    // Simulate M-PESA payment - mark "You" as ready
    setMembers(members.map(m => 
      m.name === "You" ? { ...m, isReady: true } : m
    ));
    
    // Simulate others paying after a delay (for demo)
    setTimeout(() => {
      setMembers(prev => prev.map(m => ({ ...m, isReady: true })));
    }, 1500);
  };
  
  const handleStartYuto = () => {
    setShowConfetti(true);
    setYutoStarted(true);
  };
  
  const handlePayVenue = () => {
    setShowPaymentModal(true);
    setPaymentType(null);
    setShowConfirmation(false);
  };
  
  const handlePaymentTypeSelect = (type: 'buy-goods' | 'paybill' | 'phone') => {
    setPaymentType(type);
    setTillNumber('');
    setBusinessNo('');
    setAccountNo('');
    setPhoneNumber('');
  };
  
  const handleShowConfirmation = () => {
    setShowConfirmation(true);
  };
  
  const handleFinalPay = () => {
    setPaymentComplete(true);
    setShowPaymentModal(false);
    setShowConfirmation(false);
  };
  
  const isPaymentFormValid = () => {
    if (paymentType === 'buy-goods') return tillNumber.length >= 5;
    if (paymentType === 'paybill') return businessNo.length >= 5 && accountNo.length >= 1;
    if (paymentType === 'phone') return phoneNumber.length >= 10;
    return false;
  };
  
  // Generate horizontal positions based on people count
  const getPositions = () => {
    const positions: { top: string; left: string }[] = [];
    const top = "200px";
    const containerWidth = 402;
    const circleWidth = 80; // circle size
    const gap = 20; // gap between circles
    const totalWidth = (peopleCount * circleWidth) + ((peopleCount - 1) * gap);
    const startLeft = (containerWidth - totalWidth) / 2;
    
    for (let i = 0; i < peopleCount; i++) {
      positions.push({ 
        top, 
        left: `${startLeft + (i * (circleWidth + gap))}px` 
      });
    }
    return positions;
  };
  
  const positions = getPositions();

  return (
    <div className="bg-white mobile-container">
      <div className="relative w-[402px] h-[874px] bg-white overflow-hidden app-frame">
        
        {/* Back Button */}
        <button 
          className="absolute left-[20px] top-[60px] text-[24px] text-gray-500 hover:text-black bg-transparent border-none cursor-pointer"
          onClick={onBack}
        >
          ← Back
        </button>
        
        {/* Message Icon - top right */}
        <button 
          className="absolute right-[30px] top-[50px] hover:opacity-70 transition-opacity p-0 bg-transparent border-none cursor-pointer"
          onClick={() => onNavigate?.('chat')}
        >
          <MessageIcon />
        </button>
        
        {/* Group Name */}
        <p className="absolute font-bold text-[28px] text-black left-1/2 transform -translate-x-1/2 top-[100px] whitespace-nowrap">
          {groupName}
        </p>
        
        {/* Pool Amount */}
        <p className="absolute text-[18px] text-gray-600 left-1/2 transform -translate-x-1/2 top-[138px]">
          {totalPool} KSH Pool
        </p>
        
        {/* Large Circular Container */}
        <div className="absolute left-1/2 top-[230px] transform -translate-x-1/2">
          {/* Large outer circle */}
          <div 
            className="relative border-4 border-black rounded-full bg-white"
            style={{ width: '360px', height: '360px' }}
          >
            
            {/* Member Circles positioned around the edge inside the circle */}
            {members.map((member, index) => {
              const angle = (index * 2 * Math.PI) / peopleCount - Math.PI / 2; // Start from top
              const radius = 135; // Distance from center to position on edge
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              
              return (
                <div
                  key={index}
                  className="absolute transition-all duration-500"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                    zIndex: 20,
                  }}
                >
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <div
                        className={`w-[75px] h-[75px] rounded-full flex items-center justify-center font-bold text-[28px] border-4 shadow-lg transition-all duration-300 ${
                          member.isReady
                            ? 'bg-black border-green-500 text-white'
                            : 'bg-white border-gray-300 text-black'
                        }`}
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      {member.isReady && (
                        <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] font-medium mt-1">{member.name}</p>
                  </div>
                </div>
              );
            })}
            
            {/* Yuto in Center with Filling Effect - Smaller */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ zIndex: 10 }}>
              <div
                className="bg-white rounded-[20px] shadow-xl flex flex-col items-center relative overflow-hidden border-2 border-gray-200"
                style={{ width: '100px', height: '120px' }}
              >
                {/* Green fill animation from bottom */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 to-green-400 transition-all duration-1000 ease-out"
                  style={{ height: `${fillPercentage}%` }}
                />
                
                {/* Yuto mascot on top of fill */}
                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                  <img 
                    alt="Yuto mascot" 
                    className="w-[50px] h-[50px] object-contain" 
                    src={imgChatGptImageOct142025022518Pm1} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Status Message */}
        <p className="absolute top-[590px] left-0 right-0 text-center text-[14px] text-gray-600">
          {!isPartyFull 
            ? `${peopleCount - members.length} more ${peopleCount - members.length === 1 ? 'person' : 'people'} needed`
            : allReady
              ? '🎉 Everyone has paid!'
              : `Waiting for ${peopleCount - paidCount} to pay...`
          }
        </p>
        
        {/* Action Button */}
        {!isPartyFull ? (
          <button 
            onClick={handleInviteFriend}
            className="absolute bottom-[140px] left-[30px] right-[30px] h-[50px] bg-black border border-black rounded-[30px] text-white font-bold text-[16px] hover:bg-gray-800 transition-colors shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)]"
          >
            Invite Friends ({members.length}/{peopleCount})
          </button>
        ) : !youAreReady ? (
          <button 
            onClick={handlePayYuto}
            className="absolute bottom-[140px] left-[30px] right-[30px] h-[50px] bg-green-500 border-none rounded-[30px] text-white font-bold text-[16px] hover:bg-green-600 transition-colors shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] pay-button-tap"
          >
            Pay Yuto
          </button>
        ) : !allReady ? (
          <button 
            disabled
            className="absolute bottom-[140px] left-[30px] right-[30px] h-[50px] bg-gray-300 border-none rounded-[30px] text-gray-500 font-bold text-[16px] cursor-not-allowed shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)]"
          >
            Waiting for others...
          </button>
        ) : !yutoStarted ? (
          <button 
            onClick={handleStartYuto}
            className="absolute bottom-[140px] left-[30px] right-[30px] h-[50px] bg-green-500 border-none rounded-[30px] text-white font-bold text-[16px] hover:bg-green-600 transition-colors shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] pay-button-tap"
          >
            Start Yuto! 🎉
          </button>
        ) : !paymentComplete ? (
          <button 
            onClick={handlePayVenue}
            className="absolute bottom-[140px] left-[30px] right-[30px] h-[50px] bg-green-500 border-none rounded-[30px] text-white font-bold text-[16px] hover:bg-green-600 transition-colors shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] pay-button-tap"
          >
            Pay Driver 🚗
          </button>
        ) : (
          <button 
            className="absolute bottom-[140px] left-[30px] right-[30px] h-[50px] bg-green-500 border-none rounded-[30px] text-white font-bold text-[16px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)]"
          >
            Payment Complete ✓
          </button>
        )}
        
        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="absolute inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-[30px] w-[350px] p-[24px] shadow-lg">
              {!showConfirmation ? (
                <>
                  {/* Header */}
                  <div className="flex justify-between items-center mb-[20px]">
                    <h2 className="font-bold text-[22px] text-black">Pay Driver</h2>
                    <button 
                      onClick={() => setShowPaymentModal(false)}
                      className="text-[24px] text-gray-400 hover:text-black"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {/* Amount */}
                  <p className="text-center text-[14px] text-gray-500 mb-[20px]">
                    Total: <span className="font-bold text-black">{totalPool} KSH</span>
                  </p>
                  
                  {/* Payment Type Pills */}
                  <div className="flex gap-[10px] mb-[20px]">
                    <button
                      onClick={() => handlePaymentTypeSelect('buy-goods')}
                      className={`flex-1 py-[12px] rounded-[20px] font-semibold text-[12px] border transition-colors tap-dramatic ${
                        paymentType === 'buy-goods' 
                          ? 'bg-black text-white border-black' 
                          : 'bg-white text-black border-black hover:bg-gray-100'
                      }`}
                    >
                      Buy Goods
                    </button>
                    <button
                      onClick={() => handlePaymentTypeSelect('paybill')}
                      className={`flex-1 py-[12px] rounded-[20px] font-semibold text-[12px] border transition-colors ${
                        paymentType === 'paybill' 
                          ? 'bg-black text-white border-black' 
                          : 'bg-white text-black border-black hover:bg-gray-100'
                      }`}
                    >
                      PayBill
                    </button>
                    <button
                      onClick={() => handlePaymentTypeSelect('phone')}
                      className={`flex-1 py-[12px] rounded-[20px] font-semibold text-[12px] border transition-colors ${
                        paymentType === 'phone' 
                          ? 'bg-black text-white border-black' 
                          : 'bg-white text-black border-black hover:bg-gray-100'
                      }`}
                    >
                      Phone
                    </button>
                  </div>
                  
                  {/* Input Fields */}
                  {paymentType === 'buy-goods' && (
                    <div className="mb-[20px]">
                      <label className="text-[12px] text-gray-500 mb-[6px] block">Enter Till Number</label>
                      <input
                        type="text"
                        value={tillNumber}
                        onChange={(e) => setTillNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 123456"
                        className="w-full h-[50px] border border-black rounded-[25px] px-[20px] text-[16px] outline-none"
                      />
                    </div>
                  )}
                  
                  {paymentType === 'paybill' && (
                    <div className="mb-[20px] space-y-[12px]">
                      <div>
                        <label className="text-[12px] text-gray-500 mb-[6px] block">Enter Business No</label>
                        <input
                          type="text"
                          value={businessNo}
                          onChange={(e) => setBusinessNo(e.target.value.replace(/\D/g, ''))}
                          placeholder="e.g. 247247"
                          className="w-full h-[50px] border border-black rounded-[25px] px-[20px] text-[16px] outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[12px] text-gray-500 mb-[6px] block">Enter Account No</label>
                        <input
                          type="text"
                          value={accountNo}
                          onChange={(e) => setAccountNo(e.target.value)}
                          placeholder="e.g. 0712345678"
                          className="w-full h-[50px] border border-black rounded-[25px] px-[20px] text-[16px] outline-none"
                        />
                      </div>
                    </div>
                  )}
                  
                  {paymentType === 'phone' && (
                    <div className="mb-[20px]">
                      <label className="text-[12px] text-gray-500 mb-[6px] block">Enter Phone Number</label>
                      <input
                        type="text"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 0712345678"
                        className="w-full h-[50px] border border-black rounded-[25px] px-[20px] text-[16px] outline-none"
                        maxLength={12}
                      />
                    </div>
                  )}
                  
                  {/* Pay Button */}
                  {paymentType && (
                    <button
                      onClick={handleShowConfirmation}
                      disabled={!isPaymentFormValid()}
                      className={`w-full h-[50px] rounded-[25px] font-bold text-[16px] transition-colors ${
                        isPaymentFormValid()
                          ? 'bg-black text-white hover:bg-gray-800'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Pay
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* Confirmation View */}
                  <div className="flex justify-between items-center mb-[20px]">
                    <button 
                      onClick={() => setShowConfirmation(false)}
                      className="text-[16px] text-gray-500 hover:text-black"
                    >
                      ← Back
                    </button>
                    <button 
                      onClick={() => setShowPaymentModal(false)}
                      className="text-[24px] text-gray-400 hover:text-black"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <h2 className="font-bold text-[22px] text-black text-center mb-[24px]">Confirm Payment</h2>
                  
                  {/* Payment Details */}
                  <div className="bg-gray-50 rounded-[20px] p-[20px] mb-[24px]">
                    {paymentType === 'buy-goods' && (
                      <div className="text-center">
                        <p className="text-[14px] text-gray-500 mb-[4px]">Till Number</p>
                        <p className="font-bold text-[32px] text-black">{tillNumber}</p>
                      </div>
                    )}
                    
                    {paymentType === 'paybill' && (
                      <div className="text-center space-y-[16px]">
                        <div>
                          <p className="text-[14px] text-gray-500 mb-[4px]">Business No</p>
                          <p className="font-bold text-[28px] text-black">{businessNo}</p>
                        </div>
                        <div>
                          <p className="text-[14px] text-gray-500 mb-[4px]">Account No</p>
                          <p className="font-bold text-[28px] text-black">{accountNo}</p>
                        </div>
                      </div>
                    )}
                    
                    {paymentType === 'phone' && (
                      <div className="text-center">
                        <p className="text-[14px] text-gray-500 mb-[4px]">Phone Number</p>
                        <p className="font-bold text-[32px] text-black">{phoneNumber}</p>
                      </div>
                    )}
                    
                    <div className="mt-[16px] pt-[16px] border-t border-gray-200 text-center">
                      <p className="text-[14px] text-gray-500 mb-[4px]">Amount</p>
                      <p className="font-bold text-[28px] text-black">{totalPool} KSH</p>
                    </div>
                  </div>
                  
                  <p className="text-center text-[12px] text-gray-500 mb-[16px]">
                    Please verify the details above before confirming
                  </p>
                  
                  {/* Final Pay Button */}
                  <button
                    onClick={handleFinalPay}
                    className="w-full h-[50px] bg-black text-white rounded-[25px] font-bold text-[16px] hover:bg-gray-800 transition-colors pay-button-tap"
                  >
                    Confirm & Pay
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Bottom Navigation */}
        <div className="absolute bg-white border-2 border-[#5493b3] rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[69px] w-[264px] top-[776px]" />
        <div 
          className="absolute bg-white border-2 border-[#5493b3] rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[69px] w-[86px] top-[776px] cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onNavigate?.('venues-map')}
        />
        <div className="absolute bg-[#5493b3] border-2 border-[#5493b3] rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[158px] w-[87px] top-[776px]" />
        <div 
          className="absolute bg-white border-2 border-[#5493b3] rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[247px] w-[86px] top-[776px] cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onNavigate?.('profile')}
        />
        <MapPin onClick={() => onNavigate?.('venues-map')} />
        <User onClick={() => onNavigate?.('profile')} />
        <Home onClick={() => onNavigate?.('your-yutos')} />
      </div>
    </div>
  );
}
