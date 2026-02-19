import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import { useAuth } from "../contexts/AuthContext";
import { supabase, getGroup, joinGroup } from "../lib/supabase";

interface Member {
  user_id: string;
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

function MpesaModal({
  amount,
  groupId,
  userId,
  onClose,
}: {
  amount: number;
  groupId: string;
  userId: string;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState("254");
  const [step, setStep] = useState<"input" | "sending" | "waiting" | "error">("input");
  const [error, setError] = useState("");

  const handlePay = async () => {
    if (phone.length < 12) {
      setError("Enter a valid phone number (e.g. 254712345678)");
      return;
    }

    setStep("sending");
    setError("");

    try {
      const res = await fetch("/api/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phone,
          amount,
          group_id: groupId,
          user_id: userId,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setStep("waiting");
      } else {
        setError(data.message || "Failed to initiate payment");
        setStep("error");
      }
    } catch {
      setError("Network error. Please try again.");
      setStep("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up">
        {step === "input" || step === "error" ? (
          <>
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-bold text-xl text-black">Pay with M-PESA</h2>
              <button
                onClick={onClose}
                className="text-2xl text-gray-400 hover:text-black bg-transparent border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-center text-sm text-gray-500 mb-5">
              Amount: <span className="font-bold text-black">KSH {amount.toLocaleString()}</span>
            </p>

            <div className="mb-5">
              <label className="text-xs text-gray-500 mb-1.5 block">M-PESA Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="254712345678"
                maxLength={12}
                className="w-full h-12 border border-gray-300 rounded-full px-5 text-base outline-none focus:border-black transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1.5 ml-2">Format: 254 followed by your number</p>
            </div>

            {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

            <button
              onClick={handlePay}
              disabled={phone.length < 12}
              className={`w-full h-12 rounded-full font-bold text-base transition-colors ${
                phone.length >= 12
                  ? "bg-black text-white hover:bg-gray-800"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Pay KSH {amount.toLocaleString()}
            </button>
          </>
        ) : step === "sending" ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full mx-auto mb-4 animate-spin" />
            <p className="font-bold text-lg text-black">Sending to your phone...</p>
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </div>
            <p className="font-bold text-lg text-black mb-2">Check your phone</p>
            <p className="text-sm text-gray-500">Enter your M-PESA PIN to complete payment</p>
            <p className="text-xs text-gray-400 mt-6">This will close automatically once confirmed</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function YutoGroupScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [groupName, setGroupName] = useState("Fare Share");
  const [perPersonAmount, setPerPersonAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [createdBy, setCreatedBy] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [driverPaid, setDriverPaid] = useState(false);
  const justJoinedTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Fetch group data on mount
  useEffect(() => {
    if (!groupId || !user) return;

    (async () => {
      try {
        const data = await getGroup(groupId);
        setGroupName(data.name);
        setPerPersonAmount(data.per_person);
        setTotalAmount(data.total_amount);
        setCreatedBy(data.created_by);

        const list: Member[] = data.group_members.map((gm: any) => ({
          user_id: gm.user_id,
          name: gm.profiles.display_name,
          isPaid: gm.has_paid,
          isHost: gm.user_id === data.created_by,
          hasJoined: gm.has_joined,
          justJoined: false,
        }));
        setMembers(list);

        // Auto-join if I haven't yet
        const me = data.group_members.find((gm: any) => gm.user_id === user.id);
        if (me && !me.has_joined) {
          await joinGroup(groupId, user.id);
          setMembers((prev) =>
            prev.map((m) => (m.user_id === user.id ? { ...m, hasJoined: true } : m))
          );
        }
      } catch (err) {
        console.error("Failed to load group:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId, user]);

  // Real-time subscription for live updates
  useEffect(() => {
    if (!groupId || !user) return;

    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "group_members",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const updated = payload.new as {
            user_id: string;
            has_joined: boolean;
            has_paid: boolean;
          };
          const isMe = updated.user_id === user.id;

          setMembers((prev) => {
            const existing = prev.find((m) => m.user_id === updated.user_id);
            if (!existing) return prev;

            const wasJoined = existing.hasJoined;
            return prev.map((m) => {
              if (m.user_id !== updated.user_id) return m;
              return {
                ...m,
                hasJoined: updated.has_joined,
                isPaid: updated.has_paid,
                justJoined: !isMe && !wasJoined && updated.has_joined,
              };
            });
          });

          // Clear justJoined flag after animation
          if (!isMe && updated.has_joined) {
            const timer = setTimeout(() => {
              setMembers((prev) =>
                prev.map((m) =>
                  m.user_id === updated.user_id ? { ...m, justJoined: false } : m
                )
              );
            }, 700);
            justJoinedTimers.current.push(timer);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      justJoinedTimers.current.forEach(clearTimeout);
    };
  }, [groupId, user]);

  // Confetti when all paid
  const allPaidRef = useRef(false);
  useEffect(() => {
    const allPaid = members.length > 0 && members.every((m) => m.isPaid);
    if (allPaid && !allPaidRef.current) {
      allPaidRef.current = true;
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    }
  }, [members]);

  const paidCount = members.filter((m) => m.isPaid).length;
  const joinedCount = members.filter((m) => m.hasJoined).length;
  const allJoined = members.length > 0 && joinedCount === members.length;
  const allPaid = members.length > 0 && paidCount === members.length;
  const youPaid = members.find((m) => m.user_id === user?.id)?.isPaid || false;
  const fillPercentage = members.length > 0 ? (paidCount / members.length) * 100 : 0;

  // Auto-close payment modal when real-time confirms payment
  useEffect(() => {
    if (youPaid && showPayModal) setShowPayModal(false);
  }, [youPaid, showPayModal]);

  const handlePayShare = () => setShowPayModal(true);
  const handlePayDriver = () => setDriverPaid(true);

  if (loading) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

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
          onClick={() => navigate(`/yuto/${groupId}/chat`, { state: { groupName } })}
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
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-black">{groupName}</h1>
        <p className="text-base text-gray-500 mt-0.5">KSH {totalAmount.toLocaleString()} total</p>
      </div>

      {/* Graph / Mind-map layout */}
      <div className="relative w-full max-w-[380px] mx-auto flex-1 min-h-[380px]">
        {/* SVG layer */}
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

          {!allPaid && (
            <>
              <circle cx="190" cy="210" r="40" fill="none" stroke="#5493b3" strokeWidth="1.5" opacity="0">
                <animate attributeName="r" from="40" to="85" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.3" to="0" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="190" cy="210" r="40" fill="none" stroke="#5493b3" strokeWidth="1" opacity="0">
                <animate attributeName="r" from="40" to="85" dur="2s" begin="1s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.2" to="0" dur="2s" begin="1s" repeatCount="indefinite" />
              </circle>
            </>
          )}

          {/* Connection ropes */}
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
                {paid && (
                  <path
                    d={`M 190 210 L ${mx} ${my}`}
                    fill="none" stroke="#22c55e" strokeWidth={8} opacity={0.12} strokeLinecap="round"
                  />
                )}
                <circle cx={endX} cy={endY} r={paid ? 5 : joined ? 4 : 2}
                  fill={paid ? "#22c55e" : joined ? "#d1d5db" : "#e0e0e0"} />
                <circle
                  cx={190 + Math.cos(angle) * 45} cy={210 + Math.sin(angle) * 45}
                  r={2.5} fill={paid ? "#22c55e" : joined ? "#e5e7eb" : "#f5f5f5"} />
                {joined && !paid && (
                  <circle r="3.5" fill="#5493b3" opacity="0.7">
                    <animateMotion dur="1.5s" repeatCount="indefinite" begin={`${i * 0.4}s`}
                      path={`M190,210 L${mx},${my}`} />
                    <animate attributeName="opacity" values="0;0.8;0.8;0" dur="1.5s"
                      repeatCount="indefinite" begin={`${i * 0.4}s`} />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Center Yuto jar */}
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
              <p className={`text-2xl font-bold transition-colors duration-300 ${
                fillPercentage > 50 ? "text-white" : "text-black"
              }`}>
                KSH {perPersonAmount}
              </p>
              <p className={`text-sm transition-colors duration-300 ${
                fillPercentage > 50 ? "text-white/80" : "text-gray-400"
              }`}>
                per person
              </p>
            </div>
          </div>
        </div>

        {/* Member nodes */}
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
              key={member.user_id}
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
                        <path fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                {joined ? (
                  <p className="text-sm font-semibold mt-2 text-gray-700">
                    {member.user_id === user?.id ? "You" : member.name}
                  </p>
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
          <button disabled
            className="w-full py-5 bg-gray-100 text-gray-400 rounded-full font-bold text-lg cursor-not-allowed">
            Waiting for group to join...
          </button>
        ) : !youPaid ? (
          <button onClick={handlePayShare}
            className="w-full py-5 bg-black text-white rounded-full font-bold text-lg hover:bg-gray-800 transition-colors tap-scale">
            Pay KSH {perPersonAmount.toLocaleString()}
          </button>
        ) : !allPaid ? (
          <button disabled
            className="w-full py-5 bg-gray-100 text-gray-400 rounded-full font-bold text-lg cursor-not-allowed">
            Waiting for others...
          </button>
        ) : !driverPaid ? (
          <button onClick={handlePayDriver}
            className="w-full py-5 bg-black text-white rounded-full font-bold text-lg hover:bg-gray-800 transition-colors tap-scale">
            Complete Split
          </button>
        ) : (
          <button className="w-full py-5 bg-green-500 text-white rounded-full font-bold text-lg cursor-default">
            Split Complete
          </button>
        )}
      </div>

      {/* M-PESA Payment Modal */}
      {showPayModal && groupId && user && (
        <MpesaModal
          amount={perPersonAmount}
          groupId={groupId}
          userId={user.id}
          onClose={() => setShowPayModal(false)}
        />
      )}
    </div>
  );
}
