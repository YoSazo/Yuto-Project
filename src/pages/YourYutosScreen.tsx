import { useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

interface YutoItem {
  id: string;
  name: string;
  totalAmount: number;
  perPerson: number;
  members: string[];
  paidCount: number;
  status: "active" | "completed";
  time: string;
}

const myYutos: YutoItem[] = [
  {
    id: "1",
    name: "Uber to Westlands",
    totalAmount: 450,
    perPerson: 150,
    members: ["You", "Jack", "Jane"],
    paidCount: 2,
    status: "active",
    time: "2 min ago",
  },
  {
    id: "2",
    name: "Bolt to CBD",
    totalAmount: 300,
    perPerson: 150,
    members: ["You", "Mike"],
    paidCount: 1,
    status: "active",
    time: "1 hr ago",
  },
  {
    id: "3",
    name: "Uber to Karen",
    totalAmount: 800,
    perPerson: 200,
    members: ["You", "Jack", "Sara", "Mike"],
    paidCount: 4,
    status: "completed",
    time: "Yesterday",
  },
  {
    id: "4",
    name: "Bolt Home",
    totalAmount: 600,
    perPerson: 200,
    members: ["You", "Sara", "Jane"],
    paidCount: 3,
    status: "completed",
    time: "2 days ago",
  },
];

function YutoCard({ yuto, onClick }: { yuto: YutoItem; onClick: () => void }) {
  const progress = (yuto.paidCount / yuto.members.length) * 100;
  const isActive = yuto.status === "active";

  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-left transition-all tap-scale hover:border-gray-300"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base text-black truncate">{yuto.name}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            KSH {yuto.perPerson.toLocaleString()} each · {yuto.members.length} people
          </p>
        </div>
        <span
          className={`text-xs font-semibold px-3 py-1 rounded-full ml-3 flex-shrink-0 ${
            isActive ? "bg-black text-white" : "bg-gray-100 text-gray-500"
          }`}
        >
          {isActive ? "Active" : "Done"}
        </span>
      </div>

      {isActive && (
        <div className="mb-2">
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-black rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {yuto.paidCount}/{yuto.members.length} paid
          </p>
        </div>
      )}

      {/* Member avatars + time */}
      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {yuto.members.slice(0, 4).map((name, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-600"
            >
              {name.charAt(0)}
            </div>
          ))}
          {yuto.members.length > 4 && (
            <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-400">
              +{yuto.members.length - 4}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400">{yuto.time}</span>
      </div>
    </button>
  );
}

export default function YourYutosScreen() {
  const navigate = useNavigate();

  const activeYutos = myYutos.filter((y) => y.status === "active");
  const completedYutos = myYutos.filter((y) => y.status === "completed");

  const handleTapYuto = (yuto: YutoItem) => {
    navigate(`/yuto/${yuto.id}`, {
      state: {
        groupName: yuto.name,
        amount: yuto.perPerson,
        totalAmount: yuto.totalAmount,
        members: yuto.members,
        peopleCount: yuto.members.length,
        paidCount: yuto.paidCount,
        allJoined: true,
      },
    });
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-14">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <img src={imgYutoMascot} alt="Yuto" className="w-10 h-10 object-contain" />
        <span className="text-2xl font-bold text-black">Activity</span>
      </div>

      {/* Active section */}
      {activeYutos.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Active
          </p>
          <div className="flex flex-col gap-3">
            {activeYutos.map((yuto) => (
              <YutoCard key={yuto.id} yuto={yuto} onClick={() => handleTapYuto(yuto)} />
            ))}
          </div>
        </div>
      )}

      {/* Completed section */}
      {completedYutos.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Completed
          </p>
          <div className="flex flex-col gap-3">
            {completedYutos.map((yuto) => (
              <YutoCard key={yuto.id} yuto={yuto} onClick={() => handleTapYuto(yuto)} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {myYutos.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
              <path d="M5 17h14v-5l-1.5-4.5h-11L5 12v5z" />
              <circle cx="7" cy="17" r="2" />
              <circle cx="17" cy="17" r="2" />
            </svg>
          </div>
          <p className="font-bold text-lg text-gray-400 mb-2">No splits yet</p>
          <p className="text-sm text-gray-400">Split your first fare to see it here</p>
        </div>
      )}
    </div>
  );
}
