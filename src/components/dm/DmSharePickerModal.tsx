import { useEffect, useMemo, useState } from "react";
import type { Plan, FunctionListing } from "../../pages/home/types";
import { ComposeModeTabsBar, type ComposeMode } from "../home/ComposeModeTabsBar";
import UserAvatar from "../UserAvatar";

export function DmSharePickerModal({
  open,
  onClose,
  onPickPlan,
  onPickFunction,
  embedded = false,
}: {
  open: boolean;
  onClose: () => void;
  onPickPlan: (plan: Plan) => void;
  onPickFunction: (fn: FunctionListing, kind: "function" | "sell" | "service") => void;
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<ComposeMode>("plan");
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [functions, setFunctions] = useState<FunctionListing[]>([]);

  useEffect(() => {
    if (!open) return;
    setTab("plan");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { supabase } = await import("../../lib/supabase");
        const [pRes, fRes] = await Promise.all([
          supabase.from("plans").select("*, creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url), plan_members(id, user_id, profiles(id, username, display_name, avatar_url))").order("created_at", { ascending: false }).limit(25),
          supabase.from("functions").select("*, host:profiles!functions_host_id_fkey(id, username, display_name, avatar_url), function_members(id, user_id, has_paid, joined_at, paid_at, buyer_confirmed_at, profiles(id, username, display_name, avatar_url))").eq("is_public", true).order("created_at", { ascending: false }).limit(25),
        ]);
        if (pRes.error) throw pRes.error;
        if (fRes.error) throw fRes.error;
        if (cancelled) return;
        setPlans((pRes.data || []) as Plan[]);
        setFunctions((fRes.data || []) as FunctionListing[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const shownPlans = useMemo(() => plans, [plans]);
  const shownFunctions = useMemo(() => {
    if (tab === "function") return functions.filter((f) => f.location !== "__SELL__" && f.location !== "__SERVICE__");
    if (tab === "sell") return functions.filter((f) => f.location === "__SELL__");
    if (tab === "service") return functions.filter((f) => f.location === "__SERVICE__");
    return functions;
  }, [functions, tab]);

  if (!open) return null;

  const body = (
    <>
      <ComposeModeTabsBar composeMode={tab} onComposeModeChange={setTab} className="mb-4" />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === "plan" ? (
        <div className={`overflow-y-auto -mx-1 px-1 ${embedded ? "max-h-[48vh]" : "max-h-[55vh]"}`}>
          {shownPlans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPickPlan(p)}
              className="w-full flex items-center gap-3 py-3 px-2 rounded-2xl hover:bg-gray-50 transition-colors text-left bg-transparent border-none"
            >
              <UserAvatar name={p.creator.display_name} avatarUrl={p.creator.avatar_url} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-black truncate">{p.title}</p>
                <p className="text-sm text-gray-400 truncate">{p.creator.display_name}</p>
              </div>
            </button>
          ))}
          {shownPlans.length === 0 && <div className="py-10 text-center text-gray-400 font-semibold">No plans found</div>}
        </div>
      ) : (
        <div className={`overflow-y-auto -mx-1 px-1 ${embedded ? "max-h-[48vh]" : "max-h-[55vh]"}`}>
          {shownFunctions.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onPickFunction(f, tab === "function" ? "function" : tab)}
              className="w-full flex items-center gap-3 py-3 px-2 rounded-2xl hover:bg-gray-50 transition-colors text-left bg-transparent border-none"
            >
              <UserAvatar name={f.host.display_name} avatarUrl={f.host.avatar_url} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-black truncate">{f.title}</p>
                <p className="text-sm text-gray-400 truncate">{f.host.display_name}</p>
              </div>
            </button>
          ))}
          {shownFunctions.length === 0 && <div className="py-10 text-center text-gray-400 font-semibold">Nothing found</div>}
        </div>
      )}
    </>
  );

  if (embedded) return <>{body}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center fade-in bg-black/60 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 z-0 cursor-default border-none bg-transparent" aria-label="Dismiss" onClick={onClose} />

      <div className="relative z-10 bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-5 modal-slide-up">
        <div className="flex items-center justify-between mb-4">
          <p className="font-extrabold text-black text-lg">Send…</p>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none">
            ✕
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}

