import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const ADMIN_IDS = ["f5f5da38-c839-4ce4-94fc-10f3854674e0"];

type TabId = "overview" | "users" | "tickets" | "disputes" | "fraud" | "audit";

export default function AdminScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(false);

  // Overview stats
  const [stats, setStats] = useState({ totalUsers: 0, totalVolume: 0, openTickets: 0, openDisputes: 0, unackedFraud: 0, todayTransfers: 0 });

  // Data
  const [tickets, setTickets] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [userLookup, setUserLookup] = useState("");
  const [userResult, setUserResult] = useState<any>(null);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [userAudit, setUserAudit] = useState<any[]>([]);

  const isAdmin = !!user && ADMIN_IDS.includes(user.id);

  useEffect(() => {
    if (isAdmin) {
      loadOverview();
      loadTab();
    }
  }, [tab, isAdmin]);

  const loadOverview = async () => {
    try {
      const [usersRes, ticketsRes, disputesRes, fraudRes, txRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("fraud_alerts").select("id", { count: "exact", head: true }).eq("acknowledged", false),
        supabase.from("transactions").select("amount").gte("created_at", new Date(Date.now() - 86400000).toISOString()),
      ]);
      const todayVol = (txRes.data || []).reduce((s: number, t: any) => s + Math.abs(Number(t.amount) || 0), 0);
      setStats({
        totalUsers: usersRes.count || 0,
        totalVolume: todayVol,
        openTickets: ticketsRes.count || 0,
        openDisputes: disputesRes.count || 0,
        unackedFraud: fraudRes.count || 0,
        todayTransfers: (txRes.data || []).length,
      });
    } catch {}
  };

  const loadTab = async () => {
    setLoading(true);
    try {
      if (tab === "tickets") {
        const { data } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(100);
        setTickets(data || []);
      } else if (tab === "disputes") {
        const { data } = await supabase.from("disputes").select("*").order("created_at", { ascending: false }).limit(100);
        setDisputes(data || []);
      } else if (tab === "fraud") {
        const { data } = await supabase.from("fraud_alerts").select("*").order("created_at", { ascending: false }).limit(100);
        setFraudAlerts(data || []);
      } else if (tab === "audit") {
        const { data } = await supabase.from("audit_events").select("*").order("created_at", { ascending: false }).limit(200);
        setAuditEvents(data || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const lookupUser = async () => {
    if (!userLookup.trim()) return;
    setLoading(true);
    setUserResult(null);
    setUserTransactions([]);
    setUserAudit([]);
    try {
      const { data } = await supabase.from("profiles").select("*").or(`username.ilike.%${userLookup}%,display_name.ilike.%${userLookup}%,id.eq.${userLookup.length === 36 ? userLookup : "00000000-0000-0000-0000-000000000000"},phone_number.ilike.%${userLookup}%`).limit(1).maybeSingle();
      if (data) {
        setUserResult(data);
        const [walletRes, txRes, auditRes] = await Promise.all([
          supabase.from("wallets").select("*").eq("user_id", data.id).maybeSingle(),
          supabase.from("transactions").select("*").eq("user_id", data.id).order("created_at", { ascending: false }).limit(30),
          supabase.from("audit_events").select("*").eq("user_id", data.id).order("created_at", { ascending: false }).limit(30),
        ]);
        setUserResult({ ...data, wallet: walletRes.data });
        setUserTransactions(txRes.data || []);
        setUserAudit(auditRes.data || []);
      } else {
        toast.error("User not found");
      }
    } catch { toast.error("Search failed"); }
    setLoading(false);
  };

  // Actions
  const freezeUser = async (userId: string) => {
    await supabase.from("wallets").update({ locked_at: new Date().toISOString() }).eq("user_id", userId);
    toast.success("Wallet frozen");
    if (userResult?.id === userId) setUserResult({ ...userResult, wallet: { ...userResult.wallet, locked_at: new Date().toISOString() } });
  };

  const unfreezeUser = async (userId: string) => {
    await supabase.from("wallets").update({ locked_at: null }).eq("user_id", userId);
    toast.success("Wallet unfrozen");
    if (userResult?.id === userId) setUserResult({ ...userResult, wallet: { ...userResult.wallet, locked_at: null } });
  };

  const resolveTicket = async (ticketId: string, status: "resolved" | "closed") => {
    await supabase.from("support_tickets").update({ status, resolved_at: new Date().toISOString() }).eq("id", ticketId);
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t));
    toast.success(`Ticket ${status}`);
  };

  const ackFraudAlert = async (alertId: string) => {
    await supabase.from("fraud_alerts").update({ acknowledged: true, acknowledged_at: new Date().toISOString(), acknowledged_by: "admin" }).eq("id", alertId);
    setFraudAlerts(prev => prev.map(f => f.id === alertId ? { ...f, acknowledged: true } : f));
    toast.success("Alert acknowledged");
  };

  // Auth gate (after all hooks)
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <p className="text-2xl font-bold mb-2">🔒</p>
          <p className="text-gray-400 text-sm">Admin only.</p>
          <button onClick={() => navigate("/")} className="mt-4 px-4 py-2 bg-white text-black rounded-lg font-bold text-sm border-none">Go Home</button>
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "tickets", label: "Tickets", badge: stats.openTickets },
    { id: "disputes", label: "Disputes", badge: stats.openDisputes },
    { id: "fraud", label: "Fraud", badge: stats.unackedFraud },
    { id: "audit", label: "Audit Log" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black">Yuto Admin</h1>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">LIVE</span>
        </div>
        <button onClick={() => navigate("/")} className="text-xs text-gray-400 hover:text-white transition-colors bg-transparent border border-zinc-700 px-3 py-1.5 rounded-lg">← App</button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-48 border-r border-zinc-800 min-h-[calc(100vh-65px)] p-3 space-y-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors border-none flex items-center justify-between ${tab === t.id ? "bg-white text-black" : "bg-transparent text-gray-400 hover:text-white hover:bg-zinc-800"}`}>
              {t.label}
              {t.badge ? <span className="bg-red-500 text-white text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-bold">{t.badge}</span> : null}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-6 overflow-y-auto max-h-[calc(100vh-65px)]">
          {loading && <div className="flex items-center gap-2 text-gray-400 text-sm mb-4"><div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> Loading...</div>}

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div>
              <h2 className="text-lg font-bold mb-4">Platform Overview</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {[
                  { label: "Total Users", value: stats.totalUsers.toLocaleString(), color: "text-white" },
                  { label: "Today's Transfers", value: stats.todayTransfers.toLocaleString(), color: "text-blue-400" },
                  { label: "Today's Volume", value: `KSH ${Math.round(stats.totalVolume).toLocaleString()}`, color: "text-emerald-400" },
                  { label: "Open Tickets", value: stats.openTickets, color: stats.openTickets > 0 ? "text-yellow-400" : "text-gray-400" },
                  { label: "Open Disputes", value: stats.openDisputes, color: stats.openDisputes > 0 ? "text-orange-400" : "text-gray-400" },
                  { label: "Fraud Alerts", value: stats.unackedFraud, color: stats.unackedFraud > 0 ? "text-red-400" : "text-gray-400" },
                ].map((s, i) => (
                  <div key={i} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">{s.label}</p>
                    <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">Quick actions: Use the sidebar to manage tickets, disputes, and fraud alerts.</p>
            </div>
          )}

          {/* USERS */}
          {tab === "users" && (
            <div>
              <h2 className="text-lg font-bold mb-4">User Lookup</h2>
              <div className="flex gap-2 mb-6">
                <input type="text" value={userLookup} onChange={e => setUserLookup(e.target.value)} onKeyDown={e => e.key === "Enter" && lookupUser()} placeholder="Username, phone, name, or user ID..." className="flex-1 bg-zinc-900 text-white border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:border-white focus:outline-none transition-colors" />
                <button onClick={lookupUser} className="px-5 py-3 bg-white text-black rounded-xl font-bold text-sm border-none hover:bg-gray-200 transition-colors">Search</button>
              </div>

              {userResult && (
                <div className="space-y-4">
                  {/* User card */}
                  <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-lg font-bold">{userResult.display_name || userResult.username}</p>
                        <p className="text-sm text-gray-400">@{userResult.username} · {userResult.phone_number || "No phone"}</p>
                        <p className="text-xs text-gray-600 mt-1 font-mono">{userResult.id}</p>
                      </div>
                      <div className="flex gap-2">
                        {userResult.wallet?.locked_at ? (
                          <button onClick={() => unfreezeUser(userResult.id)} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold border-none hover:bg-emerald-500/30">Unfreeze</button>
                        ) : (
                          <button onClick={() => freezeUser(userResult.id)} className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold border-none hover:bg-red-500/30">Freeze Wallet</button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-zinc-800 rounded-lg p-3"><p className="text-[10px] text-gray-500 uppercase">Balance</p><p className="text-lg font-bold text-emerald-400">KSH {Number(userResult.wallet?.balance ?? 0).toLocaleString()}</p></div>
                      <div className="bg-zinc-800 rounded-lg p-3"><p className="text-[10px] text-gray-500 uppercase">KYC Tier</p><p className="text-lg font-bold">{userResult.national_id_verified_at ? "2" : userResult.phone_verified_at ? "1" : "0"}</p></div>
                      <div className="bg-zinc-800 rounded-lg p-3"><p className="text-[10px] text-gray-500 uppercase">Wallet</p><p className="text-lg font-bold">{userResult.wallet?.locked_at ? "🔒 Locked" : "✅ Active"}</p></div>
                      <div className="bg-zinc-800 rounded-lg p-3"><p className="text-[10px] text-gray-500 uppercase">PIN</p><p className="text-lg font-bold">{userResult.pin_hash ? "Set" : "Not set"}</p></div>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-3">Joined: {new Date(userResult.created_at).toLocaleDateString()} · ToS: {userResult.tos_accepted_at ? "Accepted" : "Not accepted"}</p>
                  </div>

                  {/* User transactions */}
                  <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                    <h3 className="text-sm font-bold mb-3">Recent Transactions ({userTransactions.length})</h3>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {userTransactions.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                          <div>
                            <p className="text-xs font-medium">{tx.kind?.replace(/_/g, " ")}</p>
                            <p className="text-[10px] text-gray-500">{new Date(tx.created_at).toLocaleString()}</p>
                          </div>
                          <p className={`text-sm font-bold ${Number(tx.amount) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {Number(tx.amount) > 0 ? "+" : ""}KSH {Math.abs(Number(tx.amount)).toLocaleString()}
                          </p>
                        </div>
                      ))}
                      {userTransactions.length === 0 && <p className="text-xs text-gray-500">No transactions</p>}
                    </div>
                  </div>

                  {/* User audit trail */}
                  <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                    <h3 className="text-sm font-bold mb-3">Audit Trail ({userAudit.length})</h3>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {userAudit.map(e => (
                        <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-zinc-800 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded font-mono">{e.event_type}</span>
                            <span className="text-[10px] text-gray-500">{JSON.stringify(e.metadata)?.slice(0, 60)}</span>
                          </div>
                          <span className="text-[10px] text-gray-600 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</span>
                        </div>
                      ))}
                      {userAudit.length === 0 && <p className="text-xs text-gray-500">No audit events</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TICKETS */}
          {tab === "tickets" && (
            <div>
              <h2 className="text-lg font-bold mb-4">Support Tickets</h2>
              <div className="space-y-2">
                {tickets.length === 0 && <p className="text-gray-500 text-sm">No tickets.</p>}
                {tickets.map(t => (
                  <div key={t.id} className={`bg-zinc-900 rounded-xl p-4 border ${t.status === "open" ? "border-yellow-500/30" : "border-zinc-800"}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === "open" ? "bg-yellow-500/20 text-yellow-400" : t.status === "resolved" ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700 text-gray-400"}`}>{t.status}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.priority === "high" || t.priority === "urgent" ? "bg-red-500/20 text-red-400" : "bg-zinc-700 text-gray-400"}`}>{t.priority}</span>
                          <span className="text-[10px] text-gray-500">{t.category?.replace(/_/g, " ")}</span>
                        </div>
                        <p className="font-semibold text-sm">{t.subject}</p>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{t.description}</p>
                        <p className="text-[10px] text-gray-600 mt-2">User: {t.user_id?.slice(0, 8)} · {new Date(t.created_at).toLocaleString()}</p>
                      </div>
                      {t.status === "open" && (
                        <div className="flex gap-1 ml-3">
                          <button onClick={() => resolveTicket(t.id, "resolved")} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold border-none hover:bg-emerald-500/30">Resolve</button>
                          <button onClick={() => resolveTicket(t.id, "closed")} className="px-3 py-1.5 bg-zinc-700 text-gray-300 rounded-lg text-[10px] font-bold border-none hover:bg-zinc-600">Close</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DISPUTES */}
          {tab === "disputes" && (
            <div>
              <h2 className="text-lg font-bold mb-4">Disputes</h2>
              <div className="space-y-2">
                {disputes.length === 0 && <p className="text-gray-500 text-sm">No disputes.</p>}
                {disputes.map(d => (
                  <div key={d.id} className={`bg-zinc-900 rounded-xl p-4 border ${d.status === "open" ? "border-orange-500/30" : "border-zinc-800"}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.status === "open" ? "bg-orange-500/20 text-orange-400" : d.status === "resolved" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{d.status}</span>
                          <span className="text-sm font-bold">KSH {Number(d.amount_kes).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-gray-300">{d.reason?.replace(/_/g, " ")}</p>
                        {d.note && <p className="text-xs text-gray-500 mt-1 italic">"{d.note}"</p>}
                        <p className="text-[10px] text-gray-600 mt-2">Disputer: {d.disputer_id?.slice(0, 8)} → Counterparty: {d.counterparty_id?.slice(0, 8)} · {new Date(d.created_at).toLocaleString()}</p>
                      </div>
                      {d.status === "open" && (
                        <button onClick={() => { setUserLookup(d.disputer_id); setTab("users"); lookupUser(); }} className="px-3 py-1.5 bg-zinc-700 text-gray-300 rounded-lg text-[10px] font-bold border-none hover:bg-zinc-600">View User</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FRAUD */}
          {tab === "fraud" && (
            <div>
              <h2 className="text-lg font-bold mb-4">Fraud Alerts</h2>
              <div className="space-y-2">
                {fraudAlerts.length === 0 && <p className="text-gray-500 text-sm">No fraud alerts. All clear. 🎉</p>}
                {fraudAlerts.map(f => (
                  <div key={f.id} className={`bg-zinc-900 rounded-xl p-4 border ${!f.acknowledged ? (f.severity === "critical" ? "border-red-500" : f.severity === "high" ? "border-orange-500/50" : "border-yellow-500/30") : "border-zinc-800"}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.severity === "critical" ? "bg-red-500/20 text-red-400" : f.severity === "high" ? "bg-orange-500/20 text-orange-400" : "bg-yellow-500/20 text-yellow-400"}`}>{f.severity}</span>
                          <span className="text-xs font-semibold">{f.alert_type?.replace(/_/g, " ")}</span>
                          {f.acknowledged && <span className="text-[10px] text-emerald-400">✓ Acked</span>}
                        </div>
                        <p className="text-[11px] text-gray-400 font-mono mt-1">{JSON.stringify(f.metadata)?.slice(0, 150)}</p>
                        <p className="text-[10px] text-gray-600 mt-2">User: {f.user_id?.slice(0, 8)} · {new Date(f.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-1 ml-3">
                        {!f.acknowledged && (
                          <button onClick={() => ackFraudAlert(f.id)} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold border-none hover:bg-emerald-500/30">Acknowledge</button>
                        )}
                        <button onClick={() => { setUserLookup(f.user_id); setTab("users"); setTimeout(lookupUser, 100); }} className="px-3 py-1.5 bg-zinc-700 text-gray-300 rounded-lg text-[10px] font-bold border-none hover:bg-zinc-600">View User</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AUDIT */}
          {tab === "audit" && (
            <div>
              <h2 className="text-lg font-bold mb-4">Audit Log (Last 200 Events)</h2>
              <div className="overflow-x-auto bg-zinc-900 rounded-xl border border-zinc-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-gray-500">
                      <th className="text-left py-3 px-3 font-semibold">Time</th>
                      <th className="text-left py-3 px-3 font-semibold">User</th>
                      <th className="text-left py-3 px-3 font-semibold">Event</th>
                      <th className="text-left py-3 px-3 font-semibold">Details</th>
                      <th className="text-left py-3 px-3 font-semibold">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEvents.map(e => (
                      <tr key={e.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                        <td className="py-2 px-3 text-gray-400 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                        <td className="py-2 px-3 font-mono text-gray-300 cursor-pointer hover:text-white" onClick={() => { setUserLookup(e.user_id); setTab("users"); setTimeout(lookupUser, 100); }}>{e.user_id?.slice(0, 8)}</td>
                        <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${e.event_type?.includes("failed") || e.event_type?.includes("locked") ? "bg-red-500/20 text-red-400" : "bg-zinc-800 text-gray-300"}`}>{e.event_type}</span></td>
                        <td className="py-2 px-3 text-gray-500 max-w-[250px] truncate font-mono text-[10px]">{JSON.stringify(e.metadata)}</td>
                        <td className="py-2 px-3 text-gray-600 text-[10px]">{e.ip_address || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {auditEvents.length === 0 && <p className="text-gray-500 text-sm p-4">No audit events yet.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
