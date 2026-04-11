export type MeetupStatus = 'Planning' | 'Voting' | 'Confirmed';
export type TransportMode = 'driving' | 'walking' | 'cycling' | 'transit';
export type VenueCategory = 'Food' | 'Drinks' | 'Coffee' | 'Park';

export interface Participant {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  location?: { lat: number; lng: number };
  address?: string;
  transportMode: TransportMode;
  status: 'awaiting' | 'location_set';
}

export interface VenueSuggestion {
  id: string;
  name: string;
  category: VenueCategory;
  rating: number;
  address: string;
  location: { lat: number; lng: number };
  travelTimes?: Record<string, number>; // userId -> minutes
  aiTheme?: string;
  inPoll?: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface PollVote {
  venueId: string;
  userId: string;
}

export interface Meetup {
  id: string;
  name: string;
  organizerId: string;
  status: MeetupStatus;
  participants: Participant[];
  venueSuggestions: VenueSuggestion[];
  pollVenues: string[]; // venue IDs in poll
  pollVotes: PollVote[];
  finalVenue?: VenueSuggestion;
  chatMessages: ChatMessage[];
  inviteCode: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}
