import UserAvatar from "../UserAvatar";
import { MessageCircle, Rocket, Send, Trash2, UserCheck } from "lucide-react";
import type { Plan } from "../../pages/home/types";
import { FixedMediaCarousel } from "../media/FixedMediaCarousel";

export function PlanCard({
  plan,
  currentUserId,
  joiningPlanId,
  onJoinOrLeavePlan,
  onDeletePlan,
  onYutoIt,
  onOpenPlanChat,
  onNavigateToYutoGroup,
  onNavigateToCreator,
  onOpenPeople,
  onSharePlan,
}: {
  plan: Plan;
  currentUserId?: string;
  joiningPlanId?: string | null;
  onJoinOrLeavePlan?: (plan: Plan) => void;
  onDeletePlan?: (planId: string) => void;
  onYutoIt?: (plan: Plan) => void;
  onOpenPlanChat?: (plan: Plan) => void;
  onNavigateToYutoGroup?: (groupId: string) => void;
  onNavigateToCreator?: (creatorId: string) => void;
  onOpenPeople?: (planId: string) => void;
  onSharePlan?: (plan: Plan) => void;
}) {
  const isMine = plan.creator_id === currentUserId;
  const pm = plan.plan_members ?? [];
  const isMember = pm.some((m) => m.user_id === currentUserId);
  const joinedCount = pm.length;
  const slotsLeft = plan.slots ? plan.slots - joinedCount : null;
  const allIn = plan.slots ? joinedCount >= plan.slots : false;
  const canYutoIt = isMine && plan.amount && pm.length > 0;

  return (
    <div id={`plan-${plan.id}`} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div
        className="flex items-center gap-2 mb-3 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => onNavigateToCreator?.(plan.creator.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onNavigateToCreator?.(plan.creator.id);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <UserAvatar name={plan.creator.display_name} avatarUrl={plan.creator.avatar_url} size="sm" />
        <div className="flex-1">
          <p className="font-semibold text-sm text-black">{plan.creator.display_name}</p>
          <p className="text-xs text-gray-400">
            {new Date(plan.created_at).toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" })}
          </p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide inline-flex items-center gap-1.5 bg-orange-50 text-orange-700">
          Plan
        </span>
        {isMine && onDeletePlan && (
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

      {(() => {
        const media = (plan.media || [])
          .slice()
          .sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0))
          .map((m) => ({
            url: m.media_url,
            type: String(m.media_type || "").startsWith("video") ? ("video" as const) : ("image" as const),
          }));
        const fallback = plan.image_url ? [{ url: plan.image_url, type: "image" as const }] : [];
        const items = media.length > 0 ? media : fallback;
        if (items.length === 0) return null;
        return (
          <div className="mb-3 rounded-xl overflow-hidden bg-gray-100 w-full">
            <FixedMediaCarousel items={items} />
          </div>
        );
      })()}

      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="font-bold text-black text-lg flex-1 min-w-0">{plan.title}</p>
        {onSharePlan && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSharePlan(plan);
            }}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors tap-scale border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
            aria-label={`Send ${plan.title} in messages`}
            title="Share in messages"
          >
            <Send size={15} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-2 flex-wrap">
        {plan.amount && (
          <span className="bg-green-50 text-green-700 font-bold text-sm px-3 py-1 rounded-full">
            KSH {plan.amount.toLocaleString()}
          </span>
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
            onClick={() => onOpenPeople?.(plan.id)}
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
          {(onSharePlan || onOpenPlanChat) && (
            <div className="flex items-center gap-1.5 shrink-0">
              {onSharePlan && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSharePlan(plan);
                  }}
                  className="relative w-10 h-10 shrink-0 rounded-xl border border-gray-200 bg-white text-gray-700 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  aria-label={`Share ${plan.title}`}
                  title="Share in messages"
                >
                  <Send size={16} />
                </button>
              )}
              {onOpenPlanChat && (
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
          )}
        </div>
      )}

      <div className={`flex flex-wrap gap-1.5 ${pm.length > 0 ? "" : "items-center justify-between"}`}>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {!isMine && !allIn && onJoinOrLeavePlan && (
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
          {allIn && plan.yuto_group_id && isMember && onNavigateToYutoGroup && (
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
          {canYutoIt && onYutoIt && (
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

        {pm.length === 0 && (onSharePlan || onOpenPlanChat) && (
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {onSharePlan && (
              <button
                type="button"
                onClick={() => onSharePlan(plan)}
                className="relative w-10 h-10 shrink-0 rounded-xl border border-gray-200 bg-white text-gray-700 flex items-center justify-center hover:bg-gray-50 transition-colors"
                aria-label={`Share ${plan.title}`}
                title="Share in messages"
              >
                <Send size={16} />
              </button>
            )}
            {onOpenPlanChat && (
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
        )}
      </div>
    </div>
  );
}

