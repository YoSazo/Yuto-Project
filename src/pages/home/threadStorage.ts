/**
 * Per-device "last seen" tracker for plan & function chats.
 *
 * NOTE: This is a localStorage-based stop-gap — we plan to migrate to
 * proper plan_message_reads / function_message_reads tables (mirroring the
 * dm_reads / group_chat_reads pattern) so unread state is consistent
 * across devices. For launch, single-device tracking is acceptable.
 */

const FN_PREFIX = "yuto_function_thread_seen:";
const PLAN_PREFIX = "yuto_plan_thread_seen:";

export function getFunctionThreadSeenAt(userId: string, functionId: string) {
  if (typeof window === "undefined") return 0;
  const value = window.localStorage.getItem(`${FN_PREFIX}${userId}:${functionId}`);
  return value ? Number(value) || 0 : 0;
}

export function setFunctionThreadSeenAt(userId: string, functionId: string, timestamp: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${FN_PREFIX}${userId}:${functionId}`, String(new Date(timestamp).getTime()));
}

export function getUnreadFunctionMessageCount(
  userId: string,
  functionId: string,
  messages: Array<{ user_id: string; created_at: string }>,
) {
  const seenAt = getFunctionThreadSeenAt(userId, functionId);
  return messages.reduce((count, message) => {
    if (message.user_id === userId) return count;
    const messageAt = new Date(message.created_at).getTime();
    return messageAt > seenAt ? count + 1 : count;
  }, 0);
}

export function getPlanThreadSeenAt(userId: string, planId: string) {
  if (typeof window === "undefined") return 0;
  const value = window.localStorage.getItem(`${PLAN_PREFIX}${userId}:${planId}`);
  return value ? Number(value) || 0 : 0;
}

export function setPlanThreadSeenAt(userId: string, planId: string, timestamp: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${PLAN_PREFIX}${userId}:${planId}`, String(new Date(timestamp).getTime()));
}

/**
 * Compute unread counts for many plan/function threads in one pass given
 * a map of "latest message timestamp + last sender" per thread id.
 */
export function computeLocalUnread(
  userId: string,
  prefix: "plan" | "function",
  latestByThread: Record<string, { lastAt: string; lastSenderId: string | null }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [threadId, info] of Object.entries(latestByThread)) {
    if (!info?.lastAt) continue;
    if (info.lastSenderId === userId) continue;
    const seenAt =
      prefix === "plan" ? getPlanThreadSeenAt(userId, threadId) : getFunctionThreadSeenAt(userId, threadId);
    if (new Date(info.lastAt).getTime() > seenAt) out[threadId] = 1;
  }
  return out;
}
