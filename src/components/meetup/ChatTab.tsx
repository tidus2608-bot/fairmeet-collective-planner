import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MeetupRow, useSendChatMessage } from '@/hooks/useMeetups';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  meetup: MeetupRow;
  userId: string;
}

export default function ChatTab({ meetup, userId }: Props) {
  const [message, setMessage] = useState('');
  const sendMessage = useSendChatMessage();
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const messages = meetup.chat_messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Realtime subscription for new chat messages
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${meetup.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `meetup_id=eq.${meetup.id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['meetup', meetup.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [meetup.id, qc]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessage.mutate({ meetupId: meetup.id, content: message.trim() });
    setMessage('');
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
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
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'}`}>
                {!isMe && <p className="text-xs font-medium mb-0.5 opacity-70">{msg.user_name}</p>}
                <p className="text-sm">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 pt-2 border-t">
        <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => e.key === 'Enter' && handleSend()} className="flex-1" />
        <Button size="icon" onClick={handleSend} disabled={!message.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
