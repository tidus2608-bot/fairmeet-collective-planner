import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, ChevronRight, Loader2, Settings as SettingsIcon, CalendarClock, ArrowRight, MapPin, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useMeetupsList, useCreateMeetup } from '@/hooks/useMeetups';
import { toast } from 'sonner';

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: meetups = [], isLoading } = useMeetupsList();
  const createMeetup = useCreateMeetup();
  const [newMeetupName, setNewMeetupName] = useState('');
  const [newMeetupDesc, setNewMeetupDesc] = useState('');
  const [newMeetupDate, setNewMeetupDate] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';

  const handleCreate = async () => {
    if (!newMeetupName.trim()) return;
    try {
      const meetup = await createMeetup.mutateAsync(newMeetupName.trim());
      setNewMeetupName('');
      setNewMeetupDesc('');
      setNewMeetupDate('');
      setCreateOpen(false);
      navigate(`/meetup/${meetup.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create meetup');
    }
  };

  const handleJoin = () => {
    const code = joinCode.trim();
    if (!code) return;
    navigate(`/join/${encodeURIComponent(code)}`);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      toast.error('Could not sign out — please try again');
      return;
    }
    navigate('/');
  };

  const statusColor = (status: string) => {
    if (status === 'Planning') return 'bg-blue-100 text-blue-700';
    if (status === 'Voting') return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  // Live preview for the create dialog
  const previewDate = newMeetupDate ? new Date(newMeetupDate) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3 sm:px-6 md:max-w-3xl">
          <h1 className="text-xl font-bold text-primary">FairMeet</h1>
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{displayName[0]}</AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/settings')}
              aria-label="Preferences"
            >
              <SettingsIcon className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-4 sm:px-6 md:max-w-3xl">
        <div className="flex gap-3">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 gap-2">
                <Plus className="w-4 h-4" /> Create New Meetup
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create a Meetup</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 sm:grid-cols-2 pt-2">
                {/* Form column */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="meetup-name">Meetup Name</Label>
                    <Input
                      id="meetup-name"
                      placeholder="e.g., Weekend Coffee Catch-up"
                      value={newMeetupName}
                      onChange={(e) => setNewMeetupName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="meetup-desc">Description (optional)</Label>
                    <textarea
                      id="meetup-desc"
                      placeholder="What's this meetup about?"
                      value={newMeetupDesc}
                      onChange={(e) => setNewMeetupDesc(e.target.value)}
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="meetup-date">Date &amp; Time (optional)</Label>
                    <Input
                      id="meetup-date"
                      type="datetime-local"
                      value={newMeetupDate}
                      onChange={(e) => setNewMeetupDate(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleCreate}
                    className="w-full gap-2"
                    disabled={!newMeetupName.trim() || createMeetup.isPending}
                  >
                    {createMeetup.isPending && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    Next: Invite Friends
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Live preview column */}
                <div className="hidden sm:block">
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
                    Preview
                  </p>
                  <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
                    <CardContent className="p-4 space-y-3">
                      <div className="text-center space-y-1">
                        <p className="text-xs text-muted-foreground">You're Invited!</p>
                        <h3 className="font-bold text-base leading-snug">
                          {newMeetupName || 'Your Meetup Name'}
                        </h3>
                        {newMeetupDesc && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {newMeetupDesc}
                          </p>
                        )}
                      </div>
                      {previewDate && !isNaN(previewDate.getTime()) && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(previewDate, 'EEE, MMM d · h:mm a')}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        Venue TBD
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        Hosted by {displayName}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <div className="flex-1 text-center rounded-md bg-primary text-primary-foreground text-xs py-1.5 font-medium">
                          Accept
                        </div>
                        <div className="flex-1 text-center rounded-md border border-input text-xs py-1.5 font-medium text-muted-foreground">
                          Decline
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Have an invite code? Paste it here"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          <Button
            variant="outline"
            className="gap-1.5 shrink-0"
            onClick={handleJoin}
            disabled={!joinCode.trim()}
          >
            Join <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : meetups.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">No meetups yet</p>
            <p className="text-sm mt-1">Create one or join with an invite code!</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {meetups.map((m) => {
              const locSet =
                m.participants?.filter((p) => p.status === 'location_set').length || 0;
              const total = m.participants?.length || 0;
              return (
                <Card
                  key={m.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/meetup/${m.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold truncate">{m.name}</h3>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge variant="secondary" className={statusColor(m.status)}>
                        {m.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {total} participant{total !== 1 ? 's' : ''}
                      </span>
                      {m.scheduled_at && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" />
                          {format(new Date(m.scheduled_at), 'EEE, MMM d · h:mm a')}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Responses</span>
                        <span>
                          {locSet}/{total}
                        </span>
                      </div>
                      <Progress
                        value={total > 0 ? (locSet / total) * 100 : 0}
                        className="h-2"
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
