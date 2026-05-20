import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Keep the meetup detail view live for every participant: venue searches,
// joins, votes, and status/schedule changes refetch in place instead of
// requiring a manual reload. Chat has its own channel in ChatTab.
export function useMeetupRealtime(meetupId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!meetupId) return;
    const invalidate = () => qc.invalidateQueries({ queryKey: ['meetup', meetupId] });
    const channel = supabase
      .channel(`meetup-sync-${meetupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venue_suggestions', filter: `meetup_id=eq.${meetupId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `meetup_id=eq.${meetupId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes', filter: `meetup_id=eq.${meetupId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetups', filter: `id=eq.${meetupId}` }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetupId, qc]);
}
