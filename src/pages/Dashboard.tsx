import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, LogOut, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useMeetupsList, useCreateMeetup } from '@/hooks/useMeetups';
import AiIdeasModal from '@/components/AiIdeasModal';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: meetups = [], isLoading } = useMeetupsList();
  const createMeetup = useCreateMeetup();
  const [newMeetupName, setNewMeetupName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';

  const handleCreate = async () => {
    if (!newMeetupName.trim()) return;
    try {
      const meetup = await createMeetup.mutateAsync(newMeetupName.trim());
      setNewMeetupName('');
      setCreateOpen(false);
      navigate(`/meetup/${meetup.id}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'Planning') return 'bg-blue-100 text-blue-700';
    if (status === 'Voting') return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">FairMeet</h1>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{displayName[0]}</AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="icon" onClick={() => { signOut(); navigate('/'); }}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="flex gap-3">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 gap-2"><Plus className="w-4 h-4" /> Create New Meetup</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create a Meetup</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <Input placeholder="e.g., Weekend Coffee Catch-up" value={newMeetupName} onChange={(e) => setNewMeetupName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
                <Button onClick={handleCreate} className="w-full" disabled={!newMeetupName.trim() || createMeetup.isPending}>
                  {createMeetup.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="secondary" className="gap-2" onClick={() => setAiOpen(true)}>
            <Sparkles className="w-4 h-4" /> Suggest Ideas
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : meetups.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">No meetups yet</p>
            <p className="text-sm mt-1">Create one or let AI suggest some ideas!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {meetups.map((m) => {
              const locSet = m.participants?.filter((p) => p.status === 'location_set').length || 0;
              const total = m.participants?.length || 0;
              return (
                <Card key={m.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/meetup/${m.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold truncate">{m.name}</h3>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className={statusColor(m.status)}>{m.status}</Badge>
                      <span className="text-xs text-muted-foreground">{total} participant{total !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground"><span>Responses</span><span>{locSet}/{total}</span></div>
                      <Progress value={total > 0 ? (locSet / total) * 100 : 0} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      <AiIdeasModal open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
}
