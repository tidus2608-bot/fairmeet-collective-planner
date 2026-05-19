import { SmilePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MessageReactionRow, useToggleReaction } from '@/hooks/useMeetups';

const EMOJIS = ['👍', '❤️', '😂', '🎉', '👀', '🙏'];

interface Props {
  messageId: string;
  meetupId: string;
  userId: string;
  reactions: MessageReactionRow[];
  align: 'start' | 'end';
}

export default function MessageReactions({ messageId, meetupId, userId, reactions, align }: Props) {
  const toggle = useToggleReaction();

  const grouped = reactions.reduce<Record<string, MessageReactionRow[]>>((acc, r) => {
    (acc[r.emoji] ||= []).push(r);
    return acc;
  }, {});

  const handle = (emoji: string) => {
    const mine = reactions.some((r) => r.emoji === emoji && r.user_id === userId);
    toggle.mutate({ messageId, meetupId, emoji, active: mine });
  };

  return (
    <div className={`flex items-center gap-1 flex-wrap ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      {Object.entries(grouped).map(([emoji, rs]) => {
        const mine = rs.some((r) => r.user_id === userId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => handle(emoji)}
            className={`text-xs rounded-full border px-1.5 py-0.5 leading-none transition-colors ${mine ? 'bg-primary/10 border-primary/40' : 'bg-muted border-transparent hover:border-border'}`}
          >
            {emoji} {rs.length}
          </button>
        );
      })}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Add reaction">
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1.5" align={align}>
          <div className="flex gap-1">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => handle(e)} className="text-lg leading-none hover:scale-125 transition-transform">
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
