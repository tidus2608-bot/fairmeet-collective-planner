import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesInsert } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import type { UserPreferences } from './useUserPreferences';

export interface FinalVenue {
  name: string;
  address: string;
  location: { lat: number; lng: number };
}

export interface MeetupRow {
  id: string;
  name: string;
  organizer_id: string;
  status: string;
  invite_code: string;
  final_venue: FinalVenue | null;
  scheduled_at: string | null;
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
  max_travel_time: number | null;
  fairness_importance: number | null;
  venue_types: string[] | null;
  venue_prefs: UserPreferences | null;
}

export interface VenueOpeningHours {
  open_now?: boolean;
  weekday_text?: string[];
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
  photo_reference: string | null;
  price_level: number | null;
  website: string | null;
  phone: string | null;
  opening_hours: VenueOpeningHours | null;
  google_place_id: string | null;
  worst_minutes: number | null;
  added_by: string | null;
}

// Fields accepted when inserting a venue suggestion (anything not a DB column is dropped).
export type NewVenue = Partial<Omit<VenueRow, 'id' | 'meetup_id'>> & {
  name: string;
  category: string;
  address: string;
  location: { lat: number; lng: number };
};

export interface PollVoteRow {
  id: string;
  meetup_id: string;
  venue_id: string;
  user_id: string;
  vote_type: string;
}

export interface MessageReactionRow {
  id: string;
  message_id: string;
  meetup_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ChatMessageRow {
  id: string;
  meetup_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
  message_reactions?: MessageReactionRow[];
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

      const ids = parts.map((p) => p.meetup_id);
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
        .select('*, participants(*), venue_suggestions(*), poll_votes(*), chat_messages(*, message_reactions(*))')
        .eq('id', meetupId!)
        .single();
      if (error) throw error;
      // Sort chat messages
      if (data.chat_messages) {
        data.chat_messages.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      return data as unknown as MeetupRow;
    },
    enabled: !!meetupId && !!user,
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
        .update({ location: location as unknown as Json, address, status: 'location_set' })
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
    mutationFn: async ({ meetupId, venues, replace }: { meetupId: string; venues: NewVenue[]; replace?: boolean }) => {
      // Map each incoming venue to known DB columns only. The calculate-midpoint
      // edge function returns extra fields (id, place_id) that are not columns
      // and would otherwise make the insert fail.
      const rows: TablesInsert<'venue_suggestions'>[] = venues.map((v) => {
        const row: TablesInsert<'venue_suggestions'> = {
          meetup_id: meetupId,
          name: v.name,
          category: v.category,
          address: v.address,
          location: v.location,
        };
        if (v.rating !== undefined) row.rating = v.rating;
        if (v.travel_times !== undefined) row.travel_times = v.travel_times;
        if (v.ai_theme !== undefined) row.ai_theme = v.ai_theme;
        if (v.in_poll !== undefined) row.in_poll = v.in_poll;
        if (v.photo_reference !== undefined) row.photo_reference = v.photo_reference;
        if (v.price_level !== undefined) row.price_level = v.price_level;
        if (v.website !== undefined) row.website = v.website;
        if (v.phone !== undefined) row.phone = v.phone;
        if (v.opening_hours !== undefined) row.opening_hours = v.opening_hours as unknown as Json;
        if (v.google_place_id !== undefined) row.google_place_id = v.google_place_id;
        if (v.worst_minutes !== undefined) row.worst_minutes = v.worst_minutes;
        if (v.added_by !== undefined) row.added_by = v.added_by;
        return row;
      });
      if (replace) {
        const { error: delErr } = await supabase.from('venue_suggestions').delete().eq('meetup_id', meetupId);
        if (delErr) throw delErr;
      }
      const { error } = await supabase.from('venue_suggestions').insert(rows);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}

export function useDeleteVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueId }: { venueId: string; meetupId: string }) => {
      const { error } = await supabase.from('venue_suggestions').delete().eq('id', venueId);
      if (error) throw error;
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

export function useVoteVenue() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetupId, venueId, voteType, currentVoteType }: {
      meetupId: string;
      venueId: string;
      voteType: 'up' | 'down';
      currentVoteType?: string | null;
    }) => {
      // Toggle: if same vote_type already exists, delete it; otherwise upsert
      if (currentVoteType === voteType) {
        const { error } = await supabase
          .from('poll_votes')
          .delete()
          .eq('venue_id', venueId)
          .eq('user_id', user!.id)
          .eq('vote_type', voteType);
        if (error) throw error;
      } else {
        // Remove opposite vote if present, then insert new vote
        await supabase
          .from('poll_votes')
          .delete()
          .eq('venue_id', venueId)
          .eq('user_id', user!.id);
        const { error } = await supabase
          .from('poll_votes')
          .insert({ meetup_id: meetupId, venue_id: venueId, user_id: user!.id, vote_type: voteType });
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}

export function useUpdatePreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetupId, maxTravelTime, fairnessImportance }: {
      meetupId: string;
      maxTravelTime: number | null;
      fairnessImportance: number;
    }) => {
      const { error } = await supabase
        .from('participants')
        .update({ max_travel_time: maxTravelTime, fairness_importance: fairnessImportance })
        .eq('meetup_id', meetupId)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}

export function useUpdateVenuePrefs() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetupId, venuePrefs }: { meetupId: string; venuePrefs: UserPreferences }) => {
      const { error } = await supabase
        .from('participants')
        .update({ venue_prefs: venuePrefs as unknown as Json })
        .eq('meetup_id', meetupId)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}

export function useConfirmVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetupId, venue }: { meetupId: string; venue: FinalVenue }) => {
      const { error } = await supabase
        .from('meetups')
        .update({ status: 'Confirmed', final_venue: venue as unknown as Json })
        .eq('id', meetupId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}

export function useUpdateMeetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetupId, name, scheduledAt }: { meetupId: string; name?: string; scheduledAt?: string | null }) => {
      const patch: { name?: string; scheduled_at?: string | null } = {};
      if (name !== undefined) patch.name = name;
      if (scheduledAt !== undefined) patch.scheduled_at = scheduledAt;
      const { error } = await supabase.from('meetups').update(patch).eq('id', meetupId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] });
      qc.invalidateQueries({ queryKey: ['meetups'] });
    },
  });
}

export function useJoinMeetup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, name }: { code: string; name?: string }) => {
      // Prefer the explicitly supplied name (a guest who just signed in
      // anonymously may not have a refreshed auth context yet); otherwise
      // derive it from the current session.
      const finalName =
        name?.trim() || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Guest';
      const { data, error } = await supabase.rpc('join_meetup_by_code', { _code: code, _name: finalName });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetups'] }),
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
    mutationFn: async ({ meetupId, content, userName }: { meetupId: string; content: string; userName?: string }) => {
      const displayName = userName || user!.user_metadata?.display_name || user!.email?.split('@')[0] || 'User';
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

export function useToggleReaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, meetupId, emoji, active }: { messageId: string; meetupId: string; emoji: string; active: boolean }) => {
      if (active) {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user!.id)
          .eq('emoji', emoji);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('message_reactions')
          .insert({ message_id: messageId, meetup_id: meetupId, user_id: user!.id, emoji });
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meetup', v.meetupId] }),
  });
}
