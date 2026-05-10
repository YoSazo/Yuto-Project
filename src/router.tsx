import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import SplitScreen from "./pages/SplitScreen";
import YourYutosScreen from "./pages/YourYutosScreen";
import ProfileScreen from "./pages/ProfileScreen";
import YutoGroupScreen from "./pages/YutoGroupScreen";
import YutoChatScreen from "./pages/YutoChatScreen";
import AuthScreen from "./pages/AuthScreen";
import FriendsScreen from "./pages/FriendsScreen";
import WelcomeScreen from "./pages/WelcomeScreen";
import WaitlistThanksScreen from "./pages/WaitlistThanksScreen";
import JoinGroupScreen from "./pages/JoinGroupScreen";
import InviteScreen from "./pages/InviteScreen";
import UserProfileScreen from "./pages/UserProfileScreen";
import HomeScreen from "./pages/HomeScreen";
import AddToHomeScreen from "./pages/AddToHomeScreen";
import MessagesScreen from "./pages/MessagesScreen";
import DirectMessageScreen from "./pages/DirectMessageScreen";
import CreateGroupChatScreen from "./pages/CreateGroupChatScreen";
import GroupChatScreen from "./pages/GroupChatScreen";
import GroupChatMembersScreen from "./pages/GroupChatMembersScreen";
import NotificationsScreen from "./pages/NotificationsScreen";
import FunctionLandingScreen from "./pages/FunctionLandingScreen";

export const router = createBrowserRouter([
  { path: "/auth", element: <AuthScreen /> },
  { path: "/welcome", element: <WelcomeScreen /> },
  { path: "/waitlist-thanks", element: <WaitlistThanksScreen /> },
  { path: "/join/:groupId", element: <JoinGroupScreen /> },
  { path: "/invite/:username", element: <InviteScreen /> },
  { path: "/function/:functionId", element: <FunctionLandingScreen /> },
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Navigate to="/home" replace /> },
      { path: "/split", element: <SplitScreen /> },
      { path: "/activity", element: <YourYutosScreen /> },
      { path: "/profile", element: <ProfileScreen /> },
      { path: "/friends", element: <FriendsScreen /> },
      { path: "/yuto/:groupId", element: <YutoGroupScreen /> },
      { path: "/yuto/:groupId/chat", element: <YutoChatScreen /> },
      { path: "/user/:id", element: <UserProfileScreen /> },
      { path: "/home", element: <HomeScreen /> },
      { path: "/messages", element: <MessagesScreen /> },
      { path: "/notifications", element: <NotificationsScreen /> },
      { path: "/messages/group/new", element: <CreateGroupChatScreen /> },
      { path: "/messages/group/:groupId", element: <GroupChatScreen /> },
      { path: "/messages/group/:groupId/members", element: <GroupChatMembersScreen /> },
      { path: "/messages/:conversationId", element: <DirectMessageScreen /> },
      { path: "/add-to-home", element: <AddToHomeScreen /> },
    ],
  },
]);
