import UserAvatar from "../UserAvatar";
import { MessageCircle, Rocket, Send, Share2, Trash2, UserCheck, Camera } from "lucide-react";
import type { Plan } from "../../pages/home/types";
import { FixedMediaCarousel } from "../media/FixedMediaCarousel";

const WhatsAppIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 175.216 175.552" width={size} height={size} fill="currentColor">
    <path d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 0 0 9.349 32.535l1.455 2.313-6.179 22.558 23.146-6.069 2.235 1.324c9.387 5.571 20.15 8.517 31.126 8.523h.023c33.707 0 61.14-27.426 61.153-61.135a60.75 60.75 0 0 0-17.895-43.251 60.75 60.75 0 0 0-43.235-17.928z"/>
    <path fill="#fff" fillRule="evenodd" d="M68.772 55.603c-1.378-3.061-2.828-3.123-4.137-3.176l-3.524-.043c-1.226 0-3.218.46-4.902 2.3s-6.435 6.287-6.435 15.332 6.588 17.785 7.506 19.013 12.718 20.381 31.405 27.75c15.529 6.124 18.689 4.906 22.061 4.6s10.877-4.447 12.408-8.74 1.532-7.971 1.073-8.74-1.685-1.226-3.525-2.146-10.877-5.367-12.562-5.981-2.91-.919-4.137.921-4.746 5.979-5.819 7.206-2.144 1.381-3.984.462-7.76-2.861-14.784-9.124c-5.465-4.873-9.154-10.891-10.228-12.73s-.114-2.835.808-3.751c.825-.824 1.838-2.147 2.759-3.22s1.224-1.84 1.836-3.065.307-2.301-.153-3.22-4.032-10.011-5.666-13.647"/>
  </svg>
);

function sharePlanToWhatsApp(plan: Plan) {
  const origin = window.location.hostname === "localhost" || window.location.hostname.startsWith("127.") ? window.location.origin : "https://yuto.social";
  const url = `${origin}/p/${plan.id}`;
  const text = `${plan.creator.display_name} is planning "${plan.title}" 🎉\n\n${plan.amount ? `KSH ${plan.amount.toLocaleString()} · ` : ""}${(plan.plan_members || []).length} people in\n\nJoin the crew:\n${url}`;
  
  if (navigator.share) {
    navigator.share({ text, url }).catch(() => {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    });
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }
}

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
  onOpenMemories,
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
  onOpenMemories?: (planId: string) => void;
}) {
  const isMine = plan.creator_id === currentUserId;
  const pm = plan.plan_members ?? [];
  const isMember = pm.some((m) => m.user_id === currentUserId);
  const joinedCount = pm.length;
  // Slots includes the creator — so available spots = slots - 1 (creator) - joinedCount
  const slotsLeft = plan.slots ? Math.max(0, plan.slots - 1 - joinedCount) : null;
  const allIn = plan.slots ? (joinedCount + 1) >= plan.slots : false; // +1 for creator
  const canYutoIt = isMine && plan.amount && pm.length > 0 && plan.status !== "completed" && !plan.yuto_group_id;

  return (
    <div id={`plan-${plan.id}`} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
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
          <p className="font-semibold text-sm text-black dark:text-white">{plan.creator.display_name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
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

      <p className="font-bold text-black dark:text-white text-lg mb-2">{plan.title}</p>

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
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); sharePlanToWhatsApp(plan); }}
                className="h-10 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 flex items-center justify-center gap-1.5 px-3 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                aria-label="Send on WhatsApp"
                title="Send on WhatsApp"
              >
                <span className="text-xs font-bold">Send</span>
                <WhatsAppIcon size={16} />
              </button>
              <div className="flex items-center gap-1.5">
                {onSharePlan && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSharePlan(plan); }}
                    className="relative w-10 h-10 shrink-0 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
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
                    className="relative w-10 h-10 shrink-0 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                    aria-label={`Chat about ${plan.title}`}
                    title="Open chat"
                  >
                    <MessageCircle size={16} />
                  </button>
                )}
                {plan.yuto_group_id && onOpenMemories && (
                  <button
                    type="button"
                    onClick={() => onOpenMemories(plan.id)}
                    className="relative w-10 h-10 shrink-0 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                    aria-label="Memories"
                    title="Photos & memories"
                  >
                    <Camera size={16} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className={`flex flex-wrap gap-1.5 ${pm.length > 0 ? "" : "items-center justify-between"}`}>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {!isMine && !allIn && onJoinOrLeavePlan && !plan.yuto_group_id && (
            <button
              type="button"
              onClick={() => void onJoinOrLeavePlan(plan)}
              disabled={joiningPlanId === plan.id}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 ${isMember ? "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400" : "bg-black dark:bg-white text-white dark:text-black"}`}
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
          {plan.yuto_group_id && isMember && !isMine && onNavigateToYutoGroup && (
            <>
              <button
                type="button"
                onClick={() => onNavigateToYutoGroup(plan.yuto_group_id!)}
                className="flex-[2] py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Rocket size={15} /> Pay up 💸
                </span>
              </button>
              {onJoinOrLeavePlan && (
                <button
                  type="button"
                  onClick={() => void onJoinOrLeavePlan(plan)}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 rounded-xl font-bold text-xs transition-colors"
                >
                  Leave
                </button>
              )}
            </>
          )}
          {plan.yuto_group_id && isMember && isMine && onNavigateToYutoGroup && (
            <button
              type="button"
              onClick={() => onNavigateToYutoGroup(plan.yuto_group_id!)}
              className="flex-1 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
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
          <div className="flex flex-col gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => sharePlanToWhatsApp(plan)}
              className="h-10 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 flex items-center justify-center gap-1.5 px-3 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              aria-label="Send on WhatsApp"
              title="Send on WhatsApp"
            >
              <span className="text-xs font-bold">Send</span>
              <WhatsAppIcon size={16} />
            </button>
            <div className="flex items-center gap-1.5">
              {onSharePlan && (
                <button
                  type="button"
                  onClick={() => onSharePlan(plan)}
                  className="relative w-10 h-10 shrink-0 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
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
                  className="relative w-10 h-10 shrink-0 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                  aria-label={`Chat about ${plan.title}`}
                  title="Open chat"
                >
                  <MessageCircle size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

