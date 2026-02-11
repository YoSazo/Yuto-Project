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

type Screen = 'welcome' | 'home' | 'create-yuto' | 'yuto-group' | 'profile' | 'your-yutos' | 'chat' | 'venues-map' | 'fare-share';

interface Venue {
  name: string;
  price: string;
}

interface YutoGroup {
  name: string;
  venue: Venue;
  peopleCount: number;
}

function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleContinue = () => {
    console.log('Phone number:', '+1' + phoneNumber);
    onContinue();
  };

  return (
    <div className="bg-white mobile-container">
      <div className="relative w-[402px] h-[874px] bg-white app-frame">
        {/* Logo/Mascot */}
        <div className="absolute left-[114px] w-[167px] h-[167px] top-[152px]">
          <img 
            alt="Yuto mascot" 
            className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" 
            src={imgChatGptImageOct142025022518Pm1} 
          />
        </div>

        {/* Welcome Text */}
        <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[normal] left-[76px] not-italic text-[30px] text-black top-[314px]">
          Welcome to Yuto
        </p>

        {/* Subtitle */}
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[normal] left-[56px] not-italic text-[15px] text-black top-[355px]">
          To get started please verify your number
        </p>

        {/* Phone Input */}
        <div className="absolute left-[53px] top-[409px] w-[296px] h-[65px] bg-white border border-black border-solid rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] flex items-center px-6">
          <span className="font-['Inter:Regular',sans-serif] font-normal text-[25px] text-black mr-2">
            +1
          </span>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
            placeholder=""
            className="flex-1 outline-none bg-transparent font-['Inter:Regular',sans-serif] text-[25px] text-black"
            maxLength={10}
          />
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          className="absolute left-[138px] top-[490px] w-[126px] h-[32px] bg-black border border-black border-solid rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
        >
          <span className="font-['Inter:Regular',sans-serif] font-normal leading-[21px] not-italic text-[16px] text-center text-white tracking-[-0.32px]">
            Continue
          </span>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [currentGroup, setCurrentGroup] = useState<YutoGroup | null>(null);

  const handleNavigate = (screen: string, data?: Venue | YutoGroup) => {
    if (screen === 'create-yuto' && data && 'price' in data) {
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
        <WelcomeScreen onContinue={() => setCurrentScreen('your-yutos')} />
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
