import { useMemo } from "react";
import { MessageCircle, Trash2 } from "lucide-react";
import type { PublicPost } from "../../lib/supabase";
import UserAvatar from "../UserAvatar";

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
  currentUserId,
  onDeletePost,
}: {
  posts: PublicPost[];
  onNavigateToTag: (tag: any) => void;
  currentUserId?: string;
  onDeletePost?: (postId: string) => void;
}) {
  const visiblePosts = useMemo(() => posts.filter((p) => !!p.content_text?.trim()), [posts]);

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
              <UserAvatar
                name={post.author.display_name || post.author.username}
                avatarUrl={post.author.avatar_url || null}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-extrabold text-black truncate">{post.author.display_name || post.author.username}</p>
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

                {extractEntityTag(post.tag_payload) && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => onNavigateToTag(extractEntityTag(post.tag_payload))}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-colors"
                    >
                      <MessageCircle size={14} className="opacity-70" />
                      <span className="text-xs font-extrabold text-black">{tagLabel(extractEntityTag(post.tag_payload)!)}</span>
                      <span className="text-xs text-gray-500 font-semibold">· Tap to view</span>
                    </button>
                  </div>
                )}

                {post.media_url && (
                  <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
                    {post.media_type === "video" ? (
                      <video
                        src={post.media_url}
                        poster={post.media_thumb_url || undefined}
                        className="w-full h-[220px] object-cover bg-black"
                        muted
                        playsInline
                        controls
                        preload="metadata"
                      />
                    ) : (
                      <img src={post.media_url} alt="" className="w-full h-[220px] object-cover" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

