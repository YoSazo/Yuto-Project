import { useLocation } from 'react-router-dom';
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

export default function WaitlistThanksScreen() {
  const location = useLocation();
  const position = location.state?.position || 0;
  console.log('Waitlist position:', position);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 flex flex-col items-center text-center">
        {/* Mascot */}
        <div className="w-28 h-28 mb-4">
          <img 
            alt="Yuto mascot" 
            className="w-full h-full object-contain" 
            src={imgYutoMascot} 
          />
        </div>

        {/* Checkmark */}
        <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center mb-6 animate-[scaleIn_0.5s_ease-out]">
          <svg width="36" height="36" viewBox="0 0 50 50" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
        <h1 className="text-3xl font-bold text-black mb-2">
          You're on the list!
        </h1>

        {/* Subtitle */}
        <p className="text-gray-500 mb-4">
          We'll send you an SMS when Yuto launches.
        </p>

        {/* Tagline */}
        <p className="text-lg text-black font-semibold mb-8">
          Don't pay alone, Yuto it!
        </p>

        {/* Share Link */}
        <a href="#" className="text-black font-medium border-b-2 border-black pb-0.5 hover:opacity-70 transition-opacity">
          Tell your friends to join too!
        </a>
      </div>
    </div>
  );
}
