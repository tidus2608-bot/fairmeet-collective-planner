import { useState, useRef, useEffect } from 'react';
import { Send, AlertCircle, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MeetupRow, useSendChatMessage } from '@/hooks/useMeetups';
import MessageReactions from '@/components/meetup/MessageReactions';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const MAX_LEN = 2000;

interface Props {
  meetup: MeetupRow;
  userId: string;
}

interface PendingMessage {
  tempId: string;
  content: string;
  status: 'sending' | 'failed';
  created_at: string;
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export default function ChatTab({ meetup, userId }: Props) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<PendingMessage[]>([]);
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
  const displayName = participantMap.get(userId)?.user_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, pending.length]);

  // Realtime: new messages, reaction changes, and typing indicators on one channel.
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

  const doSend = (content: string, tempId: string) => {
    setPending((p) => p.map((m) => (m.tempId === tempId ? { ...m, status: 'sending' } : m)));
    sendMessage.mutate(
      { meetupId: meetup.id, content, userName: displayName },
      {
        onSuccess: () => setPending((p) => p.filter((m) => m.tempId !== tempId)),
        onError: () => {
          setPending((p) => p.map((m) => (m.tempId === tempId ? { ...m, status: 'failed' } : m)));
          toast.error('Message failed to send — tap retry');
        },
      },
    );
  };

  const handleSend = () => {
    const content = message.trim();
    if (!content) return;
    if (content.length > MAX_LEN) {
      toast.error(`Messages are limited to ${MAX_LEN} characters`);
      return;
    }
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPending((p) => [...p, { tempId, content, status: 'sending', created_at: new Date().toISOString() }]);
    setMessage('');
    doSend(content, tempId);
  };

  const typingNames = Object.values(typingUsers);
  const overLimit = message.length > MAX_LEN;

  // Unified, time-ordered render list of confirmed + pending messages.
  type Item =
    | { kind: 'real'; id: string; authorId: string; authorName: string; content: string; createdAt: string; reactions: typeof messages[number]['message_reactions'] }
    | { kind: 'pending'; id: string; authorId: string; authorName: string; content: string; createdAt: string; status: PendingMessage['status'] };

  const items: Item[] = [
    ...messages.map((m) => ({
      kind: 'real' as const,
      id: m.id,
      authorId: m.user_id,
      authorName: participantMap.get(m.user_id)?.user_name || m.user_name,
      content: m.content,
      createdAt: m.created_at,
      reactions: m.message_reactions,
    })),
    ...pending.map((p) => ({
      kind: 'pending' as const,
      id: p.tempId,
      authorId: userId,
      authorName: displayName,
      content: p.content,
      createdAt: p.created_at,
      status: p.status,
    })),
  ];

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
      <div className="flex-1 overflow-y-auto space-y-1 pb-4">
        {items.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No messages yet. Say hello! 👋</p>
          </div>
        )}
        {items.map((item, i) => {
          const prev = items[i - 1];
          const date = new Date(item.createdAt);
          const showDay = !prev || !sameDay(new Date(prev.createdAt), date);
          const startGroup = showDay || !prev || prev.authorId !== item.authorId;
          const isMe = item.authorId === userId;
          const participant = participantMap.get(item.authorId);
          const failed = item.kind === 'pending' && item.status === 'failed';
          const sending = item.kind === 'pending' && item.status === 'sending';

          return (
            <div key={item.id}>
              {showDay && (
                <div className="flex items-center justify-center my-3">
                  <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">
                    {dayLabel(date)}
                  </span>
                </div>
              )}
              <div className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'} ${startGroup ? 'mt-2' : 'mt-0.5'}`}>
                {!isMe && (
                  <div className="w-7 shrink-0">
                    {startGroup && (
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={participant?.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">{initials(item.authorName)}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}
                <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 ${
                      isMe
                        ? `bg-primary text-primary-foreground rounded-br-md ${sending ? 'opacity-70' : ''} ${failed ? 'ring-1 ring-destructive' : ''}`
                        : 'bg-muted rounded-bl-md'
                    }`}
                  >
                    {!isMe && startGroup && (
                      <p className="text-xs font-medium mb-0.5 opacity-70">{item.authorName}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{item.content}</p>
                    <p className={`text-[10px] mt-1 flex items-center gap-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {sending ? 'Sending…' : timeLabel(item.createdAt)}
                      {failed && <AlertCircle className="w-3 h-3 text-destructive" />}
                    </p>
                  </div>
                  {failed && item.kind === 'pending' && (
                    <div className="flex gap-2 mt-0.5">
                      <button type="button" onClick={() => doSend(item.content, item.id)} className="text-[11px] text-primary flex items-center gap-0.5 hover:underline">
                        <RotateCw className="w-3 h-3" /> Retry
                      </button>
                      <button type="button" onClick={() => setPending((p) => p.filter((m) => m.tempId !== item.id))} className="text-[11px] text-muted-foreground flex items-center gap-0.5 hover:underline">
                        <X className="w-3 h-3" /> Discard
                      </button>
                    </div>
                  )}
                  {item.kind === 'real' && (
                    <div className="mt-0.5">
                      <MessageReactions
                        messageId={item.id}
                        meetupId={meetup.id}
                        userId={userId}
                        reactions={item.reactions || []}
                        align={isMe ? 'end' : 'start'}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {typingNames.length > 0 && (
        <p className="text-xs text-muted-foreground px-1 pb-1">
          {typingNames.length === 1
            ? `${typingNames[0]} is typing…`
            : `${typingNames.length} people are typing…`}
        </p>
      )}

      <div className="pt-2 border-t">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => { setMessage(e.target.value); broadcastTyping(); }}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1"
            aria-invalid={overLimit}
          />
          <Button size="icon" onClick={handleSend} disabled={!message.trim() || overLimit}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {message.length > MAX_LEN - 200 && (
          <p className={`text-[11px] mt-1 text-right ${overLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
            {message.length}/{MAX_LEN}
          </p>
        )}
      </div>
    </div>
  );
}
