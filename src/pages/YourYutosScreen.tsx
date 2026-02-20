import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import { useAuth } from "../contexts/AuthContext";
import { getMyGroups, supabase } from "../lib/supabase";

interface GroupMember {
  user_id: string;
  has_joined: boolean;
  has_paid: boolean;
  profiles: { id: string; username: string; display_name: string };
}

interface GroupData {
  id: string;
  name: string;
  total_amount: number;
  per_person: number;
  status: string;
  created_at: string;
  group_members: GroupMember[];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function YutoCard({ group, onClick, onDelete }: { group: GroupData; onClick: () => void; onDelete?: () => void }) {
  const members = group.group_members;
  const paidCount = members.filter((m) => m.has_paid).length;
  const progress = members.length > 0 ? (paidCount / members.length) * 100 : 0;
  const isActive = group.status === "active";

  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-left transition-all tap-scale hover:border-gray-300"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base text-black truncate">{group.name}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            KSH {group.per_person.toLocaleString()} each · {members.length} people
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              isActive ? "bg-black text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            {isActive ? "Active" : "Done"}
          </span>
          {!isActive && onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 transition-colors border-none cursor-pointer"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          )}
        </div>
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
            {paidCount}/{members.length} paid
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {members.slice(0, 4).map((m, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-600"
            >
              {m.profiles.display_name.charAt(0).toUpperCase()}
            </div>
          ))}
          {members.length > 4 && (
            <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-400">
              +{members.length - 4}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400">{timeAgo(group.created_at)}</span>
      </div>
    </button>
  );
}

export default function YourYutosScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getMyGroups()
      .then((data) => setGroups(data as GroupData[]))
      .finally(() => setLoading(false));
  }, [user]);

  const activeGroups = groups.filter((g) => g.status === "active");
  const completedGroups = groups.filter((g) => g.status === "completed");

  const handleDelete = async (groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    try {
      await supabase.from("groups").delete().eq("id", groupId);
    } catch (err) {
      console.error("Failed to delete group:", err);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-14">
      <div className="flex items-center gap-3 mb-8">
        <img src={imgYutoMascot} alt="Yuto" className="w-10 h-10 object-contain" />
        <span className="text-2xl font-bold text-black">Your Yuto's</span>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">Loading...</p>
        </div>
      ) : (
        <>
          {activeGroups.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Active
              </p>
              <div className="flex flex-col gap-3">
                {activeGroups.map((g) => (
                  <YutoCard
                    key={g.id}
                    group={g}
                    onClick={() => navigate(`/yuto/${g.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {completedGroups.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Completed
              </p>
              <div className="flex flex-col gap-3">
                {completedGroups.map((g) => (
                  <YutoCard
                    key={g.id}
                    group={g}
                    onClick={() => navigate(`/yuto/${g.id}`)}
                    onDelete={() => handleDelete(g.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {groups.length === 0 && (
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
        </>
      )}
    </div>
  );
}
