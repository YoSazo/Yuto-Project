import UserAvatar from "../UserAvatar";
import { ClipboardList, Trash2, UserCheck, Rocket, MessageCircle } from "lucide-react";
import type { Plan } from "../../pages/home/types";
import { PeopleListModal } from "../PeopleListModal";
import { useMemo, useState } from "react";

export function PlansFeedSection({
  loading,
  plans,
  activeTab,
  currentUserId,
  joiningPlanId,
  onJoinOrLeavePlan,
  onDeletePlan,
  onYutoIt,
  onOpenPlanChat,
  onNavigateToYutoGroup,
  onNavigateToCreator,
}: {
  loading: boolean;
  plans: Plan[];
  activeTab: "public" | "friends";
  currentUserId?: string;
  joiningPlanId: string | null;
  onJoinOrLeavePlan: (plan: Plan) => void;
  onDeletePlan: (planId: string) => void;
  onYutoIt: (plan: Plan) => void;
  onOpenPlanChat: (plan: Plan) => void;
  onNavigateToYutoGroup: (groupId: string) => void;
  onNavigateToCreator: (creatorId: string) => void;
}) {
  const [peopleModalPlanId, setPeopleModalPlanId] = useState<string | null>(null);

  const planPeople = useMemo(() => {
    if (!peopleModalPlanId) return [];
    const plan = plans.find((p) => p.id === peopleModalPlanId);
    const pm = plan?.plan_members ?? [];
    const unique = new Map<string, (typeof pm)[number]["profiles"]>();
    pm.forEach((m) => unique.set(m.profiles.id, m.profiles));
    return Array.from(unique.values());
  }, [peopleModalPlanId, plans]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ClipboardList size={48} className="text-gray-300 mb-3" />
        <p className="font-bold text-black text-lg">{activeTab === "public" ? "No plans yet" : "No plans from friends yet"}</p>
        <p className="text-gray-400 text-sm mt-1">
          {activeTab === "public" ? "Be the first to post one!" : "Add friends to see their plans here"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {plans.map((plan) => {
        const isMine = plan.creator_id === currentUserId;
        const pm = plan.plan_members ?? [];
        const isMember = pm.some((m) => m.user_id === currentUserId);
        const joinedCount = pm.length;
        const slotsLeft = plan.slots ? plan.slots - joinedCount : null;
        const allIn = plan.slots ? joinedCount >= plan.slots : false;
        const canYutoIt = isMine && plan.amount && pm.length > 0;

        return (
          <div key={plan.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div
              className="flex items-center gap-2 mb-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onNavigateToCreator(plan.creator.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onNavigateToCreator(plan.creator.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <UserAvatar name={plan.creator.display_name} avatarUrl={plan.creator.avatar_url} size="sm" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-black">{plan.creator.display_name}</p>
                <p className="text-xs text-gray-400">{new Date(plan.created_at).toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" })}</p>
              </div>
              {isMine && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePlan(plan.id);
                  }}
                  className="text-gray-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {plan.image_url && (
              <div className="mb-3 rounded-xl overflow-hidden bg-gray-100 w-full">
                <img src={plan.image_url} alt="" className="block w-full h-auto" />
              </div>
            )}

            <p className="font-bold text-black text-lg mb-2">{plan.title}</p>

            <div className="flex items-center gap-3 mb-2 flex-wrap">
              {plan.amount && (
                <span className="bg-green-50 text-green-700 font-bold text-sm px-3 py-1 rounded-full">KSH {plan.amount.toLocaleString()}</span>
              )}
              {plan.slots && (
                <span className={`font-bold text-sm px-3 py-1 rounded-full ${allIn ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-600"}`}>
                  {allIn ? "Full 🔒" : `${slotsLeft} spot${slotsLeft === 1 ? "" : "s"} left`}
                </span>
              )}
            </div>

            {pm.length > 0 && (
              <div className="flex items-center justify-between gap-3 mb-1">
                <button
                  type="button"
                  onClick={() => setPeopleModalPlanId(plan.id)}
                  className="flex items-center gap-1 min-w-0 flex-1 bg-transparent border-none p-0 text-left"
                  aria-label="See who is in"
                  title="See who's in"
                >
                  {pm.slice(0, 5).map((m) => (
                    <UserAvatar
                      key={m.id}
                      name={m.profiles.display_name}
                      avatarUrl={m.profiles.avatar_url}
                      size="sm"
                      className="-ml-1 first:ml-0 border-2 border-white"
                    />
                  ))}
                  {pm.length > 5 && <span className="text-xs text-gray-400 ml-1 shrink-0">+{pm.length - 5}</span>}
                  <span className="text-xs text-gray-400 ml-1 truncate">
                    {joinedCount} {joinedCount === 1 ? "person" : "people"} in
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPlanChat(plan)}
                  className="relative w-10 h-10 shrink-0 rounded-xl border border-gray-200 bg-white text-gray-700 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  aria-label={`Chat about ${plan.title}`}
                  title="Open chat"
                >
                  <MessageCircle size={16} />
                </button>
              </div>
            )}

            <div className={`flex flex-wrap gap-1.5 ${pm.length > 0 ? "" : "items-center justify-between"}`}>
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {!isMine && !allIn && (
                  <button
                    type="button"
                    onClick={() => void onJoinOrLeavePlan(plan)}
                    disabled={joiningPlanId === plan.id}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 ${isMember ? "bg-gray-100 text-gray-600" : "bg-black text-white"}`}
                  >
                    {joiningPlanId === plan.id ? (
                      "…"
                    ) : isMember ? (
                      "Leave"
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <UserCheck size={15} /> I&apos;m in
                      </span>
                    )}
                  </button>
                )}
                {allIn && plan.yuto_group_id && isMember && (
                  <button
                    type="button"
                    onClick={() => onNavigateToYutoGroup(plan.yuto_group_id!)}
                    className="flex-1 py-2.5 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors"
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <Rocket size={15} /> Join Yuto
                    </span>
                  </button>
                )}
                {canYutoIt && (
                  <button
                    type="button"
                    onClick={() => onYutoIt(plan)}
                    className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-colors"
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <Rocket size={15} /> Yuto it!
                    </span>
                  </button>
                )}
              </div>

              {pm.length === 0 && (
                <button
                  type="button"
                  onClick={() => onOpenPlanChat(plan)}
                  className="relative w-10 h-10 shrink-0 rounded-xl border border-gray-200 bg-white text-gray-700 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  aria-label={`Chat about ${plan.title}`}
                  title="Open chat"
                >
                  <MessageCircle size={16} />
                </button>
              )}
            </div>
          </div>
        );
      })}

      <PeopleListModal
        open={!!peopleModalPlanId}
        title={(() => {
          const plan = plans.find((p) => p.id === peopleModalPlanId);
          const count = plan?.plan_members?.length ?? 0;
          return `${count} in`;
        })()}
        people={planPeople}
        onClose={() => setPeopleModalPlanId(null)}
        onNavigateToUser={(userId) => onNavigateToCreator(userId)}
      />
    </div>
  );
}
