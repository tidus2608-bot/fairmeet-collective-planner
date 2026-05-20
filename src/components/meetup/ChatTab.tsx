import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MeetupRow, useSendChatMessage } from '@/hooks/useMeetups';
import MessageReactions from '@/components/meetup/MessageReactions';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  meetup: MeetupRow;
  userId: string;
}

export default function ChatTab({ meetup, userId }: Props) {
  const [message, setMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const sendMessage = useSendChatMessage();
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastTypingSent = useRef(0);

  const messages = meetup.chat_messages || [];
  const participants = meetup.participants || [];
  const participantMap = new Map(participants.map((p) => [p.user_id, p]));
  const displayName =
    participantMap.get(userId)?.user_name ||
    user?.user_metadata?.display_name ||
    user?.email?.split('@')[0] ||
    'User';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // One realtime channel: new messages, reaction changes, and typing broadcasts.
  useEffect(() => {
    const timers = typingTimers.current;
    const channel = supabase.channel(`chat-${meetup.id}`, { config: { broadcast: { self: false } } });
    channel
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `meetup_id=eq.${meetup.id}`,
      }, () => qc.invalidateQueries({ queryKey: ['meetup', meetup.id] }))
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'message_reactions', filter: `meetup_id=eq.${meetup.id}`,
      }, () => qc.invalidateQueries({ queryKey: ['meetup', meetup.id] }))
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const uid = payload?.userId as string;
        const name = payload?.name as string;
        if (!uid || uid === userId) return;
        setTypingUsers((prev) => ({ ...prev, [uid]: name }));
        clearTimeout(timers[uid]);
        timers[uid] = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[uid];
            return next;
          });
        }, 3000);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [meetup.id, qc, userId]);

  const broadcastTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current < 1500 || !channelRef.current) return;
    lastTypingSent.current = now;
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId, name: displayName } });
  };

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessage.mutate({ meetupId: meetup.id, content: message.trim() });
    setMessage('');
  };

  const typingNames = Object.values(typingUsers);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 220px)' }}>
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No messages yet. Say hello! 👋</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.user_id === userId;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-2xl px-4 py-2.5 ${isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'}`}>
                  {!isMe && <p className="text-xs font-medium mb-0.5 opacity-70">{participantMap.get(msg.user_id)?.user_name || msg.user_name}</p>}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="mt-0.5">
                  <MessageReactions
                    messageId={msg.id}
                    meetupId={meetup.id}
                    userId={userId}
                    reactions={msg.message_reactions || []}
                    align={isMe ? 'end' : 'start'}
                  />
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {typingNames.length > 0 && (
        <p className="text-xs text-muted-foreground px-1 pb-1">
          {typingNames.length === 1 ? `${typingNames[0]} is typing…` : `${typingNames.length} people are typing…`}
        </p>
      )}

      <div className="flex gap-2 pt-2 border-t">
        <Input
          value={message}
          onChange={(e) => { setMessage(e.target.value); broadcastTyping(); }}
          placeholder="Type a message..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1"
        />
        <Button size="icon" onClick={handleSend} disabled={!message.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
