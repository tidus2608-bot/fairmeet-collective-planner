import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface MeetupRow {
  id: string;
  name: string;
  organizer_id: string;
  status: string;
  invite_code: string;
  final_venue: any;
  created_at: string;
  participants: ParticipantRow[];
  venue_suggestions: VenueRow[];
  poll_votes: PollVoteRow[];
  chat_messages: ChatMessageRow[];
}

export interface ParticipantRow {
  id: string;
  meetup_id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  location: { lat: number; lng: number } | null;
  address: string | null;
  transport_mode: string;
  status: string;
}

export interface VenueRow {
  id: string;
  meetup_id: string;
  name: string;
  category: string;
  rating: number;
  address: string;
  location: { lat: number; lng: number };
  travel_times: Record<string, number> | null;
  ai_theme: string | null;
  in_poll: boolean;
}

export interface PollVoteRow {
  id: string;
  meetup_id: string;
  venue_id: string;
  user_id: string;
}

export interface ChatMessageRow {
  id: string;
  meetup_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

// Fetch all meetups for current user (where they are a participant)
export function useMeetupsList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['meetups', user?.id],
    queryFn: async () => {
      // Get meetup IDs where user is participant
      const { data: parts, error: pErr } = await supabase
        .from('participants')
        .select('meetup_id')
        .eq('user_id', user!.id);
      if (pErr) throw pErr;
      if (!parts?.length) return [];

      const ids = parts.map((p: any) => p.meetup_id);
      const { data, error } = await supabase
        .from('meetups')
        .select('*, participants(*), venue_suggestions(*), poll_votes(*)')
        .in('id', ids)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MeetupRow[];
    },
    enabled: !!user,
  });
}

// Fetch single meetup with all relations
export function useMeetupDetail(meetupId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['meetup', meetupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetups')
        .select('*, participants(*), venue_suggestions(*), poll_votes(*), chat_messages(*)')
        .eq('id', meetupId!)
        .single();
      if (error) throw error;
      // Sort chat messages
      if (data.chat_messages) {
        (data.chat_messages as any[]).sort((a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      return data as unknown as MeetupRow;
    },
    enabled: !!meetupId && !!user,
    // Poll so new participants joining from another device are reflected
    // automatically and trigger the venue-search effect.
    refetchInterval: 15_000,
  });
}

export function useCreateMeetup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const displayName = user!.user_metadata?.display_name || user!.email?.split('@')[0] || 'User';
      // Create meetup
      const { data: meetup, error: mErr } = await supabase
        .from('meetups')
        .insert({ name, organizer_id: user!.id })
        .select()
        .single();
      if (mErr) throw mErr;
      // Add creator as participant
      const { error: pErr } = await supabase
        .from('participants')
        .insert({
          meetup_id: meetup.id,
          user_id: user!.id,
          user_name: displayName,
        });
      if (pErr) throw pErr;
      return meetup;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetups'] }),
  });
}

export function useDeleteMeetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meetupId: string) => {
      const { error } = await supabase.from('meetups').delete().eq('id', meetupId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetups'] }),
  });
}

export function useLeaveMeetup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meetupId: string) => {
      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('meetup_id', meetupId)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetups'] }),
  });
}

export function useUpdateParticipantLocation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetupId, location, address }: { meetupId: string; location: { lat: number; lng: number }; address: string }) => {
      const { error } = await supabase
        .from('participants')
        .update({ location: location as any, address, status: 'location_set' })
        .eq('meetup_id', meetupId)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}

export function useUpdateTransportMode() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetupId, mode }: { meetupId: string; mode: string }) => {
      const { error } = await supabase
        .from('participants')
        .update({ transport_mode: mode })
        .eq('meetup_id', meetupId)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}

export function useAddVenues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetupId, venues }: { meetupId: string; venues: Omit<VenueRow, 'id' | 'meetup_id'>[] }) => {
      const rows = venues.map((v) => ({ ...v, meetup_id: meetupId, location: v.location as any }));
      const { error } = await supabase.from('venue_suggestions').insert(rows);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}

/** Delete all existing venue suggestions for a meetup, then insert fresh ones.
 *  Used when re-running the search after new participants join. */
export function useReplaceVenues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetupId, venues }: { meetupId: string; venues: Omit<VenueRow, 'id' | 'meetup_id'>[] }) => {
      const { error: delErr } = await supabase
        .from('venue_suggestions')
        .delete()
        .eq('meetup_id', meetupId);
      if (delErr) throw delErr;
      if (venues.length === 0) return;
      const rows = venues.map((v) => ({ ...v, meetup_id: meetupId, location: v.location as any }));
      const { error } = await supabase.from('venue_suggestions').insert(rows);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}

export function useSetVenueAiTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueId, theme, meetupId }: { venueId: string; theme: string; meetupId: string }) => {
      const { error } = await supabase.from('venue_suggestions').update({ ai_theme: theme }).eq('id', venueId);
      if (error) throw error;
      return meetupId;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}

export function useToggleVenuePoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueId, inPoll, meetupId }: { venueId: string; inPoll: boolean; meetupId: string }) => {
      const { error } = await supabase.from('venue_suggestions').update({ in_poll: inPoll }).eq('id', venueId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}

export function useCastVote() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetupId, venueId }: { meetupId: string; venueId: string }) => {
      // Delete existing vote then insert new one
      await supabase.from('poll_votes').delete().eq('meetup_id', meetupId).eq('user_id', user!.id);
      const { error } = await supabase
        .from('poll_votes')
        .insert({ meetup_id: meetupId, venue_id: venueId, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}

export function useConfirmVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetupId, venue }: { meetupId: string; venue: any }) => {
      const { error } = await supabase
        .from('meetups')
        .update({ status: 'Confirmed', final_venue: venue })
        .eq('id', meetupId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}

export function useSetMeetupStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetupId, status }: { meetupId: string; status: string }) => {
      const { error } = await supabase.from('meetups').update({ status }).eq('id', meetupId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}

export function useSendChatMessage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetupId, content }: { meetupId: string; content: string }) => {
      const displayName = user!.user_metadata?.display_name || user!.email?.split('@')[0] || 'User';
      const { error } = await supabase.from('chat_messages').insert({
        meetup_id: meetupId,
        user_id: user!.id,
        user_name: displayName,
        content,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}
