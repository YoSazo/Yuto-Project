import { useEffect, useState } from "react";
import { Copy, Check, Share2, Star } from "lucide-react";
import { supabase } from "../../lib/supabase";
import UserAvatar from "../UserAvatar";

type ReferralUser = { user_id: string; display_name: string; username: string; avatar_url: string | null; converted: boolean; created_at: string };

export function EarningsTab({ userId, username }: { userId: string; username: string; displayName: string }) {
  const [referralCount, setReferralCount] = useState(0);
  const [referralEarned, setReferralEarned] = useState(0);
  const [referralUsers, setReferralUsers] = useState<ReferralUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showAllReferrals, setShowAllReferrals] = useState(false);

  useEffect(() => { loadData(); }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [refs, bonusTx, referralList] = await Promise.all([
        supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId).eq("converted", true),
        supabase.from("transactions").select("amount").eq("user_id", userId).eq("kind", "referral_bonus"),
        supabase.from("referrals").select("referred_id, converted, created_at, profiles:profiles!referrals_referred_id_fkey(display_name, username, avatar_url)").eq("referrer_id", userId).order("created_at", { ascending: false }),
      ]);
      setReferralCount(refs.count ?? 0);
      setReferralEarned((bonusTx.data || []).reduce((sum, t: any) => sum + Math.max(0, Number(t.amount) || 0), 0));
      setReferralUsers(((referralList.data || []) as any[]).map((r) => ({ user_id: r.referred_id, display_name: r.profiles?.display_name || "User", username: r.profiles?.username || "", avatar_url: r.profiles?.avatar_url || null, converted: r.converted, created_at: r.created_at })));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const referralUrl = username ? `https://yuto.social/r/${username}` : "";

  const handleShare = () => {
    const text = `${referralUrl}\n\nJoin me on Yuto 😏 I earn KSH 50 when you do. But guess what — you can earn KSH 50 too by inviting YOUR friends.\n\nSplit bills, send money via Bluetooth, host events — all with M-PESA. Game on.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleCopy = async () => { try { await navigator.clipboard.writeText(referralUrl); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 1500); } catch {} };

  if (loading) return (<div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin" /></div>);

  return (
    <div className="space-y-6 pb-24">
      {/* Referral hero card */}
      <div className="bg-gradient-to-br from-orange-500 to-pink-500 rounded-3xl p-6 text-white relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4"><Star size={20} /><p className="font-bold text-sm uppercase tracking-wider">Refer & Earn</p></div>
          <p className="text-4xl font-black mb-1">KSH {referralEarned.toLocaleString()}</p>
          <p className="text-white/80 text-sm font-semibold">{referralCount} friend{referralCount === 1 ? "" : "s"} referred</p>
          <p className="text-white/60 text-xs mt-3">Earn KSH 50 every time a friend signs up with your link and tops up for the first time.</p>
        </div>
      </div>

      {/* Share actions */}
      <div className="flex gap-3">
        <button type="button" onClick={handleShare} className="flex-1 py-3.5 bg-green-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform border-none"><Share2 size={16} /> Share on WhatsApp</button>
        <button type="button" onClick={handleCopy} className="py-3.5 px-5 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border-none">{copiedLink ? <Check size={16} /> : <Copy size={16} />}{copiedLink ? "Copied" : "Copy"}</button>
      </div>

      {/* Referral user list */}
      {referralUsers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Your referrals ({referralUsers.length})</p>
            {referralUsers.length > 5 && (<button type="button" onClick={() => setShowAllReferrals(!showAllReferrals)} className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-transparent border-none">{showAllReferrals ? "Show less" : "Show all"}</button>)}
          </div>
          <div className="space-y-2">
            {(showAllReferrals ? referralUsers : referralUsers.slice(0, 5)).map((u) => (
              <div key={u.user_id} className="flex items-center gap-3 py-2 px-3 bg-gray-50 dark:bg-zinc-900 rounded-xl">
                <UserAvatar name={u.display_name} avatarUrl={u.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-black dark:text-white truncate">{u.display_name}</p>
                  <p className="text-xs text-gray-400">@{u.username}</p>
                </div>
                {u.converted ? (<span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">+KSH 50</span>) : (<span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">Pending</span>)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl p-5 space-y-3">
        <p className="font-bold text-black dark:text-white text-sm">How it works</p>
        <div className="flex items-start gap-3"><div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center shrink-0 text-xs font-bold">1</div><p className="text-sm text-gray-600 dark:text-gray-400">Share your link with friends</p></div>
        <div className="flex items-start gap-3"><div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center shrink-0 text-xs font-bold">2</div><p className="text-sm text-gray-600 dark:text-gray-400">They sign up and top up their wallet</p></div>
        <div className="flex items-start gap-3"><div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center shrink-0 text-xs font-bold">3</div><p className="text-sm text-gray-600 dark:text-gray-400">You earn KSH 50 instantly — no limit</p></div>
      </div>
    </div>
  );
}
