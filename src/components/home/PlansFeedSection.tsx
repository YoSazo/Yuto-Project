import { ClipboardList, Users } from "lucide-react";
import type { Plan } from "../../pages/home/types";
import { PeopleListModal } from "../PeopleListModal";
import { useMemo, useState } from "react";
import { PlanCard } from "../cards/PlanCard";
import { PlanCardSkeleton } from "../skeletons/PlanCardSkeleton";

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
  onInviteFriends,
  onSharePlan,
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
  onInviteFriends?: () => void;
  onSharePlan?: (plan: Plan) => void;
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
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <PlanCardSkeleton key={i} />
        ))}
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
        {activeTab === "friends" && (
          <button
            type="button"
            onClick={() => onInviteFriends?.()}
            className="mt-5 h-12 px-6 rounded-2xl bg-black hover:bg-gray-800 text-white font-extrabold transition-colors flex items-center gap-2 tap-scale"
          >
            <Users size={16} /> Invite friends
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {plans.map((plan) => {
        return (
          <PlanCard
            key={plan.id}
            plan={plan}
            currentUserId={currentUserId}
            joiningPlanId={joiningPlanId}
            onJoinOrLeavePlan={onJoinOrLeavePlan}
            onDeletePlan={onDeletePlan}
            onYutoIt={onYutoIt}
            onOpenPlanChat={onOpenPlanChat}
            onNavigateToYutoGroup={onNavigateToYutoGroup}
            onNavigateToCreator={onNavigateToCreator}
            onOpenPeople={(planId) => setPeopleModalPlanId(planId)}
            onSharePlan={onSharePlan}
          />
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
