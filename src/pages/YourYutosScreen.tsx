import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import { useAuth } from "../contexts/AuthContext";
import { getMyGroups, getMyTicketsAndPurchases, supabase } from "../lib/supabase";
import type { FunctionListing } from "./home/types";
import { FunctionTicketModal } from "../components/home/FunctionTicketModal";

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
  created_by: string;
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
  const members = group.group_members ?? [];
  const paidCount = members.filter((m) => m.has_paid).length;
  const progress = members.length > 0 ? (paidCount / members.length) * 100 : 0;
  const isActive = group.status === "active";
  const isCancelled = group.status === "cancelled";

  return (
    <button
      onClick={onClick}
      className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 text-left transition-all tap-scale hover:border-gray-300 dark:hover:border-zinc-700"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base text-black dark:text-white truncate">{group.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            KSH {group.per_person.toLocaleString()} each · {members.length} people
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              isActive ? "bg-black dark:bg-white text-white dark:text-black" : isCancelled ? "bg-red-50 text-red-500 dark:bg-red-500/20 dark:text-red-400" : "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {isActive ? "Active" : isCancelled ? "Cancelled" : "Done"}
          </span>
          {(!isActive || members.length === 0) && onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 transition-colors border-none cursor-pointer"
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
          <div className="w-full h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-black dark:bg-white rounded-full transition-all duration-500"
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
              className="w-6 h-6 rounded-full bg-gray-200 dark:bg-zinc-700 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300"
            >
              {m.profiles.display_name.charAt(0).toUpperCase()}
            </div>
          ))}
          {members.length > 4 && (
            <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[9px] font-bold text-gray-400">
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
  const [tab, setTab] = useState<"splits" | "tickets">("splits");
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [tickets, setTickets] = useState<Array<{ function_id: string; count: number; functionItem: FunctionListing }>>([]);
  const [loading, setLoading] = useState(true);
  const [ticketOpen, setTicketOpen] = useState<FunctionListing | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([getMyGroups(), getMyTicketsAndPurchases(user.id)])
      .then(([g, t]) => {
        setGroups(g as GroupData[]);
        setTickets(t as any);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const activeGroups = groups.filter((g) => g.status === "active");
  const completedGroups = groups.filter((g) => g.status === "completed" || g.status === "funded" || g.status === "cancelled");

  const handleDelete = async (groupId: string, createdBy: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    try {
      if (user?.id === createdBy) {
        await supabase.from("groups").delete().eq("id", groupId);
      } else {
        await supabase.rpc("leave_split_group", { p_group_id: groupId, p_user_id: user?.id });
      }
    } catch (err) {
      console.error("Failed to delete/leave group:", err);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-14 bg-white dark:bg-black text-black dark:text-white transition-colors">
      <div className="flex items-center gap-3 mb-8">
        <img src={imgYutoMascot} alt="Yuto" className="w-10 h-10 object-contain" />
        <span className="text-2xl font-bold text-black dark:text-white">Activity</span>
      </div>

      <div className="mb-6">
        <div className="bg-gray-100 rounded-full p-1 flex">
          <button
            type="button"
            onClick={() => setTab("splits")}
            className={`flex-1 h-11 rounded-full font-bold text-sm transition-colors ${
              tab === "splits" ? "bg-black text-white" : "bg-transparent text-gray-500"
            }`}
          >
            Splits
          </button>
          <button
            type="button"
            onClick={() => setTab("tickets")}
            className={`flex-1 h-11 rounded-full font-bold text-sm transition-colors ${
              tab === "tickets" ? "bg-black text-white" : "bg-transparent text-gray-500"
            }`}
          >
            Tickets & Purchases
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">Loading...</p>
        </div>
      ) : (
        <>
          {tab === "splits" && activeGroups.length > 0 && (
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

          {tab === "splits" && completedGroups.length > 0 && (
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
                    onDelete={() => handleDelete(g.id, g.created_by)}
                  />
                ))}
              </div>
            </div>
          )}

          {tab === "splits" && groups.length === 0 && (
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

          {tab === "tickets" && tickets.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Tickets & Purchases
              </p>
              <div className="flex flex-col gap-3">
                {tickets.map((row) => {
                  const t = row.functionItem;
                  const isSell = t.location === "__SELL__";
                  const isService = t.location === "__SERVICE__";
                  const chip = isSell ? "Storefront" : isService ? "Services" : "Ticket";
                  const sub = isSell
                    ? `Sold by ${t.host.display_name}`
                    : isService
                      ? `Provided by ${t.host.display_name}`
                      : `${t.host.display_name} · KSH ${t.amount_per_person.toLocaleString()}`;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTicketOpen(t)}
                      className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-left transition-all tap-scale hover:border-gray-300"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-base text-black truncate">{t.title}</p>
                          <p className="text-sm text-gray-500 mt-0.5 truncate">{sub}</p>
                          {!isSell && !isService && row.count > 1 && (
                            <p className="text-xs text-gray-400 mt-1 font-semibold">
                              {row.count} tickets
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-700 shrink-0">
                          {chip}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "tickets" && tickets.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                  <path d="M22 10V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4" />
                  <path d="M2 14v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4" />
                  <path d="M13 5v2" />
                  <path d="M13 17v2" />
                  <path d="M13 11v2" />
                </svg>
              </div>
              <p className="font-bold text-lg text-gray-400 mb-2">No tickets yet</p>
              <p className="text-sm text-gray-400">Tickets and purchases you’ve paid for will show here</p>
            </div>
          )}
        </>
      )}

      {ticketOpen && user && (
        <FunctionTicketModal
          functionItem={ticketOpen}
          attendeeDisplayName={"You"}
          userId={user.id}
          onClose={() => setTicketOpen(null)}
        />
      )}
    </div>
  );
}
