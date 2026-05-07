export interface PlanMember {
  id: string;
  user_id: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export interface PlanMessage {
  id: string;
  plan_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export interface PlanUpdate {
  id: string;
  content: string;
  created_at: string;
  creator_id: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  };
}

export interface Plan {
  id: string;
  creator_id: string;
  title: string;
  amount: number | null;
  slots: number | null;
  image_url: string | null;
  media?: Array<{ id: string; media_url: string; media_type: string; sort_index: number }>;
  yuto_group_id: string | null;
  created_at: string;
  status: string;
  creator: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  plan_members: PlanMember[];
}

export interface FunctionMember {
  id: string;
  user_id: string;
  has_paid: boolean;
  joined_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export interface FunctionMessage {
  id: string;
  function_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export interface FunctionListing {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  media?: Array<{ id: string; media_url: string; media_type: string; sort_index: number }>;
  date: string | null;
  location: string | null;
  amount_per_person: number;
  max_capacity: number | null;
  mode: "pay" | "pledge";
  goal_count: number | null;
  deadline: string | null;
  status: "open" | "funded" | "cancelled";
  is_public: boolean;
  created_at: string;
  host: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  function_members: FunctionMember[];
}

export function formatEventDate(dateValue: string | null) {
  if (!dateValue) return "Anytime";
  return new Date(dateValue).toLocaleDateString("en-KE", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
