import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/store/useAppStore';
import OverviewTab from '@/components/meetup/OverviewTab';
import VenuesTab from '@/components/meetup/VenuesTab';
import VoteTab from '@/components/meetup/VoteTab';
import ChatTab from '@/components/meetup/ChatTab';

export default function MeetupDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const meetup = useAppStore((s) => s.meetups.find((m) => m.id === id));
  const user = useAppStore((s) => s.user);

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
          <Badge variant="secondary" className={statusColor(meetup.status)}>
            {meetup.status}
          </Badge>
        </div>
      </header>

      <div className="max-w-lg mx-auto">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full grid grid-cols-4 mx-4 mt-3" style={{ width: 'calc(100% - 2rem)' }}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="venues">Venues</TabsTrigger>
            <TabsTrigger value="vote">Vote</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
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
