import { createBrowserRouter } from 'react-router-dom';
import Layout from './components/Layout';

// Pages
import HomeScreen from './pages/HomeScreen';
import YourYutosScreen from './pages/YourYutosScreen';
import VenuesMapScreen from './pages/VenuesMapScreen';
import ProfileScreen from './pages/ProfileScreen';
import FareShareScreen from './pages/FareShareScreen';
import CreateYutoScreen from './pages/CreateYutoScreen';
import YutoGroupScreen from './pages/YutoGroupScreen';
import YutoChatScreen from './pages/YutoChatScreen';
import WelcomeScreen from './pages/WelcomeScreen';
import WaitlistThanksScreen from './pages/WaitlistThanksScreen';

export const router = createBrowserRouter([
  // Waitlist flow (no nav bar)
  {
    path: '/welcome',
    element: <WelcomeScreen />,
  },
  {
    path: '/waitlist-thanks',
    element: <WaitlistThanksScreen />,
  },
  
  // Main app with layout (has nav bar)
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <YourYutosScreen />,
      },
      {
        path: 'home',
        element: <YourYutosScreen />,
      },
      {
        path: 'venues',
        element: <VenuesMapScreen />,
      },
      {
        path: 'venues/browse',
        element: <HomeScreen />,
      },
      {
        path: 'profile',
        element: <ProfileScreen />,
      },
      {
        path: 'fare-share',
        element: <FareShareScreen />,
      },
      {
        path: 'create-yuto',
        element: <CreateYutoScreen />,
      },
      {
        path: 'yuto/:groupId',
        element: <YutoGroupScreen />,
      },
      {
        path: 'yuto/:groupId/chat',
        element: <YutoChatScreen />,
      },
    ],
  },
]);
