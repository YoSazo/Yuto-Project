const FUNCTION_THREAD_SEEN_PREFIX = "yuto_function_thread_seen:";

export function getFunctionThreadSeenAt(userId: string, functionId: string) {
  if (typeof window === "undefined") return 0;
  const value = window.localStorage.getItem(`${FUNCTION_THREAD_SEEN_PREFIX}${userId}:${functionId}`);
  return value ? Number(value) || 0 : 0;
}

export function setFunctionThreadSeenAt(userId: string, functionId: string, timestamp: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${FUNCTION_THREAD_SEEN_PREFIX}${userId}:${functionId}`, String(new Date(timestamp).getTime()));
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
