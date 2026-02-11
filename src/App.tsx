import { useState } from 'react';
import imgChatGptImageOct142025022518Pm1 from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import HomeScreen from './pages/HomeScreen';
import CreateYutoScreen from './pages/CreateYutoScreen';
import YutoGroupScreen from './pages/YutoGroupScreen';
import ProfileScreen from './pages/ProfileScreen';
import YourYutosScreen from './pages/YourYutosScreen';
import YutoChatScreen from './pages/YutoChatScreen';
import VenuesMapScreen from './pages/VenuesMapScreen';
import FareShareScreen from './pages/FareShareScreen';
import { addToWaitlist, getWaitlistPosition } from './lib/supabase';

type Screen = 'welcome' | 'home' | 'create-yuto' | 'yuto-group' | 'profile' | 'your-yutos' | 'chat' | 'venues-map' | 'fare-share' | 'waitlist-thanks';

interface Venue {
  name: string;
  price: string;
}

interface YutoGroup {
  name: string;
  venue: Venue | { name: string; price: string };
  peopleCount: number;
  isFareShare?: boolean;
}

function WaitlistScreen({ onSuccess, onEnterApp }: { onSuccess: (position: number) => void; onEnterApp?: () => void }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoinWaitlist = async () => {
    if (!phoneNumber || phoneNumber.length < 9) {
      // Test mode: "1" skips to confirmation, "0" enters the app
      if (phoneNumber === '1') {
        onSuccess(999);
        return;
      }
      if (phoneNumber === '0') {
        onEnterApp?.();
        return;
      }
      setError('Please enter a valid phone number');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const fullPhone = '+254' + phoneNumber;
      await addToWaitlist(fullPhone);
      const position = await getWaitlistPosition(fullPhone);
      onSuccess(position);
    } catch (err: unknown) {
      console.error('Waitlist error:', err);
      if (err instanceof Error && err.message?.includes('duplicate')) {
        setError('This number is already on the waitlist!');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white mobile-container">
      <div className="relative w-[402px] h-[874px] bg-white app-frame">
        {/* Logo/Mascot */}
        <div className="absolute left-[114px] w-[167px] h-[167px] top-[120px]">
          <img 
            alt="Yuto mascot" 
            className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" 
            src={imgChatGptImageOct142025022518Pm1} 
          />
        </div>

        {/* Title */}
        <p className="absolute font-bold left-[76px] text-[30px] text-black top-[290px]">
          Join the Waitlist
        </p>

        {/* Subtitle */}
        <p className="absolute font-normal left-[45px] right-[45px] text-center text-[15px] text-gray-600 top-[330px]">
          Be the first to know when Yuto launches in Kenya
        </p>

        {/* Phone Input */}
        <div className="absolute left-[53px] top-[390px] w-[296px] h-[55px] bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] flex items-center px-5">
          <span className="font-normal text-[20px] text-black mr-2">
            +254
          </span>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="712 345 678"
            className="flex-1 outline-none bg-transparent text-[20px] text-black placeholder-gray-400"
            maxLength={9}
          />
        </div>

        {/* Error Message */}
        {error && (
          <p className="absolute left-[53px] right-[53px] top-[450px] text-[14px] text-red-500 text-center">
            {error}
          </p>
        )}

        {/* Join Button */}
        <button
          onClick={handleJoinWaitlist}
          disabled={isLoading}
          className="absolute left-[53px] top-[460px] w-[296px] h-[50px] bg-black border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <span className="font-semibold text-[16px] text-white">
            {isLoading ? 'Joining...' : 'Join Waitlist 🎉'}
          </span>
        </button>

        {/* Footer */}
        <p className="absolute bottom-[80px] left-0 right-0 text-center text-[12px] text-gray-400">
          No spam, ever. We'll only notify you when we launch.
        </p>
      </div>
    </div>
  );
}

function WaitlistThanksScreen({ position }: { position: number }) {
  console.log('Position:', position); // Keep for debugging but unused
  return (
    <div className="bg-[#fafafa] mobile-container">
      <div className="relative w-[402px] h-[874px] bg-[#fafafa] app-frame flex flex-col items-center justify-center px-[30px]">
        
        {/* Mascot */}
        <div className="w-[120px] h-[120px] mb-[20px]">
          <img 
            alt="Yuto mascot" 
            className="w-full h-full object-contain" 
            src={imgChatGptImageOct142025022518Pm1} 
          />
        </div>

        {/* Checkmark */}
        <div className="w-[70px] h-[70px] rounded-full bg-black flex items-center justify-center mb-[30px] animate-[scaleIn_0.5s_ease-out]">
          <svg width="40" height="40" viewBox="0 0 50 50" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline 
              points="10,25 20,35 40,15"
              style={{
                strokeDasharray: 50,
                strokeDashoffset: 0,
                animation: 'drawCheck 0.6s ease-out 0.3s backwards'
              }}
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-[2.2rem] font-bold text-black mb-[10px] tracking-tight">
          You're on the list!
        </h1>

        {/* Subtitle */}
        <p className="text-[1rem] text-gray-500 mb-[20px]">
          We'll send you an SMS when Yuto launches.
        </p>

        {/* Tagline */}
        <p className="text-[1.1rem] text-black font-semibold mb-[40px]">
          Don't pay alone, Yuto it!
        </p>

        {/* Share Link */}
        <a href="#" className="text-[0.95rem] text-black font-medium border-b-2 border-black pb-[2px] hover:opacity-70 transition-opacity">
          Tell your friends to join too!
        </a>
      </div>
    </div>
  );
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [currentGroup, setCurrentGroup] = useState<YutoGroup | null>(null);
  const [waitlistPosition, setWaitlistPosition] = useState<number>(0);

  const handleNavigate = (screen: string, data?: Venue | YutoGroup) => {
    if (screen === 'create-yuto' && data && 'price' in data && !('peopleCount' in data)) {
      setSelectedVenue(data as Venue);
      setCurrentScreen('create-yuto');
    } else if (screen === 'yuto-group' && data && 'peopleCount' in data) {
      setCurrentGroup(data as YutoGroup);
      setCurrentScreen('yuto-group');
    } else if (screen === 'home' || screen === 'welcome' || screen === 'profile' || screen === 'your-yutos' || screen === 'chat' || screen === 'venues-map' || screen === 'fare-share') {
      setCurrentScreen(screen as Screen);
    }
    console.log('Navigate to:', screen);
  };

  const handleCreateYuto = (groupName: string, peopleCount: number) => {
    if (selectedVenue) {
      const newGroup: YutoGroup = {
        name: groupName,
        venue: selectedVenue,
        peopleCount: peopleCount,
      };
      setCurrentGroup(newGroup);
      setCurrentScreen('yuto-group');
    }
  };

  return (
    <>
      {currentScreen === 'welcome' && (
        <WaitlistScreen 
          onSuccess={(position) => {
            setWaitlistPosition(position);
            setCurrentScreen('waitlist-thanks');
          }}
          onEnterApp={() => setCurrentScreen('your-yutos')}
        />
      )}
      {currentScreen === 'waitlist-thanks' && (
        <WaitlistThanksScreen position={waitlistPosition} />
      )}
      {currentScreen === 'home' && (
        <HomeScreen onNavigate={handleNavigate} />
      )}
      {currentScreen === 'create-yuto' && (
        <CreateYutoScreen 
          venue={selectedVenue}
          onBack={() => setCurrentScreen('venues-map')}
          onCreate={handleCreateYuto}
        />
      )}
      {currentScreen === 'yuto-group' && currentGroup && (
        <YutoGroupScreen
          groupName={currentGroup.name}
          venue={currentGroup.venue}
          peopleCount={currentGroup.peopleCount}
          onBack={() => setCurrentScreen('your-yutos')}
          onNavigate={handleNavigate}
        />
      )}
      {currentScreen === 'profile' && (
        <ProfileScreen onNavigate={handleNavigate} />
      )}
      {currentScreen === 'your-yutos' && (
        <YourYutosScreen onNavigate={handleNavigate} />
      )}
      {currentScreen === 'chat' && currentGroup && (
        <YutoChatScreen 
          groupName={currentGroup.name} 
          onBack={() => setCurrentScreen('yuto-group')} 
        />
      )}
      {currentScreen === 'venues-map' && (
        <VenuesMapScreen onNavigate={handleNavigate} />
      )}
      {currentScreen === 'fare-share' && (
        <FareShareScreen 
          onNavigate={handleNavigate} 
          onBack={() => setCurrentScreen('venues-map')}
        />
      )}
    </>
  );
}
