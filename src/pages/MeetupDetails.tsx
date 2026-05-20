import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useMeetupDetail } from '@/hooks/useMeetups';
import { useMeetupRealtime } from '@/hooks/useMeetupRealtime';
import OverviewTab from '@/components/meetup/OverviewTab';
import VenuesTab from '@/components/meetup/VenuesTab';
import VoteTab from '@/components/meetup/VoteTab';
import ChatTab from '@/components/meetup/ChatTab';

export default function MeetupDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: meetup, isLoading } = useMeetupDetail(id);
  useMeetupRealtime(id);

  const [activeTab, setActiveTab] = useState('overview');
  const [chatLastRead, setChatLastRead] = useState<string>(
    () => localStorage.getItem(`chat-read-${id}`) || '1970-01-01T00:00:00Z',
  );

  const chatMessages = useMemo(() => meetup?.chat_messages || [], [meetup]);

  // When the Chat tab is open, mark the latest message as read.
  useEffect(() => {
    if (activeTab !== 'chat') return;
    const latest = chatMessages[chatMessages.length - 1]?.created_at;
    if (latest && latest !== chatLastRead) {
      setChatLastRead(latest);
      localStorage.setItem(`chat-read-${id}`, latest);
    }
  }, [activeTab, chatMessages, chatLastRead, id]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (!meetup || !user) {
    navigate('/dashboard');
    return null;
  }

  const unreadChat = chatMessages.filter(
    (m) => m.user_id !== user.id && new Date(m.created_at) > new Date(chatLastRead),
  ).length;

  const statusColor = (status: string) => {
    if (status === 'Planning') return 'bg-blue-100 text-blue-700';
    if (status === 'Voting') return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">{meetup.name}</h1>
          </div>
          <Badge variant="secondary" className={statusColor(meetup.status)}>{meetup.status}</Badge>
        </div>
      </header>

      <div className="max-w-lg mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 mx-4 mt-3" style={{ width: 'calc(100% - 2rem)' }}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="venues">Venues</TabsTrigger>
            <TabsTrigger value="vote">Vote</TabsTrigger>
            <TabsTrigger value="chat" className="relative">
              Chat
              {unreadChat > 0 && (
                <span className="absolute -top-1.5 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
                  {unreadChat > 9 ? '9+' : unreadChat}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="p-4">
            <OverviewTab meetup={meetup} userId={user.id} />
          </TabsContent>
          <TabsContent value="venues" className="p-4">
            <VenuesTab meetup={meetup} userId={user.id} />
          </TabsContent>
          <TabsContent value="vote" className="p-4">
            <VoteTab meetup={meetup} userId={user.id} />
          </TabsContent>
          <TabsContent value="chat" className="p-4">
            <ChatTab meetup={meetup} userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
