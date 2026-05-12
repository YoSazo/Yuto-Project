import { useState, useEffect, useRef } from "react";
import { X, Camera, Image as ImageIcon, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import UserAvatar from "../UserAvatar";
import { toast } from "sonner";

type Memory = {
  id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  user_id: string;
  profiles: { display_name: string; avatar_url: string | null };
};

export function PlanMemoriesModal({
  open,
  planId,
  planTitle,
  currentUserId,
  onClose,
}: {
  open: boolean;
  planId: string;
  planTitle: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && planId) loadMemories();
  }, [open, planId]);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("plan_memories")
        .select("id, media_url, media_type, caption, created_at, user_id, profiles:profiles!plan_memories_user_id_fkey(display_name, avatar_url)")
        .eq("plan_id", planId)
        .order("created_at", { ascending: false });
      setMemories((data || []) as unknown as Memory[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${currentUserId}/memories/${planId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("plan-images")
          .upload(path, file, { contentType: file.type });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from("plan-images").getPublicUrl(path);

        await supabase.from("plan_memories").insert({
          plan_id: planId,
          user_id: currentUserId,
          media_url: urlData.publicUrl,
          media_type: file.type.startsWith("video") ? "video" : "image",
        });
      }
      toast.success("Photos added!");
      loadMemories();
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (memoryId: string) => {
    try {
      await supabase.from("plan_memories").delete().eq("id", memoryId);
      setMemories((prev) => prev.filter((m) => m.id !== memoryId));
      toast.success("Deleted");
    } catch {
      toast.error("Couldn't delete");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm fade-in">
      <button type="button" className="absolute inset-0 border-none bg-transparent" aria-label="Dismiss" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md max-h-[85vh] bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl modal-slide-up flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-gray-100 dark:border-zinc-800">
          <div>
            <h2 className="font-black text-lg text-black dark:text-white">Memories</h2>
            <p className="text-xs text-gray-400 truncate max-w-[200px]">{planTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center border-none">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleUpload}
          className="hidden"
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : memories.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 mx-auto flex items-center justify-center mb-4">
                <ImageIcon size={28} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="font-bold text-black dark:text-white mb-1">No memories yet</p>
              <p className="text-sm text-gray-400 mb-4">Be the first to share a photo from this plan!</p>
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="px-5 py-3 bg-purple-600 text-white rounded-2xl font-bold text-sm border-none active:scale-[0.98] transition-transform"
                >
                  <span className="flex items-center gap-2"><Camera size={16} /> Take photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-5 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-sm border-none active:scale-[0.98] transition-transform"
                >
                  <span className="flex items-center gap-2"><ImageIcon size={16} /> Gallery</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Grid */}
              <div className="grid grid-cols-3 gap-1.5 mb-4">
                {memories.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedImage(m.id)}
                    className="aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800 border-none p-0 relative group"
                  >
                    {m.media_type === "video" ? (
                      <video src={m.media_url} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={m.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    )}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform border-none"
                >
                  <Camera size={16} /> {uploading ? "Uploading..." : "Take photo"}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform border-none"
                >
                  <ImageIcon size={16} /> {uploading ? "..." : "Add photo"}
                </button>
              </div>

              {/* Full-screen viewer with swipe */}
              {selectedImage && (() => {
                const idx = memories.findIndex((m) => m.id === selectedImage);
                const mem = memories[idx];
                if (!mem) return null;
                return (
                  <div className="fixed top-0 left-0 right-0 bottom-0 z-[60] bg-black fade-in" style={{ position: 'fixed', height: '100%', width: '100%', touchAction: 'pan-x' }}>
                    <div className="absolute top-5 right-5 z-20">
                      <button type="button" onClick={() => setSelectedImage(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border-none">
                        <X size={20} className="text-white" />
                      </button>
                    </div>
                    {mem.user_id === currentUserId && (
                      <div className="absolute top-5 left-5 z-20">
                        <button type="button" onClick={() => { handleDelete(mem.id); setSelectedImage(null); }} className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center border-none">
                          <Trash2 size={18} className="text-red-400" />
                        </button>
                      </div>
                    )}
                    {/* Single image centered */}
                    <div className="w-full h-full flex items-center justify-center p-4 pt-16 pb-24">
                      <img src={mem.media_url} alt="" className="max-w-full max-h-full object-contain rounded-lg" draggable={false} />
                    </div>
                    {/* Dots */}
                    {memories.length > 1 && (
                      <div className="absolute bottom-20 left-0 right-0 flex items-center justify-center gap-1.5 z-20">
                        {memories.map((m, i) => (
                          <span key={m.id} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/40"}`} />
                        ))}
                      </div>
                    )}
                    {/* Nav arrows (small, subtle) */}
                    {idx > 0 && (
                      <button type="button" onClick={() => setSelectedImage(memories[idx - 1].id)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border-none z-20 text-white text-sm">&lt;</button>
                    )}
                    {idx < memories.length - 1 && (
                      <button type="button" onClick={() => setSelectedImage(memories[idx + 1].id)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border-none z-20 text-white text-sm">&gt;</button>
                    )}
                    {/* Author info */}
                    <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-2 z-20">
                      <UserAvatar name={mem.profiles.display_name} avatarUrl={mem.profiles.avatar_url} size="sm" />
                      <span className="text-white text-sm font-semibold">{mem.profiles.display_name}</span>
                      <span className="text-white/50 text-xs">{new Date(mem.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
