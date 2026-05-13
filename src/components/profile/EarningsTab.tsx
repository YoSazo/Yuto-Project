import { useEffect, useState } from "react";
import { Copy, Check, Share2, Users, TrendingUp, Zap, Crown, Star, ChevronRight, Trophy } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import UserAvatar from "../UserAvatar";
import { DEV_USER_ID } from "../home/DevAnnouncementCard";

// Set to true to see dummy data without running the SQL migration
const LOCAL_PREVIEW = false;

type CreatorData = { user_id: string; status: string; total_users_brought: number; total_earned_kes: number; recruited_by: string | null };
type EarningRow = { id: string; trigger_type: string; trigger_amount: number; earning_kes: number; tier: number; created_at: string };
type AttributedUser = { user_id: string; display_name: string; username: string; avatar_url: string | null; attributed_at: string; converted: boolean };
type ReferralUser = { user_id: string; display_name: string; username: string; avatar_url: string | null; converted: boolean; created_at: string };

const DUMMY_CREATOR: CreatorData = { user_id: "dummy", status: "active", total_users_brought: 47, total_earned_kes: 3420, recruited_by: null };
const DUMMY_EARNINGS: EarningRow[] = [
  { id: "1", trigger_type: "topup", trigger_amount: 1000, earning_kes: 28, tier: 1, created_at: new Date().toISOString() },
  { id: "2", trigger_type: "withdrawal", trigger_amount: 2000, earning_kes: 35, tier: 1, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: "3", trigger_type: "topup", trigger_amount: 500, earning_kes: 4.2, tier: 2, created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: "4", trigger_type: "topup", trigger_amount: 3000, earning_kes: 84, tier: 1, created_at: new Date(Date.now() - 86400000).toISOString() },
];
const DUMMY_USERS: AttributedUser[] = [
  { user_id: "u1", display_name: "Kevin Ochieng", username: "kevo_254", avatar_url: null, attributed_at: "2026-05-01", converted: true },
  { user_id: "u2", display_name: "Amina Hassan", username: "amina.h", avatar_url: null, attributed_at: "2026-05-03", converted: true },
  { user_id: "u3", display_name: "Brian Kiprop", username: "bkiprop", avatar_url: null, attributed_at: "2026-05-05", converted: false },
  { user_id: "u4", display_name: "Wanjiku M", username: "wanjiku_m", avatar_url: null, attributed_at: "2026-05-07", converted: true },
  { user_id: "u5", display_name: "Salim Abdalla", username: "salim99", avatar_url: null, attributed_at: "2026-05-08", converted: false },
];
const DUMMY_REFERRALS: ReferralUser[] = [
  { user_id: "r1", display_name: "Grace Wambui", username: "grace_w", avatar_url: null, converted: true, created_at: "2026-05-02" },
  { user_id: "r2", display_name: "James Mwangi", username: "jmwangi", avatar_url: null, converted: true, created_at: "2026-05-04" },
  { user_id: "r3", display_name: "Fatima Ali", username: "fatima.a", avatar_url: null, converted: false, created_at: "2026-05-06" },
  { user_id: "r4", display_name: "Dennis Otieno", username: "deno_254", avatar_url: null, converted: true, created_at: "2026-05-09" },
  { user_id: "r5", display_name: "Mercy Njeri", username: "mercy_n", avatar_url: null, converted: true, created_at: "2026-05-10" },
];
export function EarningsTab({ userId, username }: { userId: string; username: string; displayName: string }) {
  const [referralCount, setReferralCount] = useState(LOCAL_PREVIEW ? 12 : 0);
  const [referralEarned, setReferralEarned] = useState(LOCAL_PREVIEW ? 120 : 0);
  const [referralUsers, setReferralUsers] = useState<ReferralUser[]>(LOCAL_PREVIEW ? DUMMY_REFERRALS : []);
  const [creatorData, setCreatorData] = useState<CreatorData | null>(LOCAL_PREVIEW ? DUMMY_CREATOR : null);
  const [recentEarnings, setRecentEarnings] = useState<EarningRow[]>(LOCAL_PREVIEW ? DUMMY_EARNINGS : []);
  const [attributedUsers, setAttributedUsers] = useState<AttributedUser[]>(LOCAL_PREVIEW ? DUMMY_USERS : []);
  const [hasRecruited, setHasRecruited] = useState(false);
  const [loading, setLoading] = useState(!LOCAL_PREVIEW);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCreatorLink, setCopiedCreatorLink] = useState(false);
  const [activeSection, setActiveSection] = useState<"referrals" | "creator">("referrals");
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [showAllReferrals, setShowAllReferrals] = useState(false);
  const isDev = userId === DEV_USER_ID;

  useEffect(() => { if (LOCAL_PREVIEW) return; loadData(); }, [userId]);

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

      const { data: creator } = await supabase.from("creators").select("user_id, status, total_users_brought, total_earned_kes, recruited_by").eq("user_id", userId).maybeSingle();
      setCreatorData(creator as CreatorData | null);

      if (creator) {
        const { count: recruitCount } = await supabase.from("creators").select("user_id", { count: "exact", head: true }).eq("recruited_by", userId);
        setHasRecruited((recruitCount ?? 0) > 0);

        const { data: earnings } = await supabase.from("creator_earnings").select("id, trigger_type, trigger_amount, earning_kes, tier, created_at").eq("creator_id", userId).order("created_at", { ascending: false }).limit(20);
        setRecentEarnings((earnings || []) as EarningRow[]);

        const { data: attributions } = await supabase.from("creator_user_attributions").select("user_id, attributed_at, profiles:profiles!creator_user_attributions_user_id_fkey(display_name, username, avatar_url)").eq("creator_id", userId).order("attributed_at", { ascending: false });
        const userIds = (attributions || []).map((a: any) => a.user_id);
        const { data: convertedTx } = userIds.length > 0 ? await supabase.from("transactions").select("user_id").in("user_id", userIds).eq("kind", "topup").limit(1000) : { data: [] };
        const convertedSet = new Set((convertedTx || []).map((t: any) => t.user_id));
        setAttributedUsers(((attributions || []) as any[]).map((a) => ({ user_id: a.user_id, display_name: a.profiles?.display_name || "User", username: a.profiles?.username || "", avatar_url: a.profiles?.avatar_url || null, attributed_at: a.attributed_at, converted: convertedSet.has(a.user_id) })));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const referralUrl = username ? `https://yuto.social/r/${username}` : "";
  const creatorRecruitUrl = username ? `https://yuto.social/c/${username}` : "";

  const handleShare = () => {
    const text = `${referralUrl}\n\nI dare you to join Yuto \u{1F60F} I earn KSH 50 when you do. But guess what - you can earn KSH 50 too by inviting YOUR friends.\n\nSplit bills, host events, sell stuff - all with M-PESA. Game on.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleCopy = async () => { try { await navigator.clipboard.writeText(referralUrl); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 1500); } catch {} };

  if (loading) return (<div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin" /></div>);

  const isCreator = creatorData?.status === "active";
  const milestones = [10, 25, 50, 100];
  const nextMilestone = milestones.find((m) => (creatorData?.total_users_brought || 0) < m);
  const usersToNext = nextMilestone ? nextMilestone - (creatorData?.total_users_brought || 0) : 0;
  return (
    <div className="space-y-6 pb-24">
      {/* Section toggle */}
      <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-full p-1">
        <button type="button" onClick={() => setActiveSection("referrals")} className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-colors border-none ${activeSection === "referrals" ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm" : "bg-transparent text-gray-500 dark:text-gray-400"}`}>Referrals</button>
        <button type="button" onClick={() => setActiveSection("creator")} className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-colors border-none ${activeSection === "creator" ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm" : "bg-transparent text-gray-500 dark:text-gray-400"}`}>{isCreator ? "Creator \uD83D\uDCB0" : "Creator"}</button>
      </div>

      {activeSection === "referrals" ? (
        <>
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
            <button type="button" onClick={handleShare} className="flex-1 py-3.5 bg-green-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"><Share2 size={16} /> Share on WhatsApp</button>
            <button type="button" onClick={handleCopy} className="py-3.5 px-5 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2">{copiedLink ? <Check size={16} /> : <Copy size={16} />}{copiedLink ? "Copied" : "Copy"}</button>
          </div>

          {/* Referral user list with +KSH 50 badges */}
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

          {/* Upgrade CTA */}
          {!isCreator && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4">
              <p className="font-bold text-sm text-black dark:text-white mb-1">Want to earn more than KSH 50?</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Creators earn from EVERY transaction their users make. Not just the first top-up.</p>
              <button type="button" onClick={() => setActiveSection("creator")} className="text-xs font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1 bg-transparent border-none p-0">Learn about Creator program <ChevronRight size={14} /></button>
            </div>
          )}
        </>      ) : (
        <>
          {isCreator ? (
            <>
              {/* Creator dashboard */}
              <div className="bg-black dark:bg-zinc-900 rounded-3xl p-6 text-white relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4"><Crown size={20} className="text-yellow-400" /><p className="font-bold text-sm uppercase tracking-wider text-yellow-400">Creator</p><span className="ml-auto text-xs font-bold bg-white/10 px-2 py-0.5 rounded-full">70% cut</span></div>
                  <p className="text-4xl font-black mb-1">KSH {(creatorData?.total_earned_kes || 0).toLocaleString()}</p>
                  <p className="text-white/80 text-sm font-semibold">{creatorData?.total_users_brought || 0} users earning you money</p>
                  <p className="text-white/50 text-xs mt-3">Every top-up and withdrawal your users make earns you commission. Forever.</p>
                </div>
              </div>

              {/* Milestone progress */}
              {nextMilestone && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2"><Trophy size={16} className="text-amber-600" /><p className="font-bold text-sm text-black dark:text-white">Next milestone: {nextMilestone} users</p></div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-2"><div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all" style={{ width: `${Math.min(100, ((creatorData?.total_users_brought || 0) / nextMilestone) * 100)}%` }} /></div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{usersToNext} more user{usersToNext === 1 ? "" : "s"} to go</p>
                </div>
              )}

              {/* Recruit creators → passive income */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center"><Users size={20} /></div>
                  <div><p className="font-bold text-sm text-black dark:text-white">Recruit creators → earn 30% passively</p><p className="text-xs text-gray-500 dark:text-gray-400">Every creator you recruit, you earn 30% of their earnings. Forever.</p></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Find people with audiences. When they become creators through your link, you earn from all their users without doing anything.</p>
                <button type="button" onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(`I'm earning money on Yuto as a Creator \uD83D\uDCB0\n\nEvery user I bring earns me commission on their transactions. Forever.\n\nYou should join too:\n${creatorRecruitUrl}`)}`, "_blank"); }} className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"><Users size={16} /> Recruit a Creator via WhatsApp</button>
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-black dark:text-white truncate">{creatorRecruitUrl}</div>
                  <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(creatorRecruitUrl); setCopiedCreatorLink(true); setTimeout(() => setCopiedCreatorLink(false), 1500); } catch {} }} className="py-2 px-3 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-xl font-bold text-xs shrink-0">{copiedCreatorLink ? "Copied!" : "Copy"}</button>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl p-3 text-center"><p className="text-xl font-black text-black dark:text-white">{creatorData?.total_users_brought || 0}</p><p className="text-[10px] text-gray-400 font-semibold">Users</p></div>
                <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl p-3 text-center"><p className="text-xl font-black text-emerald-600 dark:text-emerald-400">70%</p><p className="text-[10px] text-gray-400 font-semibold">Your cut</p></div>
                <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl p-3 text-center"><p className="text-xl font-black text-black dark:text-white">{recentEarnings.length}</p><p className="text-[10px] text-gray-400 font-semibold">Recent</p></div>
              </div>

              {/* Your link — for posting on socials */}
              <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Your link — post on socials</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-mono text-black dark:text-white truncate">{referralUrl}</div>
                  <button type="button" onClick={handleCopy} className="py-2.5 px-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm flex items-center gap-1.5 shrink-0 active:scale-[0.98] transition-transform">{copiedLink ? <Check size={14} /> : <Copy size={14} />}{copiedLink ? "Copied!" : "Copy"}</button>
                </div>
                <p className="text-xs text-gray-400 mt-2">Users who sign up through this link become your users. Post it on TikTok, IG, WhatsApp Status — anywhere.</p>
              </div>
              {/* Your Users */}
              {attributedUsers.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Your users ({attributedUsers.length})</p>
                    {attributedUsers.length > 5 && (<button type="button" onClick={() => setShowAllUsers(!showAllUsers)} className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-transparent border-none">{showAllUsers ? "Show less" : "Show all"}</button>)}
                  </div>
                  <div className="space-y-2">
                    {(showAllUsers ? attributedUsers : attributedUsers.slice(0, 5)).map((u) => (
                      <div key={u.user_id} className="flex items-center gap-3 py-2 px-3 bg-gray-50 dark:bg-zinc-900 rounded-xl">
                        <UserAvatar name={u.display_name} avatarUrl={u.avatar_url} size="sm" />
                        <div className="flex-1 min-w-0"><p className="font-bold text-sm text-black dark:text-white truncate">{u.display_name}</p><p className="text-xs text-gray-400">@{u.username}</p></div>
                        {u.converted ? (<span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">Active</span>) : (<span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">Pending</span>)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent earnings */}
              {recentEarnings.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Recent earnings</p>
                  <div className="space-y-2">
                    {recentEarnings.slice(0, 10).map((e) => (
                      <div key={e.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-zinc-900 rounded-xl">
                        <div><p className="text-sm font-bold text-black dark:text-white">{e.trigger_type === "topup" ? "Top-up" : "Withdrawal"} · Tier {e.tier}</p><p className="text-xs text-gray-400">KSH {e.trigger_amount.toLocaleString()} transaction</p></div>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">+KSH {Math.round(e.earning_kes).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* How it works */}
              <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl p-5 space-y-3">
                <p className="font-bold text-black dark:text-white text-sm">How you earn</p>
                <div className="flex items-start gap-3"><div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center shrink-0"><TrendingUp size={14} /></div><div><p className="text-sm font-semibold text-black dark:text-white">Every top-up & withdrawal</p><p className="text-xs text-gray-400">Your users' activity earns you 70% of the net margin</p></div></div>
                <div className="flex items-start gap-3"><div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center shrink-0"><Users size={14} /></div><div><p className="text-sm font-semibold text-black dark:text-white">Recruit creators → 30% passive</p><p className="text-xs text-gray-400">Every creator you recruit, you earn 30% of their earnings forever</p></div></div>
                <div className="flex items-start gap-3"><div className="w-7 h-7 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 flex items-center justify-center shrink-0"><Zap size={14} /></div><div><p className="text-sm font-semibold text-black dark:text-white">Forever</p><p className="text-xs text-gray-400">Once a user is yours, every transaction earns you money. No expiry.</p></div></div>
              </div>
            </>
          ) : (
            /* Non-creator: show the pitch */
            <div className="text-center py-6 px-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 mx-auto flex items-center justify-center mb-4"><Crown size={28} className="text-white" /></div>
              <h3 className="text-xl font-black text-black dark:text-white mb-2">Become a Yuto Creator</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[280px] mx-auto leading-relaxed">Post about Yuto on your socials. Every user you bring earns you money on every transaction they make. Forever.</p>
              <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl p-5 text-left space-y-4 mb-6">
                <div className="flex items-center gap-3"><span className="text-2xl">{"\uD83D\uDCB0"}</span><div><p className="font-bold text-sm text-black dark:text-white">70% of net revenue from your users</p><p className="text-xs text-gray-400">Every top-up and withdrawal your users make earns you money</p></div></div>
                <div className="flex items-center gap-3"><span className="text-2xl">{"\uD83D\uDD04"}</span><div><p className="font-bold text-sm text-black dark:text-white">+30% passive from recruited creators</p><p className="text-xs text-gray-400">Recruit other creators → earn 30% of their earnings forever</p></div></div>
                <div className="flex items-center gap-3"><span className="text-2xl">{"\u267E\uFE0F"}</span><div><p className="font-bold text-sm text-black dark:text-white">Lifetime earnings</p><p className="text-xs text-gray-400">No expiry. Your users are yours forever.</p></div></div>
                <div className="flex items-center gap-3"><span className="text-2xl">{"\uD83D\uDCC8"}</span><div><p className="font-bold text-sm text-black dark:text-white">Example: 50 users = KSH 5,000+/month</p><p className="text-xs text-gray-400">If each user tops up KSH 2,000/month, you earn ~KSH 5,600</p></div></div>
              </div>
              <p className="text-xs text-gray-400 mb-4">Creator status is granted to active Yuto promoters. DM us to get approved.</p>
              <button type="button" onClick={() => { window.open(`https://wa.me/16124713785?text=${encodeURIComponent(`Hey! I want to become a Yuto Creator \uD83D\uDE80\n\nI have an audience and want to promote Yuto. My username is @${username}`)}`, "_blank"); }} className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-base active:scale-[0.98] transition-transform">Apply to become a Creator</button>
            </div>
          )}
        </>
      )}

      {/* Dev: Grant creator button */}
      {isDev && !isCreator && (
        <button type="button" onClick={async () => { try { await supabase.rpc("grant_creator_status", { p_target_user_id: userId }); toast.success("Creator status granted!"); loadData(); } catch (e: any) { toast.error(e?.message || "Couldn't grant"); } }} className="w-full py-3 bg-yellow-500 text-black rounded-2xl font-bold text-sm">[DEV] Grant Creator Status</button>
      )}
    </div>
  );
}