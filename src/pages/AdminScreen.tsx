import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

// Only these user IDs can access admin
const ADMIN_IDS = ["f5f5da38-c839-4ce4-94fc-10f3854674e0"];

type TabId = "users" | "tickets" | "disputes" | "fraud" | "audit";

export default function AdminScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("tickets");
  const [loading, setLoading] = useState(false);

  // Data states
  const [tickets, setTickets] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [userLookup, setUserLookup] = useState("");
  const [userResult, setUserResult] = useState<any>(null);

  // Auth gate
  if (!user || !ADMIN_IDS.includes(user.id)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <p className="text-2xl font-bold mb-2">🔒 Access Denied</p>
          <p className="text-gray-400 text-sm">Admin only.</p>
          <button onClick={() => navigate("/")} className="mt-4 px-4 py-2 bg-white text-black rounded-lg font-bold text-sm border-none">Go Home</button>
        </div>
      </div>
    );
  }

  useEffect(() => { loadTab(); }, [tab]);

  const loadTab = async () => {
    setLoading(true);
    try {
      if (tab === "tickets") {
        const { data } = await supabase.from("support_tickets").select("*, profiles:user_id(username, display_name)").order("created_at", { ascending: false }).limit(50);
        setTickets(data || []);
      } else if (tab === "disputes") {
        const { data } = await supabase.from("disputes").select("*").order("created_at", { ascending: false }).limit(50);
        setDisputes(data || []);
      } else if (tab === "fraud") {
        const { data } = await supabase.from("fraud_alerts").select("*").order("created_at", { ascending: false }).limit(50);
        setFraudAlerts(data || []);
      } else if (tab === "audit") {
        const { data } = await supabase.from("audit_events").select("*").order("created_at", { ascending: false }).limit(100);
        setAuditEvents(data || []);
      }
    } catch (e) {
      console.error("Admin load error:", e);
    }
    setLoading(false);
  };

  const lookupUser = async () => {
    if (!userLookup.trim()) return;
    setLoading(true);
    try {
      const { data } = await supabase.from("profiles").select("*, wallets(balance, locked_at)").or(`username.ilike.%${userLookup}%,display_name.ilike.%${userLookup}%,id.eq.${userLookup}`).limit(1).maybeSingle();
      setUserResult(data);
    } catch { setUserResult(null); }
    setLoading(false);
  };

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "tickets", label: "Tickets", count: tickets.filter(t => t.status === "open").length },
    { id: "disputes", label: "Disputes", count: disputes.filter(d => d.status === "open").length },
    { id: "fraud", label: "Fraud", count: fraudAlerts.filter(f => !f.acknowledged).length },
    { id: "audit", label: "Audit" },
    { id: "users", label: "Users" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black">Yuto Admin</h1>
          <button onClick={() => navigate("/")} className="text-xs text-gray-400 bg-zinc-800 px-3 py-1.5 rounded-lg border-none">← Back to app</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap border-none transition-colors ${tab === t.id ? "bg-white text-black" : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"}`}
            >
              {t.label}
              {t.count ? <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{t.count}</span> : null}
            </button>
          ))}
        </div>

        {loading && <p className="text-gray-400 text-sm">Loading...</p>}

        {/* Users Tab */}
        {tab === "users" && (
          <div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={userLookup}
                onChange={e => setUserLookup(e.target.value)}
                onKeyDown={e => e.key === "Enter" && lookupUser()}
                placeholder="Search by username, name, or user ID..."
                className="flex-1 bg-zinc-800 text-white border border-zinc-700 rounded-lg px-4 py-2.5 text-sm"
              />
              <button onClick={lookupUser} className="px-4 py-2.5 bg-white text-black rounded-lg font-bold text-sm border-none">Search</button>
            </div>
            {userResult && (
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div><p className="text-xs text-gray-500">Username</p><p className="font-bold">@{userResult.username}</p></div>
                  <div><p className="text-xs text-gray-500">Display Name</p><p className="font-bold">{userResult.display_name || "—"}</p></div>
                  <div><p className="text-xs text-gray-500">Phone</p><p className="font-bold">{userResult.phone_number || "—"}</p></div>
                  <div><p className="text-xs text-gray-500">KYC Tier</p><p className="font-bold">{userResult.kyc_tier ?? 0}</p></div>
                  <div><p className="text-xs text-gray-500">Balance</p><p className="font-bold text-green-400">KSH {userResult.wallets?.[0]?.balance ?? "—"}</p></div>
                  <div><p className="text-xs text-gray-500">Wallet Locked</p><p className="font-bold">{userResult.wallets?.[0]?.locked_at ? "🔒 YES" : "No"}</p></div>
                  <div><p className="text-xs text-gray-500">PIN Set</p><p className="font-bold">{userResult.pin_hash ? "Yes" : "No"}</p></div>
                  <div><p className="text-xs text-gray-500">ToS Accepted</p><p className="font-bold">{userResult.tos_accepted_at ? "Yes" : "No"}</p></div>
                </div>
                <p className="text-xs text-gray-500">ID: {userResult.id}</p>
                <p className="text-xs text-gray-500">Created: {new Date(userResult.created_at).toLocaleString()}</p>
              </div>
            )}
          </div>
        )}

        {/* Tickets Tab */}
        {tab === "tickets" && (
          <div className="space-y-2">
            {tickets.length === 0 && <p className="text-gray-500 text-sm">No tickets yet.</p>}
            {tickets.map(t => (
              <div key={t.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-sm">{t.subject}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.category} · {t.profiles?.username || t.user_id?.slice(0,8)}</p>
                    <p className="text-xs text-gray-500 mt-1">{t.description?.slice(0, 200)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === "open" ? "bg-yellow-500/20 text-yellow-400" : t.status === "resolved" ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
                    {t.status}
                  </span>
                </div>
                <p className="text-[10px] text-gray-600 mt-2">{new Date(t.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Disputes Tab */}
        {tab === "disputes" && (
          <div className="space-y-2">
            {disputes.length === 0 && <p className="text-gray-500 text-sm">No disputes yet.</p>}
            {disputes.map(d => (
              <div key={d.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-sm">KSH {d.amount_kes} — {d.reason?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Disputer: {d.disputer_id?.slice(0,8)} → Counterparty: {d.counterparty_id?.slice(0,8)}</p>
                    {d.note && <p className="text-xs text-gray-500 mt-1">{d.note}</p>}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.status === "open" ? "bg-yellow-500/20 text-yellow-400" : d.status === "resolved" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {d.status}
                  </span>
                </div>
                <p className="text-[10px] text-gray-600 mt-2">{new Date(d.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Fraud Alerts Tab */}
        {tab === "fraud" && (
          <div className="space-y-2">
            {fraudAlerts.length === 0 && <p className="text-gray-500 text-sm">No fraud alerts. 🎉</p>}
            {fraudAlerts.map(f => (
              <div key={f.id} className={`bg-zinc-900 rounded-xl p-4 border ${f.severity === "critical" ? "border-red-500" : f.severity === "high" ? "border-orange-500" : "border-zinc-800"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-sm">{f.alert_type?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-gray-400 mt-0.5">User: {f.user_id?.slice(0,8)} · Severity: {f.severity}</p>
                    <p className="text-xs text-gray-500 mt-1 font-mono">{JSON.stringify(f.metadata)?.slice(0, 200)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.acknowledged ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {f.acknowledged ? "Acked" : "NEW"}
                  </span>
                </div>
                <p className="text-[10px] text-gray-600 mt-2">{new Date(f.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Audit Events Tab */}
        {tab === "audit" && (
          <div className="space-y-1">
            {auditEvents.length === 0 && <p className="text-gray-500 text-sm">No audit events yet.</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-zinc-800">
                    <th className="text-left py-2 px-2">Time</th>
                    <th className="text-left py-2 px-2">User</th>
                    <th className="text-left py-2 px-2">Event</th>
                    <th className="text-left py-2 px-2">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map(e => (
                    <tr key={e.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                      <td className="py-1.5 px-2 text-gray-400 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="py-1.5 px-2 font-mono">{e.user_id?.slice(0,8)}</td>
                      <td className="py-1.5 px-2"><span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">{e.event_type}</span></td>
                      <td className="py-1.5 px-2 text-gray-500 max-w-[300px] truncate font-mono">{JSON.stringify(e.metadata)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
