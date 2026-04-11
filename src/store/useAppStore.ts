import { create } from 'zustand';
import { Meetup, User, VenueSuggestion, PollVote, ChatMessage, Participant, TransportMode } from '@/types/meetup';

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

interface AppState {
  user: User | null;
  meetups: Meetup[];
  currentMeetupId: string | null;

  setUser: (user: User | null) => void;
  createMeetup: (name: string) => string;
  deleteMeetup: (id: string) => void;
  leaveMeetup: (meetupId: string) => void;
  setCurrentMeetup: (id: string | null) => void;
  getCurrentMeetup: () => Meetup | undefined;

  updateParticipantLocation: (meetupId: string, userId: string, location: { lat: number; lng: number }, address: string) => void;
  updateParticipantTransport: (meetupId: string, userId: string, mode: TransportMode) => void;

  addVenueSuggestions: (meetupId: string, venues: VenueSuggestion[]) => void;
  setVenueAiTheme: (meetupId: string, venueId: string, theme: string) => void;
  addVenueToPoll: (meetupId: string, venueId: string) => void;
  removeVenueFromPoll: (meetupId: string, venueId: string) => void;

  castVote: (meetupId: string, venueId: string) => void;
  confirmVenue: (meetupId: string, venueId: string) => void;
  setMeetupStatus: (meetupId: string, status: 'Planning' | 'Voting' | 'Confirmed') => void;

  addChatMessage: (meetupId: string, content: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  meetups: [],
  currentMeetupId: null,

  setUser: (user) => set({ user }),

  createMeetup: (name) => {
    const user = get().user;
    if (!user) return '';
    const id = generateId();
    const meetup: Meetup = {
      id,
      name,
      organizerId: user.id,
      status: 'Planning',
      participants: [{
        id: generateId(),
        userId: user.id,
        userName: user.name,
        avatarUrl: user.avatarUrl,
        transportMode: 'driving',
        status: 'awaiting',
      }],
      venueSuggestions: [],
      pollVenues: [],
      pollVotes: [],
      chatMessages: [],
      inviteCode: generateInviteCode(),
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ meetups: [...s.meetups, meetup] }));
    return id;
  },

  deleteMeetup: (id) => set((s) => ({ meetups: s.meetups.filter((m) => m.id !== id), currentMeetupId: s.currentMeetupId === id ? null : s.currentMeetupId })),

  leaveMeetup: (meetupId) => {
    const user = get().user;
    if (!user) return;
    set((s) => ({
      meetups: s.meetups.map((m) =>
        m.id === meetupId ? { ...m, participants: m.participants.filter((p) => p.userId !== user.id) } : m
      ),
    }));
  },

  setCurrentMeetup: (id) => set({ currentMeetupId: id }),
  getCurrentMeetup: () => {
    const s = get();
    return s.meetups.find((m) => m.id === s.currentMeetupId);
  },

  updateParticipantLocation: (meetupId, userId, location, address) =>
    set((s) => ({
      meetups: s.meetups.map((m) =>
        m.id === meetupId
          ? {
              ...m,
              participants: m.participants.map((p) =>
                p.userId === userId ? { ...p, location, address, status: 'location_set' as const } : p
              ),
            }
          : m
      ),
    })),

  updateParticipantTransport: (meetupId, userId, mode) =>
    set((s) => ({
      meetups: s.meetups.map((m) =>
        m.id === meetupId
          ? { ...m, participants: m.participants.map((p) => (p.userId === userId ? { ...p, transportMode: mode } : p)) }
          : m
      ),
    })),

  addVenueSuggestions: (meetupId, venues) =>
    set((s) => ({
      meetups: s.meetups.map((m) =>
        m.id === meetupId ? { ...m, venueSuggestions: [...m.venueSuggestions, ...venues] } : m
      ),
    })),

  setVenueAiTheme: (meetupId, venueId, theme) =>
    set((s) => ({
      meetups: s.meetups.map((m) =>
        m.id === meetupId
          ? { ...m, venueSuggestions: m.venueSuggestions.map((v) => (v.id === venueId ? { ...v, aiTheme: theme } : v)) }
          : m
      ),
    })),

  addVenueToPoll: (meetupId, venueId) =>
    set((s) => ({
      meetups: s.meetups.map((m) =>
        m.id === meetupId && !m.pollVenues.includes(venueId)
          ? { ...m, pollVenues: [...m.pollVenues, venueId] }
          : m
      ),
    })),

  removeVenueFromPoll: (meetupId, venueId) =>
    set((s) => ({
      meetups: s.meetups.map((m) =>
        m.id === meetupId ? { ...m, pollVenues: m.pollVenues.filter((id) => id !== venueId) } : m
      ),
    })),

  castVote: (meetupId, venueId) => {
    const user = get().user;
    if (!user) return;
    set((s) => ({
      meetups: s.meetups.map((m) => {
        if (m.id !== meetupId) return m;
        const existing = m.pollVotes.filter((v) => v.userId !== user.id);
        return { ...m, pollVotes: [...existing, { venueId, userId: user.id }] };
      }),
    }));
  },

  confirmVenue: (meetupId, venueId) =>
    set((s) => ({
      meetups: s.meetups.map((m) => {
        if (m.id !== meetupId) return m;
        const venue = m.venueSuggestions.find((v) => v.id === venueId);
        return { ...m, status: 'Confirmed', finalVenue: venue };
      }),
    })),

  setMeetupStatus: (meetupId, status) =>
    set((s) => ({
      meetups: s.meetups.map((m) => (m.id === meetupId ? { ...m, status } : m)),
    })),

  addChatMessage: (meetupId, content) => {
    const user = get().user;
    if (!user) return;
    const msg: ChatMessage = {
      id: generateId(),
      userId: user.id,
      userName: user.name,
      content,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      meetups: s.meetups.map((m) =>
        m.id === meetupId ? { ...m, chatMessages: [...m.chatMessages, msg] } : m
      ),
    }));
  },
}));
