import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "./components/Layout";

// Eagerly loaded (critical path — first screen users see)
import AuthScreen from "./pages/AuthScreen";
import HomeScreen from "./pages/HomeScreen";

// Lazy loaded (only downloaded when navigated to)
const SplitScreen = lazy(() => import("./pages/SplitScreen"));
const YourYutosScreen = lazy(() => import("./pages/YourYutosScreen"));
const ProfileScreen = lazy(() => import("./pages/ProfileScreen"));
const YutoGroupScreen = lazy(() => import("./pages/YutoGroupScreen"));
const YutoChatScreen = lazy(() => import("./pages/YutoChatScreen"));
const FriendsScreen = lazy(() => import("./pages/FriendsScreen"));
const OnboardingScreen = lazy(() => import("./pages/OnboardingScreen"));
const JoinGroupScreen = lazy(() => import("./pages/JoinGroupScreen"));
const InviteScreen = lazy(() => import("./pages/InviteScreen"));
const UserProfileScreen = lazy(() => import("./pages/UserProfileScreen"));
const AddToHomeScreen = lazy(() => import("./pages/AddToHomeScreen"));
const MessagesScreen = lazy(() => import("./pages/MessagesScreen"));
const DirectMessageScreen = lazy(() => import("./pages/DirectMessageScreen"));
const CreateGroupChatScreen = lazy(() => import("./pages/CreateGroupChatScreen"));
const GroupChatScreen = lazy(() => import("./pages/GroupChatScreen"));
const GroupChatMembersScreen = lazy(() => import("./pages/GroupChatMembersScreen"));
const NotificationsScreen = lazy(() => import("./pages/NotificationsScreen"));
const FunctionLandingScreen = lazy(() => import("./pages/FunctionLandingScreen"));
const PlanLandingScreen = lazy(() => import("./pages/PlanLandingScreen"));
const TermsScreen = lazy(() => import("./pages/TermsScreen"));
const PrivacyScreen = lazy(() => import("./pages/PrivacyScreen"));
const AdminScreen = lazy(() => import("./pages/AdminScreen"));
const ReferralLandingScreen = lazy(() => import("./pages/ReferralLandingScreen"));
const CreatorLandingScreen = lazy(() => import("./pages/CreatorLandingScreen"));
const WalletScreen = lazy(() => import("./pages/WalletScreen"));

function Lazy({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin" /></div>}>
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: "/auth", element: <AuthScreen /> },
  { path: "/onboarding", element: <Lazy><OnboardingScreen /></Lazy> },
  { path: "/join/:groupId", element: <Lazy><JoinGroupScreen /></Lazy> },
  { path: "/invite/:username", element: <Lazy><InviteScreen /></Lazy> },
  { path: "/function/:functionId", element: <Lazy><FunctionLandingScreen /></Lazy> },
  { path: "/plan/:planId", element: <Lazy><PlanLandingScreen /></Lazy> },
  { path: "/terms", element: <Lazy><TermsScreen /></Lazy> },
  { path: "/privacy", element: <Lazy><PrivacyScreen /></Lazy> },
  { path: "/admin", element: <Lazy><AdminScreen /></Lazy> },
  { path: "/referral/:username", element: <Lazy><ReferralLandingScreen /></Lazy> },
  { path: "/creator-invite/:username", element: <Lazy><CreatorLandingScreen /></Lazy> },
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Navigate to="/home" replace /> },
      { path: "/split", element: <Lazy><SplitScreen /></Lazy> },
      { path: "/wallet", element: <Lazy><WalletScreen /></Lazy> },
      { path: "/activity", element: <Lazy><YourYutosScreen /></Lazy> },
      { path: "/profile", element: <Lazy><ProfileScreen /></Lazy> },
      { path: "/friends", element: <Lazy><FriendsScreen /></Lazy> },
      { path: "/yuto/:groupId", element: <Lazy><YutoGroupScreen /></Lazy> },
      { path: "/yuto/:groupId/chat", element: <Lazy><YutoChatScreen /></Lazy> },
      { path: "/user/:id", element: <Lazy><UserProfileScreen /></Lazy> },
      { path: "/home", element: <HomeScreen /> },
      { path: "/messages", element: <Lazy><MessagesScreen /></Lazy> },
      { path: "/notifications", element: <Lazy><NotificationsScreen /></Lazy> },
      { path: "/messages/group/new", element: <Lazy><CreateGroupChatScreen /></Lazy> },
      { path: "/messages/group/:groupId", element: <Lazy><GroupChatScreen /></Lazy> },
      { path: "/messages/group/:groupId/members", element: <Lazy><GroupChatMembersScreen /></Lazy> },
      { path: "/messages/:conversationId", element: <Lazy><DirectMessageScreen /></Lazy> },
      { path: "/add-to-home", element: <Lazy><AddToHomeScreen /></Lazy> },
    ],
  },
]);
