import { useState, useEffect } from "react";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";

interface LeaderEntry {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  total_paid: number;
  rank: number;
}

interface GroupEntry {
  id: string;
  name: string;
  total_amount: number;
  member_count: number;
  created_at: string;
}

interface BrokestEntry {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  total_paid: number;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myTotalPaid, setMyTotalPaid] = useState(0);
  const [bestGroup, setBestGroup] = useState<GroupEntry | null>(null);
  const [brokest, setBrokest] = useState<BrokestEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      // Kenyan Leaderboard — use public view that bypasses RLS
      const { data: board } = await supabase
        .from("leaderboard")
        .select("user_id, display_name, username, avatar_url, total_paid")
        .order("total_paid", { ascending: false })
        .limit(50);

      if (board) {
        const ranked = board.map((entry: any, i: number) => ({
          ...entry,
          rank: i + 1,
        }));
        setLeaderboard(ranked.slice(0, 10));
        const myEntry = ranked.find((e: any) => e.user_id === user!.id);
        if (myEntry) {
          setMyRank(myEntry.rank);
          setMyTotalPaid(myEntry.total_paid);
        }
        // Brokest person — last on the leaderboard with at least some activity
        const withActivity = ranked.filter((e: any) => e.total_paid > 0);
        if (withActivity.length > 0) {
          const last = withActivity[withActivity.length - 1];
          setBrokest({
            user_id: last.user_id,
            display_name: last.display_name,
            username: last.username,
            avatar_url: last.avatar_url,
            total_paid: last.total_paid,
          });
        }
      }

      // Best group — highest total_amount completed
      const { data: bestGroups } = await supabase
        .from("public_groups")
        .select("id, name, total_amount, created_at, member_count")
        .order("total_amount", { ascending: false })
        .limit(1);

      if (bestGroups && bestGroups.length > 0) {
        const g = bestGroups[0];
        setBestGroup({
          id: g.id,
          name: g.name,
          total_amount: g.total_amount,
          member_count: g.member_count || 0,
          created_at: g.created_at,
        });
      }

    } catch (err) {
      console.error("Failed to load home data:", err);
    } finally {
      setLoading(false);
    }
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-28 px-5 pt-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <img src={imgYutoMascot} alt="Yuto" className="w-10 h-10 object-contain" />
        <span className="text-2xl font-bold text-black">Home</span>
      </div>

      {/* My Rank Card */}
      <div className="bg-black rounded-2xl p-5 mb-5 flex items-center justify-between">
        <div>
          <p className="text-white/60 text-sm mb-1">Your Kenyan rank</p>
          <p className="text-white font-bold text-4xl">
            {myRank ? getRankEmoji(myRank) : "—"}
          </p>
          {myRank && myRank > 3 && (
            <p className="text-white/60 text-sm mt-1">#{myRank} on Yuto</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-white/60 text-sm mb-1">Total paid</p>
          <p className="text-green-400 font-bold text-2xl">
            KSH {myTotalPaid.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Best & Brokest Groups */}
      <div className="flex gap-3 mb-5">
        {bestGroup && (
          <div className="flex-1 bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-green-600 font-bold text-xs mb-2">🔥 Most Active</p>
            <p className="font-bold text-black text-sm truncate">{bestGroup.name}</p>
            <p className="text-green-600 font-bold text-lg">KSH {bestGroup.total_amount.toLocaleString()}</p>
            <p className="text-gray-400 text-xs">{bestGroup.member_count} people</p>
          </div>
        )}
        {brokest && (
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-4">
            <p className="text-gray-500 font-bold text-xs mb-2">💸 Watu Broke</p>
            <div className="flex items-center gap-2 mb-1">
              <UserAvatar name={brokest.display_name} avatarUrl={brokest.avatar_url} size="sm" />
              <p className="font-bold text-black text-sm truncate">{brokest.display_name}</p>
            </div>
            <p className="text-gray-600 font-bold text-lg">KSH {brokest.total_paid.toLocaleString()}</p>
            <p className="text-gray-400 text-xs">@{brokest.username}</p>
            <span className="inline-block mt-2 text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
              Tumeshangaa this brokeness
            </span>
          </div>
        )}
      </div>

      {/* Global Leaderboard */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="font-bold text-black">🏆 Watu Pesa | Kenya Leaderboard</p>
          <p className="text-xs text-gray-400 mt-0.5">Ranked by KSH paid</p>
        </div>
        {leaderboard.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            No splits yet — be the first on the board!
          </div>
        ) : (
          leaderboard.map((entry) => {
            const isMe = entry.user_id === user?.id;
            return (
              <div
                key={entry.user_id}
                className={`flex items-center gap-3 px-4 py-4 border-b border-gray-50 last:border-0 last:pb-5 ${isMe ? "bg-green-50" : ""}`}
              >
                {/* Rank */}
                <div className="w-8 text-center font-bold text-sm">
                  {getRankEmoji(entry.rank)}
                </div>

                {/* Avatar */}
                <UserAvatar
                  name={entry.display_name}
                  avatarUrl={entry.avatar_url}
                  size="sm"
                />

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold text-sm truncate ${isMe ? "text-green-700" : "text-black"}`}>
                      {entry.display_name} {isMe && "(you)"}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">@{entry.username}</p>
                </div>

                {/* Amount */}
                <p className={`font-bold text-sm ${isMe ? "text-green-600" : "text-black"}`}>
                  KSH {entry.total_paid.toLocaleString()}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* My rank if outside top 10 */}
      {myRank && myRank > 10 && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 text-center font-bold text-sm text-green-600">#{myRank}</div>
          <p className="text-green-700 font-semibold text-sm flex-1">You</p>
          <p className="text-green-600 font-bold text-sm">KSH {myTotalPaid.toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}
