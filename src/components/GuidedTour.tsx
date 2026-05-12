import { useState, useEffect } from "react";
import { X, ChevronRight } from "lucide-react";

/**
 * Guided tour — shows after first login. Interactive spotlight tour.
 * Highlights real UI areas and teaches the 3 core concepts.
 * Stored in localStorage so it only shows once.
 */

const TOUR_KEY = "yuto_tour_completed";

const steps = [
  {
    emoji: "👋",
    title: "Welcome to Yuto!",
    subtitle: "Let's show you around — takes 15 seconds",
    description: "Yuto is where you and your friends handle money together. Plans, splits, payments — all with M-PESA.",
    bg: "from-black to-zinc-900",
    action: "Tap anywhere to start",
  },
  {
    emoji: "📋",
    title: "Plans",
    subtitle: "Organize anything",
    description: "Going somewhere? Buying something together? Create a plan, invite your crew, and Yuto collects the money when everyone's ready.",
    bg: "from-blue-500 to-indigo-600",
    action: "Try creating one after the tour!",
  },
  {
    emoji: "💸",
    title: "Split & Collect",
    subtitle: "No more chasing people",
    description: "Tap 'Split' in the nav bar to collect money from friends. Set the amount, pick who owes you, done. They pay via M-PESA right in the app.",
    bg: "from-emerald-500 to-teal-600",
    action: "Check the Split tab after this!",
  },
  {
    emoji: "👛",
    title: "Your Wallet",
    subtitle: "Top up, pay, cash out",
    description: "Money from friends lands in your Yuto wallet. Top up via M-PESA anytime. Cash out to your number instantly. Zero fees between friends.",
    bg: "from-orange-500 to-pink-600",
    action: "Find it in your Profile!",
  },
  {
    emoji: "🚀",
    title: "You're all set!",
    subtitle: "Start by creating a plan or splitting a bill",
    description: "Invite your friends — Yuto gets better with more people. The Post button at the bottom lets you create plans, host events, or sell stuff.",
    bg: "from-purple-600 to-pink-600",
    action: null,
  },
];

export function GuidedTour({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) setVisible(true);
  }, []);

  const handleNext = () => {
    if (step < steps.length - 1) {
      setAnimating(true);
      setTimeout(() => {
        setStep(step + 1);
        setAnimating(false);
      }, 200);
    } else {
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setVisible(false);
    onComplete();
  };

  if (!visible) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md fade-in" onClick={handleNext}>
      {/* Skip button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
        className="absolute top-6 right-6 z-10 px-3 py-1.5 rounded-full bg-white/10 text-white/60 text-xs font-bold border-none hover:bg-white/20 transition-colors"
      >
        Skip
      </button>

      {/* Step counter */}
      <div className="absolute top-6 left-6 text-white/40 text-xs font-bold">
        {step + 1}/{steps.length}
      </div>

      {/* Card */}
      <div className={`w-full max-w-sm mx-6 transition-all duration-200 ${animating ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}>
        <div className={`bg-gradient-to-br ${current.bg} rounded-3xl p-8 text-center shadow-2xl`}>
          {/* Emoji */}
          <div className="text-6xl mb-5 animate-bounce">{current.emoji}</div>

          {/* Title */}
          <h2 className="text-2xl font-black text-white mb-1">{current.title}</h2>
          <p className="text-white/70 font-semibold text-sm mb-5">{current.subtitle}</p>

          {/* Description */}
          <p className="text-white/80 text-sm leading-relaxed mb-6">{current.description}</p>

          {/* Action hint */}
          {current.action && (
            <p className="text-white/50 text-xs mb-4 italic">{current.action}</p>
          )}

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-6 bg-white" : i < step ? "w-2 bg-white/50" : "w-2 bg-white/20"}`}
              />
            ))}
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="w-full py-4 bg-white text-black rounded-2xl font-bold text-base active:scale-[0.98] transition-transform border-none flex items-center justify-center gap-2"
          >
            {isLast ? "Let's go!" : "Next"}
            {!isLast && <ChevronRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Check if tour should show (hasn't been completed) */
export function shouldShowTour(): boolean {
  return !localStorage.getItem(TOUR_KEY);
}
