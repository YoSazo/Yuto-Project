-- Plan Memories: photos uploaded by members after an event/plan is done
CREATE TABLE IF NOT EXISTS public.plan_memories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text DEFAULT 'image', -- 'image' or 'video'
  caption text,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_plan_memories_plan_id ON public.plan_memories(plan_id);

-- RLS: members of the plan can read all memories, and upload their own
ALTER TABLE public.plan_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan members can read memories" ON public.plan_memories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plan_members WHERE plan_id = plan_memories.plan_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM plans WHERE id = plan_memories.plan_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Plan members can insert memories" ON public.plan_memories
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM plan_members WHERE plan_id = plan_memories.plan_id AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM plans WHERE id = plan_memories.plan_id AND creator_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete own memories" ON public.plan_memories
  FOR DELETE USING (auth.uid() = user_id);
