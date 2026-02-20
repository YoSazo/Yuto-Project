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

export default function HomeScreen() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myTotalPaid, setMyTotalPaid] = useState(0);
  const [bestGroup, setBestGroup] = useState<GroupEntry | null>(null);
  const [brokestGroup, setBrokestGroup] = useState<GroupEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      // Get global leaderboard — sum of per_person paid per user across completed groups
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id, has_paid, groups(per_person, status), profiles(id, display_name, username, avatar_url)")
        .eq("has_paid", true);

      if (members) {
        // Aggregate by user
        const userTotals = new Map<string, { display_name: string; username: string; avatar_url: string | null; total: number }>();
        members.forEach((m: any) => {
          if (!m.profiles || !m.groups) return;
          const uid = m.user_id;
          const perPerson = m.groups.per_person || 0;
          const existing = userTotals.get(uid);
          if (existing) {
            existing.total += perPerson;
          } else {
            userTotals.set(uid, {
              display_name: m.profiles.display_name,
              username: m.profiles.username,
              avatar_url: m.profiles.avatar_url,
              total: perPerson,
            });
          }
        });

        // Sort and rank
        const sorted = Array.from(userTotals.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .map(([uid, data], i) => ({
            user_id: uid,
            display_name: data.display_name,
            username: data.username,
            avatar_url: data.avatar_url,
            total_paid: data.total,
            rank: i + 1,
          }));

        setLeaderboard(sorted.slice(0, 10));

        const myEntry = sorted.find((e) => e.user_id === user!.id);
        if (myEntry) {
          setMyRank(myEntry.rank);
          setMyTotalPaid(myEntry.total_paid);
        }
      }

      // Best group — highest total_amount completed
      const { data: groups } = await supabase
        .from("groups")
        .select("id, name, total_amount, created_at, group_members(count)")
        .eq("status", "completed")
        .order("total_amount", { ascending: false })
        .limit(1)
        .single();

      if (groups) {
        setBestGroup({
          id: groups.id,
          name: groups.name,
          total_amount: groups.total_amount,
          member_count: (groups.group_members as any)?.[0]?.count || 0,
          created_at: groups.created_at,
        });
      }

      // Brokest group — lowest total_amount completed with at least 2 members
      const { data: brokeGroups } = await supabase
        .from("groups")
        .select("id, name, total_amount, created_at, group_members(count)")
        .eq("status", "completed")
        .order("total_amount", { ascending: true })
        .limit(1)
        .single();

      if (brokeGroups) {
        setBrokestGroup({
          id: brokeGroups.id,
          name: brokeGroups.name,
          total_amount: brokeGroups.total_amount,
          member_count: (brokeGroups.group_members as any)?.[0]?.count || 0,
          created_at: brokeGroups.created_at,
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
          <p className="text-white/60 text-sm mb-1">Your global rank</p>
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
        {brokestGroup && (
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-4">
            <p className="text-gray-500 font-bold text-xs mb-2">💸 Brokest Group</p>
            <p className="font-bold text-black text-sm truncate">{brokestGroup.name}</p>
            <p className="text-gray-600 font-bold text-lg">KSH {brokestGroup.total_amount.toLocaleString()}</p>
            <p className="text-gray-400 text-xs">{brokestGroup.member_count} people</p>
          </div>
        )}
      </div>

      {/* Global Leaderboard */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="font-bold text-black">🏆 Global Leaderboard</p>
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
                className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${isMe ? "bg-green-50" : ""}`}
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
                  <p className={`font-semibold text-sm truncate ${isMe ? "text-green-700" : "text-black"}`}>
                    {entry.display_name} {isMe && "(you)"}
                  </p>
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
