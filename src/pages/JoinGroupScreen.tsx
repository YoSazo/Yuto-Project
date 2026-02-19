import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

export default function JoinGroupScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    fetchGroup();
  }, [groupId]);

  const fetchGroup = async () => {
    try {
      const { data, error } = await supabase
        .from("groups")
        .select(`*, group_members(user_id, has_joined, profiles(display_name, username))`)
        .eq("id", groupId)
        .single();
      if (error) throw error;
      setGroup(data);
      if (user) {
        const isMember = data.group_members.some((m: any) => m.user_id === user.id);
        setAlreadyMember(isMember);
      }
    } catch {
      setError("This invite link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      // Save the intended destination and redirect to auth
      sessionStorage.setItem("joinAfterAuth", `/join/${groupId}`);
      navigate("/auth");
      return;
    }

    if (alreadyMember) {
      navigate(`/yuto/${groupId}`);
      return;
    }

    setJoining(true);
    try {
      // Add user as a group member
      const { error: memberError } = await supabase.from("group_members").insert({
        group_id: groupId,
        user_id: user.id,
        has_joined: true,
        joined_at: new Date().toISOString(),
      });
      if (memberError) throw memberError;
      navigate(`/yuto/${groupId}`);
    } catch (err: any) {
      setError(err.message || "Failed to join group. Try again.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <img src={imgYutoMascot} className="w-24 h-24 mb-6" alt="Yuto" />
        <h1 className="text-2xl font-bold mb-2">Oops!</h1>
        <p className="text-gray-500 mb-6">{error}</p>
        <button
          onClick={() => navigate("/")}
          className="w-full max-w-xs bg-black text-white rounded-2xl py-4 font-bold"
        >
          Go to Yuto
        </button>
      </div>
    );
  }

  const memberCount = group.group_members.length;
  const hostName = group.group_members.find((m: any) => m.user_id === group.created_by)?.profiles?.display_name || "Someone";
  const perPerson = group.per_person;
  const groupType = group.group_type || "single";

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 py-12">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <img src={imgYutoMascot} className="w-20 h-20 mb-4" alt="Yuto" />
        <p className="text-gray-500 text-sm mb-1">You've been invited by</p>
        <h1 className="text-3xl font-black">{hostName}</h1>
      </div>

      {/* Group card */}
      <div className="bg-gray-50 rounded-3xl p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-500 text-sm">Group</span>
          <span className="font-bold">{group.name}</span>
        </div>
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-500 text-sm">Type</span>
          <span className="font-bold capitalize">{groupType === "multi" ? "Separate rides" : "Same ride"}</span>
        </div>
        {perPerson > 0 && (
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-500 text-sm">Per person</span>
            <span className="font-bold text-lg">KSH {perPerson}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-gray-500 text-sm">Members</span>
          <div className="flex items-center gap-1">
            {group.group_members.slice(0, 3).map((m: any, i: number) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full bg-black text-white text-xs flex items-center justify-center font-bold -ml-1 first:ml-0"
              >
                {m.profiles?.display_name?.[0]?.toUpperCase() || "?"}
              </div>
            ))}
            {memberCount > 3 && (
              <span className="text-xs text-gray-500 ml-1">+{memberCount - 3} more</span>
            )}
          </div>
        </div>
      </div>

      {/* Members list */}
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-3">Who's in</p>
        <div className="space-y-2">
          {group.group_members.map((m: any, i: number) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm">
                {m.profiles?.display_name?.[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="font-semibold text-sm">{m.profiles?.display_name}</p>
                <p className="text-xs text-gray-400">@{m.profiles?.username}</p>
              </div>
              {m.user_id === group.created_by && (
                <span className="ml-auto text-xs bg-black text-white px-2 py-0.5 rounded-full">Host</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-auto">
        {alreadyMember ? (
          <button
            onClick={() => navigate(`/yuto/${groupId}`)}
            className="w-full bg-black text-white rounded-2xl py-4 font-bold text-lg"
          >
            Open Group
          </button>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full bg-black text-white rounded-2xl py-4 font-bold text-lg disabled:opacity-60"
          >
            {joining ? "Joining..." : user ? "Join Group" : "Sign up to Join"}
          </button>
        )}
        {error && <p className="text-red-500 text-sm text-center mt-3">{error}</p>}
        {!user && (
          <p className="text-center text-xs text-gray-400 mt-3">
            You'll need a Yuto account to join
          </p>
        )}
      </div>
    </div>
  );
}
