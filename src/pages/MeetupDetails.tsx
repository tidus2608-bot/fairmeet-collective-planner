import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useMeetupDetail } from '@/hooks/useMeetups';
import { useMeetupRealtime } from '@/hooks/useMeetupRealtime';
import { useChatNotifications } from '@/hooks/useChatNotifications';
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
  const storageKey = id ? `fairmeet-lastread-${id}` : null;
  const [lastSeenCount, setLastSeenCount] = useState<number | null>(() => {
    if (!id) return null;
    const stored = localStorage.getItem(`fairmeet-lastread-${id}`);
    return stored !== null ? parseInt(stored, 10) : null;
  });

  const msgCount = meetup?.chat_messages?.length ?? 0;

  // On first load, initialise last-seen to current count so old messages don't badge.
  useEffect(() => {
    if (isLoading || lastSeenCount !== null || !storageKey) return;
    setLastSeenCount(msgCount);
    localStorage.setItem(storageKey, String(msgCount));
  }, [isLoading, msgCount, lastSeenCount, storageKey]);

  // While on Chat tab, keep last-seen up to date as new messages arrive.
  useEffect(() => {
    if (activeTab !== 'chat' || !storageKey) return;
    setLastSeenCount(msgCount);
    localStorage.setItem(storageKey, String(msgCount));
  }, [activeTab, msgCount, storageKey]);

  const unreadCount =
    lastSeenCount !== null && activeTab !== 'chat'
      ? Math.max(0, msgCount - lastSeenCount)
      : 0;

  const { supported: notifSupported, permission, requestPermission } =
    useChatNotifications(meetup, user?.id, activeTab);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const showNotifPrompt = notifSupported && permission === 'default' && !notifDismissed;

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (!meetup || !user) {
    navigate('/dashboard');
    return null;
  }

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
        {showNotifPrompt && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <Bell className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">Get notified about new chat messages?</span>
            <Button size="sm" className="h-7" onClick={requestPermission}>
              Enable
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => setNotifDismissed(true)}
            >
              Not now
            </Button>
          </div>
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 mx-4 mt-3" style={{ width: 'calc(100% - 2rem)' }}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="venues">Venues</TabsTrigger>
            <TabsTrigger value="vote">Vote</TabsTrigger>
            <TabsTrigger value="chat">
              Chat
              {unreadCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 inline-flex items-center justify-center px-1 leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
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
