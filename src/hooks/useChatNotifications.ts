import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MeetupRow } from '@/hooks/useMeetups';

const supported = typeof window !== 'undefined' && 'Notification' in window;

/** Show OS/browser notifications for incoming chat messages while the user is
 *  not actively reading the chat. Uses the existing Supabase Realtime stream —
 *  notifications fire whenever the app is open (any tab), including an installed
 *  PWA running in the background. Falls back gracefully where unsupported. */
export function useChatNotifications(
  meetup: MeetupRow | undefined,
  userId: string | undefined,
  activeTab: string,
) {
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied',
  );

  // Keep mutable values in refs so the realtime callback always sees current state.
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const participantsRef = useRef(meetup?.participants ?? []);
  participantsRef.current = meetup?.participants ?? [];

  useEffect(() => {
    if (supported && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const requestPermission = async () => {
    if (!supported) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  useEffect(() => {
    if (!supported || !meetup?.id || !userId) return;
    const meetupId = meetup.id;
    const meetupName = meetup.name;

    const channel = supabase
      .channel(`chat-notify-${meetupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `meetup_id=eq.${meetupId}` },
        (payload) => {
          const msg = payload.new as { user_id: string; user_name: string; content: string };
          if (msg.user_id === userId) return; // don't notify on own messages
          if (Notification.permission !== 'granted') return;
          // Skip if the user is already looking at the chat.
          if (activeTabRef.current === 'chat' && document.visibilityState === 'visible') return;

          const p = participantsRef.current.find((x) => x.user_id === msg.user_id);
          const name = p?.user_name || msg.user_name || 'Someone';
          const title = `${name} · ${meetupName}`;
          const options: NotificationOptions & { tag?: string } = {
            body: msg.content,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `chat-${meetupId}`,
            data: { url: `/meetup/${meetupId}` },
          };

          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready
              .then((reg) => reg.showNotification(title, options))
              .catch(() => {
                try {
                  new Notification(title, options);
                } catch {
                  /* notifications unavailable in this context */
                }
              });
          } else {
            try {
              new Notification(title, options);
            } catch {
              /* notifications unavailable in this context */
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetup?.id, meetup?.name, userId]);

  return { supported, permission, requestPermission };
}
