import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

interface GroupState {
  groupName: string;
  amount: number;
  totalAmount: number;
  members: string[];
  peopleCount: number;
  paidCount?: number;
  allJoined?: boolean;
}

interface Member {
  name: string;
  isPaid: boolean;
  isHost: boolean;
  hasJoined: boolean;
  justJoined: boolean;
}

function Confetti() {
  const colors = ["#5493b3", "#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"];
  const pieces = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1 + Math.random() * 1,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            left: `${p.left}%`,
            top: "-10px",
            backgroundColor: p.color,
            animation: `confettiFall ${p.duration}s ease-in-out ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

function PaymentModal({
  totalAmount,
  onClose,
  onComplete,
}: {
  totalAmount: number;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [paymentType, setPaymentType] = useState<"buy-goods" | "paybill" | "phone" | null>(null);
  const [tillNumber, setTillNumber] = useState("");
  const [businessNo, setBusinessNo] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [step, setStep] = useState<"select" | "confirm">("select");

  const isFormValid = () => {
    if (paymentType === "buy-goods") return tillNumber.length >= 5;
    if (paymentType === "paybill") return businessNo.length >= 5 && accountNo.length >= 1;
    if (paymentType === "phone") return phoneNumber.length >= 10;
    return false;
  };

  const selectType = (type: typeof paymentType) => {
    setPaymentType(type);
    setTillNumber("");
    setBusinessNo("");
    setAccountNo("");
    setPhoneNumber("");
    setStep("select");
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up">
        {step === "select" ? (
          <>
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-bold text-xl text-black">Pay Driver</h2>
              <button onClick={onClose} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none cursor-pointer">
                ✕
              </button>
            </div>

            <p className="text-center text-sm text-gray-500 mb-5">
              Total: <span className="font-bold text-black">KSH {totalAmount.toLocaleString()}</span>
            </p>

            {/* Payment type pills */}
            <div className="flex gap-2 mb-5">
              {(["buy-goods", "paybill", "phone"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => selectType(type)}
                  className={`flex-1 py-3 rounded-full font-semibold text-xs border transition-colors tap-scale ${
                    paymentType === type
                      ? "bg-black text-white border-black"
                      : "bg-white text-black border-gray-300 hover:border-black"
                  }`}
                >
                  {type === "buy-goods" ? "Buy Goods" : type === "paybill" ? "PayBill" : "Phone"}
                </button>
              ))}
            </div>

            {/* Input fields */}
            {paymentType === "buy-goods" && (
              <div className="mb-5">
                <label className="text-xs text-gray-500 mb-1.5 block">Till Number</label>
                <input
                  type="text"
                  value={tillNumber}
                  onChange={(e) => setTillNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 123456"
                  className="w-full h-12 border border-gray-300 rounded-full px-5 text-base outline-none focus:border-black transition-colors"
                />
              </div>
            )}

            {paymentType === "paybill" && (
              <div className="mb-5 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Business No</label>
                  <input
                    type="text"
                    value={businessNo}
                    onChange={(e) => setBusinessNo(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 247247"
                    className="w-full h-12 border border-gray-300 rounded-full px-5 text-base outline-none focus:border-black transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Account No</label>
                  <input
                    type="text"
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    placeholder="e.g. 0712345678"
                    className="w-full h-12 border border-gray-300 rounded-full px-5 text-base outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>
            )}

            {paymentType === "phone" && (
              <div className="mb-5">
                <label className="text-xs text-gray-500 mb-1.5 block">Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 0712345678"
                  maxLength={12}
                  className="w-full h-12 border border-gray-300 rounded-full px-5 text-base outline-none focus:border-black transition-colors"
                />
              </div>
            )}

            {paymentType && (
              <button
                onClick={() => setStep("confirm")}
                disabled={!isFormValid()}
                className={`w-full h-12 rounded-full font-bold text-base transition-colors tap-scale ${
                  isFormValid()
                    ? "bg-black text-white hover:bg-gray-800"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Continue
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex justify-between items-center mb-5">
              <button
                onClick={() => setStep("select")}
                className="text-sm text-gray-500 hover:text-black bg-transparent border-none cursor-pointer"
              >
                ← Back
              </button>
              <button onClick={onClose} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none cursor-pointer">
                ✕
              </button>
            </div>

            <h2 className="font-bold text-xl text-black text-center mb-6">Confirm Payment</h2>

            <div className="bg-gray-50 rounded-2xl p-5 mb-6">
              {paymentType === "buy-goods" && (
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">Till Number</p>
                  <p className="font-bold text-3xl text-black">{tillNumber}</p>
                </div>
              )}
              {paymentType === "paybill" && (
                <div className="text-center space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Business No</p>
                    <p className="font-bold text-2xl text-black">{businessNo}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Account No</p>
                    <p className="font-bold text-2xl text-black">{accountNo}</p>
                  </div>
                </div>
              )}
              {paymentType === "phone" && (
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">Phone Number</p>
                  <p className="font-bold text-3xl text-black">{phoneNumber}</p>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                <p className="text-sm text-gray-500 mb-1">Amount</p>
                <p className="font-bold text-2xl text-black">KSH {totalAmount.toLocaleString()}</p>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mb-4">
              Please verify the details before confirming
            </p>

            <button
              onClick={onComplete}
              className="w-full h-12 bg-black text-white rounded-full font-bold text-base hover:bg-gray-800 transition-colors tap-scale"
            >
              Confirm & Pay
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function YutoGroupScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as GroupState | null;

  const groupName = state?.groupName || "Fare Share";
  const perPersonAmount = state?.amount || 150;
  const totalAmount = state?.totalAmount || 450;
  const initialMembers = state?.members || ["You", "Jack", "Jane"];
  const initialPaidCount = state?.paidCount || 0;
  const startAllJoined = state?.allJoined || false;

  const joinTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [members, setMembers] = useState<Member[]>(
    initialMembers.map((name, i) => ({
      name,
      isPaid: i < initialPaidCount,
      isHost: i === 0,
      hasJoined: i === 0 || startAllJoined || i < initialPaidCount,
      justJoined: false,
    }))
  );
  const [showConfetti, setShowConfetti] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [driverPaid, setDriverPaid] = useState(false);

  useEffect(() => {
    members.forEach((member, i) => {
      if (!member.hasJoined && !member.isHost) {
        const timer = setTimeout(() => {
          setMembers((prev) =>
            prev.map((m, idx) =>
              idx === i ? { ...m, hasJoined: true, justJoined: true } : m
            )
          );
          setTimeout(() => {
            setMembers((prev) =>
              prev.map((m, idx) => (idx === i ? { ...m, justJoined: false } : m))
            );
          }, 700);
        }, 1200 + i * 1400);
        joinTimers.current.push(timer);
      }
    });
    return () => joinTimers.current.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paidCount = members.filter((m) => m.isPaid).length;
  const joinedCount = members.filter((m) => m.hasJoined).length;
  const allJoined = joinedCount === members.length;
  const allPaid = paidCount === members.length;
  const youPaid = members.find((m) => m.name === "You")?.isPaid || false;
  const fillPercentage = members.length > 0 ? (paidCount / members.length) * 100 : 0;

  const handlePayShare = () => {
    setMembers((prev) => prev.map((m) => (m.name === "You" ? { ...m, isPaid: true } : m)));
    setTimeout(() => {
      setMembers((prev) => prev.map((m) => ({ ...m, isPaid: true })));
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    }, 2000);
  };

  const handlePayDriver = () => setShowPaymentModal(true);

  const handlePaymentComplete = () => {
    setShowPaymentModal(false);
    setDriverPaid(true);
  };

  return (
    <div className="flex flex-col min-h-full px-5 pt-10 pb-6 relative">
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/activity")}
          className="text-gray-400 hover:text-black bg-transparent border-none cursor-pointer text-base"
        >
          ← Back
        </button>
        <button
          onClick={() => navigate(`/yuto/group/chat`, { state: { groupName } })}
          className="p-2 bg-transparent border-none cursor-pointer hover:opacity-70"
        >
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
            <path
              d="M42 23C42 25.64 41.39 28.24 40.2 30.6C38.79 33.42 36.62 35.8 33.93 37.46C31.25 39.12 28.16 40 25 40C22.36 40.01 19.76 39.39 17.4 38.2L6 42L9.8 30.6C8.61 28.24 7.99 25.64 8 23C8 19.84 8.88 16.75 10.54 14.07C12.2 11.38 14.58 9.21 17.4 7.8C19.76 6.61 22.36 5.99 25 6H26C30.17 6.23 34.11 7.99 37.06 10.94C40.01 13.89 41.77 17.83 42 22V23Z"
              stroke="#1E1E1E"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Group info */}
      <div className="text-center mb-1">
        <h1 className="text-3xl font-bold text-black">{groupName}</h1>
        <p className="text-base text-gray-500 mt-0.5">KSH {totalAmount.toLocaleString()} total</p>
      </div>

      {/* Graph / Mind-map layout */}
      <div className="relative w-full max-w-[380px] mx-auto flex-1 min-h-[380px]">
        {/* SVG layer: orbit rings + connection lines */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 380 420"
          preserveAspectRatio="xMidYMid meet"
          style={{ zIndex: 1 }}
        >
          {/* Orbit rings */}
          <circle cx="190" cy="210" r="85" fill="none" stroke="#f0f0f0" strokeWidth="1" />
          <circle
            cx="190" cy="210" r="155"
            fill="none" stroke="#f0f0f0" strokeWidth="1"
            strokeDasharray="4 6"
            style={{ animation: "orbitSpin 60s linear infinite", transformOrigin: "190px 210px" }}
          />
          <circle cx="190" cy="210" r="120" fill="none" stroke="#f7f7f7" strokeWidth="0.5" />

          {/* Pulse ring on center (only when not all paid) */}
          {!allPaid && (
            <>
              <circle
                cx="190" cy="210" r="40"
                fill="none" stroke="#5493b3" strokeWidth="1.5" opacity="0"
              >
                <animate attributeName="r" from="40" to="85" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.3" to="0" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle
                cx="190" cy="210" r="40"
                fill="none" stroke="#5493b3" strokeWidth="1" opacity="0"
              >
                <animate attributeName="r" from="40" to="85" dur="2s" begin="1s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.2" to="0" dur="2s" begin="1s" repeatCount="indefinite" />
              </circle>
            </>
          )}

          {/* Connection ropes from center to each member */}
          {members.map((member, i) => {
            const angle = (i * 2 * Math.PI) / members.length - Math.PI / 2;
            const r = 155;
            const mx = 190 + Math.cos(angle) * r;
            const my = 210 + Math.sin(angle) * r;
            const joined = member.hasJoined;
            const paid = member.isPaid;

            const hangOffset = joined ? 0 : 35;
            const endX = mx;
            const endY = my + hangOffset;

            let pathD: string;
            if (joined) {
              pathD = `M 190 210 L ${mx} ${my}`;
            } else {
              const cpX = (190 + endX) / 2;
              const cpY = (210 + endY) / 2 + 55;
              pathD = `M 190 210 Q ${cpX} ${cpY} ${endX} ${endY}`;
            }

            return (
              <g key={`line-${i}`}>
                {/* Connection rope */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={paid ? "#22c55e" : joined ? "#d1d5db" : "#e0e0e0"}
                  strokeWidth={paid ? 3 : joined ? 2 : 1}
                  strokeDasharray={paid ? "none" : joined ? "7 5" : "4 6"}
                  strokeLinecap="round"
                  className={
                    member.justJoined ? "rope-yank" : paid ? "" : joined ? "graph-line-flowing" : ""
                  }
                />

                {/* Glow behind paid connections */}
                {paid && (
                  <path
                    d={`M 190 210 L ${mx} ${my}`}
                    fill="none"
                    stroke="#22c55e" strokeWidth={8} opacity={0.12} strokeLinecap="round"
                  />
                )}

                {/* Dot at member end (follows hanging position) */}
                <circle
                  cx={endX} cy={endY}
                  r={paid ? 5 : joined ? 4 : 2}
                  fill={paid ? "#22c55e" : joined ? "#d1d5db" : "#e0e0e0"}
                />

                {/* Dot at center end */}
                <circle
                  cx={190 + Math.cos(angle) * 45}
                  cy={210 + Math.sin(angle) * 45}
                  r={2.5}
                  fill={paid ? "#22c55e" : joined ? "#e5e7eb" : "#f5f5f5"}
                />

                {/* Traveling dot on joined but unpaid connections */}
                {joined && !paid && (
                  <circle r="3.5" fill="#5493b3" opacity="0.7">
                    <animateMotion
                      dur="1.5s"
                      repeatCount="indefinite"
                      begin={`${i * 0.4}s`}
                      path={`M190,210 L${mx},${my}`}
                    />
                    <animate attributeName="opacity" values="0;0.8;0.8;0" dur="1.5s" repeatCount="indefinite" begin={`${i * 0.4}s`} />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Center Yuto jar (HTML on top of SVG) */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
          <div
            className={`bg-white rounded-[28px] shadow-xl border-2 w-[160px] h-[195px] relative overflow-hidden transition-all duration-500 ${
              allPaid ? "border-green-400 shadow-green-300/40" : "border-gray-200"
            }`}
          >
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 to-green-400 transition-all duration-1000 ease-out"
              style={{ height: `${fillPercentage}%` }}
            />
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <img src={imgYutoMascot} alt="Yuto" className="w-[72px] h-[72px] object-contain mb-2" />
              <p
                className={`text-2xl font-bold transition-colors duration-300 ${
                  fillPercentage > 50 ? "text-white" : "text-black"
                }`}
              >
                KSH {perPersonAmount}
              </p>
              <p
                className={`text-sm transition-colors duration-300 ${
                  fillPercentage > 50 ? "text-white/80" : "text-gray-400"
                }`}
              >
                per person
              </p>
            </div>
          </div>
        </div>

        {/* Member node bubbles */}
        {members.map((member, i) => {
          const angle = (i * 2 * Math.PI) / members.length - Math.PI / 2;
          const r = 155;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          const joined = member.hasJoined;
          const paid = member.isPaid;
          const hangOffset = joined ? 0 : 35;

          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y + hangOffset}px))`,
                transition: "transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
                zIndex: 20,
              }}
            >
              <div
                className={`flex flex-col items-center ${member.justJoined ? "node-snap-in" : ""}`}
                style={
                  !joined && !member.justJoined
                    ? { filter: "blur(3px)", opacity: 0.5 }
                    : undefined
                }
              >
                <div className={`relative ${paid ? "node-glow" : ""}`}>
                  <div
                    className={`w-[76px] h-[76px] rounded-full flex items-center justify-center font-bold text-2xl border-[3px] transition-colors duration-500 ${
                      paid
                        ? "bg-black border-green-500 text-white shadow-xl shadow-green-500/25"
                        : joined
                        ? "bg-white border-gray-300 text-black shadow-lg"
                        : "bg-gray-100 border-gray-200 text-gray-300 shadow-sm"
                    }`}
                  >
                    {member.name.charAt(0)}
                  </div>
                  {paid && (
                    <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full p-1">
                      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                {joined ? (
                  <p className="text-sm font-semibold mt-2 text-gray-700">{member.name}</p>
                ) : (
                  <p className="text-xs mt-2 text-gray-400 italic whitespace-nowrap">
                    Waiting for {member.name}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status text */}
      <p className="text-center text-base text-gray-500 mt-2 mb-4">
        {driverPaid
          ? "Driver paid! You're all set"
          : allPaid
          ? "Everyone has paid!"
          : !allJoined
          ? `${joinedCount}/${members.length} joined`
          : `${paidCount}/${members.length} have paid`}
      </p>

      {/* Action button */}
      <div>
        {!allJoined ? (
          <button
            disabled
            className="w-full py-5 bg-gray-100 text-gray-400 rounded-full font-bold text-lg cursor-not-allowed"
          >
            Waiting for group to join...
          </button>
        ) : !youPaid ? (
          <button
            onClick={handlePayShare}
            className="w-full py-5 bg-black text-white rounded-full font-bold text-lg hover:bg-gray-800 transition-colors tap-scale"
          >
            Pay KSH {perPersonAmount.toLocaleString()}
          </button>
        ) : !allPaid ? (
          <button
            disabled
            className="w-full py-5 bg-gray-100 text-gray-400 rounded-full font-bold text-lg cursor-not-allowed"
          >
            Waiting for others...
          </button>
        ) : !driverPaid ? (
          <button
            onClick={handlePayDriver}
            className="w-full py-5 bg-black text-white rounded-full font-bold text-lg hover:bg-gray-800 transition-colors tap-scale"
          >
            Pay Driver
          </button>
        ) : (
          <button className="w-full py-5 bg-green-500 text-white rounded-full font-bold text-lg cursor-default">
            Payment Complete ✓
          </button>
        )}
      </div>

      {/* Payment modal */}
      {showPaymentModal && (
        <PaymentModal
          totalAmount={totalAmount}
          onClose={() => setShowPaymentModal(false)}
          onComplete={handlePaymentComplete}
        />
      )}
    </div>
  );
}
