import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import imgYutoMascot from "../assets/yuto-mascot.webp";
import { addToWaitlist, getWaitlistPosition } from '../lib/supabase';

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoinWaitlist = async () => {
    if (!phoneNumber || phoneNumber.length < 9) {
      setError('Please enter a valid phone number');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const fullPhone = '+254' + phoneNumber;
      await addToWaitlist(fullPhone);
      const position = await getWaitlistPosition(fullPhone);
      navigate('/waitlist-thanks', { state: { position } });
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
    <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-8 flex flex-col items-center">
        {/* Logo/Mascot */}
        <div className="w-40 h-40 mb-6">
          <img 
            alt="Yuto mascot" 
            className="w-full h-full object-contain" 
            src={imgYutoMascot} 
          />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          Join the Waitlist
        </h1>

        {/* Subtitle */}
        <p className="text-gray-500 dark:text-gray-400 text-center mb-8">
          Be the first to know when Yuto launches in Kenya
        </p>

        {/* Phone Input */}
        <div className="w-full flex items-center gap-3 px-5 py-4 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-full shadow-sm mb-4">
          <span className="text-lg font-medium text-gray-600 dark:text-gray-300">+254</span>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="712 345 678"
            className="flex-1 outline-none bg-transparent text-lg text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            maxLength={9}
          />
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}

        {/* Join Button */}
        <button
          onClick={handleJoinWaitlist}
          disabled={isLoading}
          className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-semibold text-lg rounded-full shadow-md hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Joining...' : 'Join Waitlist 🎉'}
        </button>

        {/* Footer */}
        <p className="mt-8 text-xs text-gray-400 text-center">
          No spam, ever. We'll only notify you when we launch.
        </p>
      </div>
    </div>
  );
}
