import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import FareShareScreen from "./pages/FareShareScreen";
import YourYutosScreen from "./pages/YourYutosScreen";
import ProfileScreen from "./pages/ProfileScreen";
import YutoGroupScreen from "./pages/YutoGroupScreen";
import YutoChatScreen from "./pages/YutoChatScreen";
import AuthScreen from "./pages/AuthScreen";
import FriendsScreen from "./pages/FriendsScreen";
import WelcomeScreen from "./pages/WelcomeScreen";
import WaitlistThanksScreen from "./pages/WaitlistThanksScreen";

export const router = createBrowserRouter([
  { path: "/auth", element: <AuthScreen /> },
  { path: "/welcome", element: <WelcomeScreen /> },
  { path: "/waitlist-thanks", element: <WaitlistThanksScreen /> },
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Navigate to="/split" replace /> },
      { path: "/split", element: <FareShareScreen /> },
      { path: "/activity", element: <YourYutosScreen /> },
      { path: "/profile", element: <ProfileScreen /> },
      { path: "/friends", element: <FriendsScreen /> },
      { path: "/yuto/:groupId", element: <YutoGroupScreen /> },
      { path: "/yuto/:groupId/chat", element: <YutoChatScreen /> },
    ],
  },
]);
