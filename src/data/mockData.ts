// ===========================================
// MOCK DATA - Replace with API calls later
// ===========================================

export interface User {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
}

export interface Venue {
  id: number;
  name: string;
  location: string;
  category: 'Bowling' | 'Arcade' | 'Movie' | 'Restaurant' | 'Picnic' | 'Other';
  price: number; // Price in KSH
  description: string;
  hours: string;
  coordinates?: { lat: number; lng: number };
}

export interface YutoGroup {
  id: string;
  name: string;
  venue: Venue;
  members: GroupMember[];
  status: 'active' | 'completed' | 'pending';
  createdAt: Date;
  isFareShare?: boolean;
}

export interface GroupMember {
  id: string;
  name: string;
  initial: string;
  paid: boolean;
  amount: number;
}

export interface Friend {
  id: number;
  name: string;
  initial: string;
  phone?: string;
}

// ===========================================
// MOCK USER
// ===========================================
export const currentUser: User = {
  id: 'user-1',
  name: 'Alex',
  phone: '+254 712 345 678',
};

// ===========================================
// MOCK VENUES
// ===========================================
export const venues: Venue[] = [
  {
    id: 1,
    name: "Strikez Bowling",
    location: "Westlands, Nairobi",
    category: "Bowling",
    price: 500,
    description: "Nairobi's premier bowling alley with 12 lanes, great music, and a fully stocked bar. Perfect for group hangouts!",
    hours: "Mon-Sun: 10AM - 11PM",
    coordinates: { lat: -1.2673, lng: 36.8112 },
  },
  {
    id: 2,
    name: "Century Cinemax",
    location: "Garden City Mall, Nairobi",
    category: "Movie",
    price: 800,
    description: "State-of-the-art cinema with IMAX screens, Dolby sound, and comfy recliners. Catch the latest blockbusters here.",
    hours: "Mon-Sun: 9AM - 12AM",
    coordinates: { lat: -1.2295, lng: 36.8795 },
  },
  {
    id: 3,
    name: "Big Knife",
    location: "Kilimani, Nairobi",
    category: "Restaurant",
    price: 1200,
    description: "Upscale steakhouse known for their signature cuts and vibrant atmosphere. Great for celebrations!",
    hours: "Mon-Sat: 12PM - 11PM",
    coordinates: { lat: -1.2897, lng: 36.7850 },
  },
  {
    id: 4,
    name: "Game Zone Arcade",
    location: "Sarit Centre, Nairobi",
    category: "Arcade",
    price: 300,
    description: "Retro games and new favorites. Tokens included in entry fee.",
    hours: "Mon-Sun: 10AM - 9PM",
  },
  {
    id: 5,
    name: "Uhuru Gardens Picnic",
    location: "Uhuru Gardens, Nairobi",
    category: "Picnic",
    price: 200,
    description: "Beautiful outdoor space perfect for group picnics. Bring your own snacks!",
    hours: "Daily: 6AM - 6PM",
  },
];

// ===========================================
// MOCK YUTO GROUPS
// ===========================================
export const yutoGroups: YutoGroup[] = [
  {
    id: 'yuto-1',
    name: "Saturday Squad",
    venue: venues[0], // Bowling
    members: [
      { id: 'user-1', name: 'You', initial: 'Y', paid: true, amount: 500 },
      { id: 'user-2', name: 'Jack', initial: 'J', paid: true, amount: 500 },
      { id: 'user-3', name: 'Sarah', initial: 'S', paid: false, amount: 500 },
      { id: 'user-4', name: 'Mike', initial: 'M', paid: false, amount: 500 },
    ],
    status: 'active',
    createdAt: new Date('2026-02-10'),
  },
  {
    id: 'yuto-2',
    name: "Movie Night",
    venue: venues[1], // Movie
    members: [
      { id: 'user-1', name: 'You', initial: 'Y', paid: true, amount: 800 },
      { id: 'user-5', name: 'Jane', initial: 'Ja', paid: true, amount: 800 },
      { id: 'user-6', name: 'Alex', initial: 'A', paid: true, amount: 800 },
    ],
    status: 'completed',
    createdAt: new Date('2026-02-05'),
  },
  {
    id: 'yuto-3',
    name: "Arcade Gang",
    venue: venues[3], // Arcade
    members: [
      { id: 'user-1', name: 'You', initial: 'Y', paid: true, amount: 300 },
      { id: 'user-2', name: 'Jack', initial: 'J', paid: true, amount: 300 },
      { id: 'user-3', name: 'Sarah', initial: 'S', paid: true, amount: 300 },
      { id: 'user-4', name: 'Mike', initial: 'M', paid: true, amount: 300 },
      { id: 'user-5', name: 'Jane', initial: 'Ja', paid: true, amount: 300 },
    ],
    status: 'completed',
    createdAt: new Date('2026-01-28'),
  },
];

// ===========================================
// MOCK FRIENDS
// ===========================================
export const friends: Friend[] = [
  { id: 1, name: "Jack", initial: "J", phone: "+254 722 111 111" },
  { id: 2, name: "Jane", initial: "Ja", phone: "+254 722 222 222" },
  { id: 3, name: "Mike", initial: "M", phone: "+254 722 333 333" },
  { id: 4, name: "Sarah", initial: "S", phone: "+254 722 444 444" },
  { id: 5, name: "Alex", initial: "A", phone: "+254 722 555 555" },
];

// ===========================================
// HELPER FUNCTIONS
// ===========================================
export const getCategoryIcon = (category: Venue['category']): string => {
  const icons: Record<Venue['category'], string> = {
    Bowling: '🎳',
    Arcade: '🕹️',
    Movie: '🎬',
    Restaurant: '🍽️',
    Picnic: '🧺',
    Other: '📍',
  };
  return icons[category] || '📍';
};

export const getUserStats = () => {
  const completedYutos = yutoGroups.filter(y => y.status === 'completed');
  const totalSpent = completedYutos.reduce((sum, y) => {
    const userMember = y.members.find(m => m.id === 'user-1');
    return sum + (userMember?.amount || 0);
  }, 0);
  
  return {
    totalYutos: yutoGroups.length,
    completedYutos: completedYutos.length,
    totalSpent,
    friendsCount: friends.length,
  };
};
