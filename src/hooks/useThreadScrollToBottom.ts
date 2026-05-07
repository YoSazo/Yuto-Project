import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

const NEAR_BOTTOM_PX = 120;
const PIN_MS = 4500;

function nearBottom(el: HTMLElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
}

/** Keeps DM / group threads pinned to the latest message after open and when async content grows. */
export function useThreadScrollToBottom(
  threadId: string | undefined,
  loading: boolean,
  messagesLength: number,
) {
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  /** After navigation, keep forcing bottom while content (images, cards) settles */
  const pinBottomRef = useRef(true);

  useEffect(() => {
    pinBottomRef.current = true;
    const t = window.setTimeout(() => {
      pinBottomRef.current = false;
    }, PIN_MS);
    return () => clearTimeout(t);
  }, [threadId]);

  const scrollToBottom = useCallback(() => {
    const vp = scrollViewportRef.current;
    if (!vp) return;
    vp.scrollTop = vp.scrollHeight;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  const maybeScrollToBottom = useCallback(() => {
    const vp = scrollViewportRef.current;
    if (!vp) return;
    if (pinBottomRef.current || nearBottom(vp)) scrollToBottom();
  }, [scrollToBottom]);

  // Hard scroll when thread finishes loading (first paint of messages)
  useLayoutEffect(() => {
    if (loading || !threadId) return;
    scrollToBottom();
    const id = requestAnimationFrame(() => requestAnimationFrame(scrollToBottom));
    return () => cancelAnimationFrame(id);
  }, [loading, threadId, scrollToBottom]);

  // Catch late layout (fonts, images) without waiting on cache explicitly
  useEffect(() => {
    if (loading || !threadId) return;
    const t1 = window.setTimeout(scrollToBottom, 0);
    const t2 = window.setTimeout(scrollToBottom, 80);
    const t3 = window.setTimeout(scrollToBottom, 250);
    const t4 = window.setTimeout(scrollToBottom, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [loading, threadId, messagesLength, scrollToBottom]);

  // New messages: only follow if user was already at bottom (or still pinned)
  useLayoutEffect(() => {
    if (loading || !threadId) return;
    maybeScrollToBottom();
  }, [loading, threadId, messagesLength, maybeScrollToBottom]);

  useEffect(() => {
    const vp = scrollViewportRef.current;
    const content = contentRef.current;
    if (!vp || !content || loading || !threadId) return;

    const ro = new ResizeObserver(() => {
      if (pinBottomRef.current || nearBottom(vp)) {
        vp.scrollTop = vp.scrollHeight;
      }
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [loading, threadId, messagesLength]);

  const onScrollViewport = useCallback(() => {
    const vp = scrollViewportRef.current;
    if (!vp) return;
    if (!nearBottom(vp)) pinBottomRef.current = false;
  }, []);

  return { scrollViewportRef, bottomRef, contentRef, onScrollViewport };
}
