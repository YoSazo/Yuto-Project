import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import { useAuth } from "../contexts/AuthContext";
import { getFriends, getMyGroups } from "../lib/supabase";

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function MenuItem({
  icon,
  label,
  sublabel,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-4 px-1 bg-transparent border-none cursor-pointer text-left"
    >
      <div className="flex items-center gap-4">
        <div className={danger ? "text-red-500" : "text-black"}>{icon}</div>
        <div>
          <p className={`font-semibold text-[15px] ${danger ? "text-red-500" : "text-black"}`}>
            {label}
          </p>
          {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
        </div>
      </div>
      {!danger && <ChevronRight />}
    </button>
  );
}

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [stats, setStats] = useState({ totalYutos: 0, totalSpent: 0, friendsCount: 0 });

  useEffect(() => {
    if (!user) return;
    Promise.all([getMyGroups(), getFriends(user.id)]).then(
      ([groups, friends]) => {
        const paidGroups = (groups as any[]).filter((g: any) =>
          g.group_members.some((m: any) => m.user_id === user.id && m.has_paid)
        );
        const totalSpent = paidGroups.reduce((sum: number, g: any) => sum + g.per_person, 0);
        setStats({
          totalYutos: groups.length,
          totalSpent,
          friendsCount: friends.length,
        });
      }
    );
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const userName = profile?.display_name || "User";
  const userHandle = profile?.username ? `@${profile.username}` : "";

  return (
    <div className="flex flex-col min-h-full px-6 pt-14">
      <div className="flex items-center justify-between mb-8">
        <span className="text-2xl font-bold text-black">Profile</span>
      </div>

      {/* Profile card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 relative">
        <img
          src={imgYutoMascot}
          alt="Yuto"
          className="absolute top-3 right-3 w-8 h-8 object-contain opacity-40"
        />
        <div className="flex items-center gap-5">
          <div className="w-[72px] h-[72px] rounded-full bg-black flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
            {userName.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-xl text-black">{userName}</p>
            <p className="text-sm text-gray-400 mt-0.5">{userHandle}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl py-4 px-3 text-center">
          <p className="font-bold text-xl text-black">{stats.totalYutos}</p>
          <p className="text-xs text-gray-400 mt-1">Splits</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl py-4 px-3 text-center">
          <p className="font-bold text-lg text-black">{stats.totalSpent.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">KSH Paid</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl py-4 px-3 text-center">
          <p className="font-bold text-xl text-black">{stats.friendsCount}</p>
          <p className="text-xs text-gray-400 mt-1">Friends</p>
        </div>
      </div>

      {/* Menu */}
      <div className="bg-white border border-gray-200 rounded-2xl px-5 divide-y divide-gray-100">
        <MenuItem
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          label="Friends"
          sublabel={`${stats.friendsCount} friends`}
          onClick={() => navigate("/friends")}
        />
        <MenuItem
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
          label="Split History"
          sublabel="View past fare splits"
          onClick={() => navigate("/activity")}
        />
        <MenuItem
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          }
          label="Log Out"
          danger
          onClick={handleLogout}
        />
      </div>
    </div>
  );
}
