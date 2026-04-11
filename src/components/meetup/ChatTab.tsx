import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/useAppStore';
import { Meetup } from '@/types/meetup';

interface Props {
  meetup: Meetup;
  userId: string;
}

export default function ChatTab({ meetup, userId }: Props) {
  const [message, setMessage] = useState('');
  const addChatMessage = useAppStore((s) => s.addChatMessage);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [meetup.chatMessages.length]);

  const handleSend = () => {
    if (!message.trim()) return;
    addChatMessage(meetup.id, message.trim());
    setMessage('');
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {meetup.chatMessages.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No messages yet. Say hello! 👋</p>
          </div>
        )}
        {meetup.chatMessages.map((msg) => {
          const isMe = msg.userId === userId;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'}`}>
                {!isMe && <p className="text-xs font-medium mb-0.5 opacity-70">{msg.userName}</p>}
                <p className="text-sm">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
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
