import { useMemo, useRef, useState } from "react";
import { MessageCircle, Trash2, Volume2, VolumeX } from "lucide-react";
import type { PublicPost } from "../../lib/supabase";
import UserAvatar from "../UserAvatar";
import { PostMediaCarousel } from "./PostMediaCarousel";
import { FunctionCard } from "../cards/FunctionCard";
import type { FunctionListing } from "../../pages/home/types";
import type { DmSharePayload } from "../../lib/supabase";

function extractEntityTag(tagPayload: any): { kind: "plan" | "function" | "listing"; function_id?: string; plan_id?: string; listing_kind?: "sell" | "service" } | null {
  if (!tagPayload) return null;
  const t = tagPayload?.entity ?? tagPayload;
  if (!t || typeof t !== "object") return null;
  if (t.kind === "plan" && typeof t.plan_id === "string") return t;
  if (t.kind === "function" && typeof t.function_id === "string") return t;
  if (t.kind === "listing" && typeof t.function_id === "string") return t;
  return null;
}

function tagLabel(tag: { kind: string; listing_kind?: string }): string {
  if (tag.kind === "plan") return "Plan";
  if (tag.kind === "function") return "Function";
  if (tag.kind === "listing") return tag.listing_kind === "sell" ? "Storefront" : "Services";
  return "Tag";
}

export function PostsFeedSection({
  posts,
  onNavigateToTag,
  onNavigateToAuthor,
  taggedFunctionsById,
  onJoinFunction,
  onOpenTicket,
  onNavigateToHost,
  onShareInMessages,
  currentUserId,
  onDeletePost,
  taggedProfilesById,
}: {
  posts: PublicPost[];
  onNavigateToTag: (tag: any) => void;
  onNavigateToAuthor?: (userId: string) => void;
  taggedFunctionsById?: Record<string, FunctionListing>;
  onJoinFunction?: (f: FunctionListing) => void;
  onOpenTicket?: (f: FunctionListing) => void;
  onNavigateToHost?: (hostId: string) => void;
  onShareInMessages?: (payload: DmSharePayload) => void;
  currentUserId?: string;
  onDeletePost?: (postId: string) => void;
  taggedProfilesById?: Record<string, { id: string; username: string; display_name: string; avatar_url: string | null }>;
}) {
  const visiblePosts = useMemo(() => posts.filter((p) => !!p.content_text?.trim()), [posts]);
  const legacyVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [legacyUnmuted, setLegacyUnmuted] = useState<Record<string, boolean>>({});

  if (visiblePosts.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Public posts</p>
        <span className="text-xs text-gray-400">Top of Funnel</span>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        {visiblePosts.map((post) => (
          <div key={post.id} className="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => onNavigateToAuthor?.(post.user_id)}
                className="bg-transparent border-none p-0 text-left"
                aria-label="Open profile"
              >
                <UserAvatar
                  name={post.author.display_name || post.author.username}
                  avatarUrl={post.author.avatar_url || null}
                  size="sm"
                />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => onNavigateToAuthor?.(post.user_id)}
                    className="bg-transparent border-none p-0 text-left font-extrabold text-black truncate hover:opacity-80 transition-opacity"
                  >
                    {post.author.display_name || post.author.username}
                  </button>
                  <span className="text-xs text-gray-400 font-semibold">
                    · {new Date(post.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
                  </span>
                  {currentUserId && post.user_id === currentUserId && onDeletePost && (
                    <button
                      type="button"
                      onClick={() => onDeletePost(post.id)}
                      className="ml-auto w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                      aria-label="Delete post"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap break-words">{post.content_text}</p>

                {Array.isArray((post as any)?.tag_payload?.tagged_user_ids) &&
                ((post as any).tag_payload.tagged_user_ids as any[]).length > 0 ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {((post as any).tag_payload.tagged_user_ids as any[])
                      .filter((id) => typeof id === "string")
                      .slice(0, 3)
                      .map((id) => {
                        const p = taggedProfilesById?.[id];
                        const label = p ? `@${p.username}` : "@user";
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => (p ? onNavigateToAuthor?.(p.id) : undefined)}
                            className="w-full rounded-2xl border border-gray-100 bg-white shadow-sm px-3 py-2.5 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
                          >
                            {p ? <UserAvatar name={p.display_name || p.username} avatarUrl={p.avatar_url} size="sm" /> : null}
                            <div className="min-w-0 flex-1">
                              <p className="font-extrabold text-black truncate">{p?.display_name || p?.username || "User"}</p>
                              <p className="text-xs text-gray-400 font-bold truncate">{label}</p>
                            </div>
                            <span className="text-xs font-bold text-gray-400">View profile</span>
                          </button>
                        );
                      })}
                    {((post as any).tag_payload.tagged_user_ids as any[]).length > 3 ? (
                      <span className="text-xs font-bold text-gray-400">
                        +{((post as any).tag_payload.tagged_user_ids as any[]).length - 3} more
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {(() => {
                  const tag = extractEntityTag(post.tag_payload);
                  if (!tag) return null;
                  if ((tag.kind === "function" || tag.kind === "listing") && tag.function_id && taggedFunctionsById?.[tag.function_id] && onNavigateToHost) {
                    const f = taggedFunctionsById[tag.function_id]!;
                    return (
                      <div className="mt-3 -ml-12 w-[calc(100%+3rem)]">
                        <div className="w-full mx-auto">
                          <FunctionCard
                            eventFunction={f}
                            currentUserId={currentUserId}
                            onNavigateToHost={onNavigateToHost}
                            onJoinFunction={onJoinFunction}
                            onOpenTicket={onOpenTicket}
                            onShareInMessages={onShareInMessages}
                          />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => onNavigateToTag(tag)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-colors"
                      >
                        <MessageCircle size={14} className="opacity-70" />
                        <span className="text-xs font-extrabold text-black">{tagLabel(tag)}</span>
                        <span className="text-xs text-gray-500 font-semibold">· Tap to view</span>
                      </button>
                    </div>
                  );
                })()}

                {Array.isArray(post.media) && post.media.length > 0 ? (
                  <div className="mt-3 -ml-12 w-[calc(100%+3rem)]">
                    <PostMediaCarousel media={post.media as any} />
                  </div>
                ) : post.media_url ? (
                  <div className="mt-3 -ml-12 w-[calc(100%+3rem)]">
                    <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
                    {(() => {
                      const mediaType = (post as any).media_type as string | undefined;
                      const url = String(post.media_url);
                      const looksVideo =
                        mediaType === "video" || /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(url);
                      if (looksVideo) {
                        return (
                          <div className="relative w-full bg-gray-50 flex items-center justify-center overflow-hidden">
                            {/* blurred fill background to avoid black bars */}
                            <video
                              src={url}
                              className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-35"
                              muted
                              playsInline
                              autoPlay
                              loop
                              preload="metadata"
                              controls={false}
                              aria-hidden
                            />
                            <video
                              src={url}
                              poster={(post as any).media_thumb_url || undefined}
                              className="block w-full h-auto max-h-[520px] object-contain"
                              muted={!legacyUnmuted[post.id]}
                              playsInline
                              autoPlay
                              loop
                              preload="metadata"
                              controls={false}
                              controlsList="nodownload noplaybackrate noremoteplayback"
                              disablePictureInPicture
                              ref={(el) => {
                                legacyVideoRefs.current[post.id] = el;
                              }}
                              onContextMenu={(ev) => ev.preventDefault()}
                              onClick={(ev) => {
                                const v = ev.currentTarget;
                                if (v.paused) void v.play().catch(() => {});
                                else v.pause();
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setLegacyUnmuted((prev) => {
                                  const next = { ...prev, [post.id]: !prev[post.id] };
                                  const v = legacyVideoRefs.current[post.id];
                                  if (v) v.muted = !next[post.id];
                                  return next;
                                });
                              }}
                              className="absolute bottom-3 right-3 z-10 w-11 h-11 rounded-2xl bg-white/15 text-white flex items-center justify-center hover:bg-white/25 border-none"
                              aria-label={legacyUnmuted[post.id] ? "Mute" : "Unmute"}
                              title={legacyUnmuted[post.id] ? "Mute" : "Unmute"}
                            >
                              {legacyUnmuted[post.id] ? <Volume2 size={18} /> : <VolumeX size={18} />}
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div className="relative w-full bg-gray-50 overflow-hidden">
                          <img
                            src={url}
                            alt=""
                            aria-hidden
                            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-35"
                          />
                          <img src={url} alt="" className="w-full h-[520px] object-contain block relative" />
                        </div>
                      );
                    })()}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

