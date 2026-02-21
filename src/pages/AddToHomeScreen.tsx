import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

function ShareIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

type Platform = "ios" | "android";

function detectPlatform(): Platform | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return null;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // @ts-expect-error - standalone exists on iOS Safari
  if (window.navigator.standalone) return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // @ts-expect-error - fullscreen/standalone flags
  if (window.matchMedia("(display-mode: fullscreen)").matches && window.screen?.availWidth === window.screen?.width) return true;
  return false;
}

export default function AddToHomeScreen() {
  const navigate = useNavigate();
  const detected = useMemo(() => detectPlatform(), []);
  const [platform, setPlatform] = useState<Platform>(detected ?? "ios");

  useEffect(() => {
    if (isStandalone()) navigate("/home", { replace: true });
  }, [navigate]);

  const handleDone = () => {
    try {
      localStorage.setItem("pwa-prompt-seen", "1");
    } catch {}
    navigate("/home", { replace: true });
  };

  return (
    <div className="min-h-full flex flex-col items-center px-6 pt-12 pb-8">
      <div className="w-20 h-20 mb-6">
        <img alt="Yuto" className="w-full h-full object-contain" src={imgYutoMascot} />
      </div>

      <h1 className="text-xl font-bold text-black text-center mb-1">
        Add Yuto to your home screen
      </h1>
      <p className="text-gray-500 text-sm text-center mb-8 max-w-[280px]">
        Get the full app experience — opens like a native app, no browser bar.
      </p>

      {/* Platform toggle if we couldn't detect */}
      {!detected && (
        <div className="flex bg-gray-100 rounded-full p-1 mb-6">
          <button
            onClick={() => setPlatform("ios")}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              platform === "ios" ? "bg-white shadow text-black" : "text-gray-500"
            }`}
          >
            iPhone
          </button>
          <button
            onClick={() => setPlatform("android")}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              platform === "android" ? "bg-white shadow text-black" : "text-gray-500"
            }`}
          >
            Android
          </button>
        </div>
      )}

      {/* Steps */}
      <div className="w-full max-w-[300px] space-y-5 mb-10">
        {platform === "ios" ? (
          <>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0">
                <ShareIcon />
              </div>
              <div>
                <p className="font-semibold text-black text-[15px]">Tap the Share button</p>
                <p className="text-gray-500 text-sm">The box with an arrow at the bottom of Safari</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0">
                <AddIcon />
              </div>
              <div>
                <p className="font-semibold text-black text-[15px]">Tap &quot;Add to Home Screen&quot;</p>
                <p className="text-gray-500 text-sm">Scroll down to find it</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 text-lg font-bold">
                3
              </div>
              <div>
                <p className="font-semibold text-black text-[15px]">Tap &quot;Add&quot;</p>
                <p className="text-gray-500 text-sm">Top right — you&apos;re done!</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0">
                <MenuIcon />
              </div>
              <div>
                <p className="font-semibold text-black text-[15px]">Tap the menu (⋮)</p>
                <p className="text-gray-500 text-sm">Top right of Chrome or your browser</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0">
                <AddIcon />
              </div>
              <div>
                <p className="font-semibold text-black text-[15px]">Tap &quot;Add to Home screen&quot;</p>
                <p className="text-gray-500 text-sm">Or &quot;Install app&quot;</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 text-lg font-bold">
                3
              </div>
              <div>
                <p className="font-semibold text-black text-[15px]">Tap &quot;Add&quot; or &quot;Install&quot;</p>
                <p className="text-gray-500 text-sm">You&apos;re done!</p>
              </div>
            </div>
          </>
        )}
      </div>

      <button
        onClick={handleDone}
        className="w-full max-w-[280px] py-4 bg-black text-white font-semibold text-base rounded-full active:bg-gray-800"
      >
        Got it
      </button>

      <button
        onClick={handleDone}
        className="mt-4 text-sm text-gray-400 bg-transparent border-none cursor-pointer"
      >
        Maybe later
      </button>
    </div>
  );
}

export { isStandalone, detectPlatform };
