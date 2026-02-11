import { createContext, useContext, useState, ReactNode } from 'react';
import { 
  yutoGroups as initialYutoGroups, 
  venues as initialVenues,
  friends as initialFriends,
  currentUser,
  YutoGroup,
  Venue,
  Friend,
  User,
} from '../data/mockData';

// ===========================================
// CONTEXT TYPES
// ===========================================
interface AppState {
  user: User;
  yutoGroups: YutoGroup[];
  venues: Venue[];
  friends: Friend[];
}

interface AppContextType extends AppState {
  // Yuto actions
  addYutoGroup: (group: Omit<YutoGroup, 'id' | 'createdAt'>) => YutoGroup;
  updateYutoGroup: (id: string, updates: Partial<YutoGroup>) => void;
  getYutoById: (id: string) => YutoGroup | undefined;
  
  // Venue actions
  getVenueById: (id: number) => Venue | undefined;
  
  // Friend actions
  addFriend: (friend: Omit<Friend, 'id'>) => void;
}

// ===========================================
// CONTEXT
// ===========================================
const AppContext = createContext<AppContextType | undefined>(undefined);

// ===========================================
// PROVIDER
// ===========================================
export function AppProvider({ children }: { children: ReactNode }) {
  const [user] = useState<User>(currentUser);
  const [yutoGroups, setYutoGroups] = useState<YutoGroup[]>(initialYutoGroups);
  const [venues] = useState<Venue[]>(initialVenues);
  const [friends, setFriends] = useState<Friend[]>(initialFriends);

  // Add a new Yuto group
  const addYutoGroup = (group: Omit<YutoGroup, 'id' | 'createdAt'>): YutoGroup => {
    const newGroup: YutoGroup = {
      ...group,
      id: `yuto-${Date.now()}`,
      createdAt: new Date(),
    };
    setYutoGroups(prev => [newGroup, ...prev]);
    return newGroup;
  };

  // Update an existing Yuto group
  const updateYutoGroup = (id: string, updates: Partial<YutoGroup>) => {
    setYutoGroups(prev => 
      prev.map(g => g.id === id ? { ...g, ...updates } : g)
    );
  };

  // Get a Yuto by ID
  const getYutoById = (id: string) => {
    return yutoGroups.find(g => g.id === id);
  };

  // Get a venue by ID
  const getVenueById = (id: number) => {
    return venues.find(v => v.id === id);
  };

  // Add a friend
  const addFriend = (friend: Omit<Friend, 'id'>) => {
    const newFriend: Friend = {
      ...friend,
      id: friends.length + 1,
    };
    setFriends(prev => [...prev, newFriend]);
  };

  const value: AppContextType = {
    user,
    yutoGroups,
    venues,
    friends,
    addYutoGroup,
    updateYutoGroup,
    getYutoById,
    getVenueById,
    addFriend,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// ===========================================
// HOOK
// ===========================================
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
