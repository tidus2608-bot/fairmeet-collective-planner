import { useState } from 'react';
import { Copy, Trash2, LogOut, Check, Clock, ExternalLink, CalendarClock, CalendarPlus, Save } from 'lucide-react';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { MeetupRow, useUpdateMeetup, useDeleteMeetup, useLeaveMeetup } from '@/hooks/useMeetups';
import { downloadMeetupICS } from '@/lib/calendar';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Props {
  meetup: MeetupRow;
  userId: string;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function OverviewTab({ meetup, userId }: Props) {
  const updateMeetup = useUpdateMeetup();
  const deleteMeetup = useDeleteMeetup();
  const leaveMeetup = useLeaveMeetup();
  const navigate = useNavigate();
  const isOrganizer = meetup.organizer_id === userId;

  const [name, setName] = useState(meetup.name);
  const [scheduledInput, setScheduledInput] = useState(toLocalInput(meetup.scheduled_at));
  const detailsDirty =
    name.trim() !== meetup.name || scheduledInput !== toLocalInput(meetup.scheduled_at);

  const participants = meetup.participants || [];
  const readyCount = participants.filter((p) => p.status === 'location_set').length;
  const total = participants.length;

  const inviteUrl = `${window.location.origin}/join/${meetup.invite_code}`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteUrl);
    toast.success('Invite link copied!');
  };

  const handleSaveDetails = () => {
    if (!name.trim()) {
      toast.error('Meetup name cannot be empty');
      return;
    }
    updateMeetup.mutate(
      {
        meetupId: meetup.id,
        name: name.trim(),
        scheduledAt: scheduledInput ? new Date(scheduledInput).toISOString() : null,
      },
      {
        onSuccess: () => toast.success('Meetup details saved'),
        onError: () => toast.error('Could not save details'),
      },
    );
  };

  const handleAddToCalendar = () => {
    if (!meetup.scheduled_at) return;
    downloadMeetupICS({
      id: meetup.id,
      title: meetup.name,
      start: meetup.scheduled_at,
      location: meetup.final_venue?.address,
    });
  };

  return (
    <div className="space-y-4">
      {/* Group Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Group Status</CardTitle>
            <Badge
              variant="secondary"
              className={
                meetup.status === 'Planning'
                  ? 'bg-blue-100 text-blue-700'
                  : meetup.status === 'Voting'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'
              }
            >
              {meetup.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Preferences set</span>
              <span className="font-medium">
                {readyCount}/{total} participants
              </span>
            </div>
            <Progress value={total > 0 ? (readyCount / total) * 100 : 0} className="h-2" />
          </div>
          {meetup.scheduled_at ? (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4" />
              {format(new Date(meetup.scheduled_at), 'EEEE, MMM d · h:mm a')}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No date set yet</p>
          )}
          {meetup.scheduled_at && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleAddToCalendar}>
              <CalendarPlus className="w-3.5 h-3.5" /> Add to calendar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Organizer-only: meetup details edit */}
      {isOrganizer && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Meetup Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="meetup-name" className="text-sm font-medium mb-1.5 block">
                  Name
                </Label>
                <Input
                  id="meetup-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="meetup-when" className="text-sm font-medium mb-1.5 block">
                  Date &amp; time
                </Label>
                <Input
                  id="meetup-when"
                  type="datetime-local"
                  value={scheduledInput}
                  onChange={(e) => setScheduledInput(e.target.value)}
                />
              </div>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleSaveDetails}
              disabled={!detailsDirty || updateMeetup.isPending}
            >
              <Save className="w-3.5 h-3.5" /> Save details
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Share Invite */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Share Invite</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 text-xs text-muted-foreground bg-muted rounded-md px-3 py-2 font-mono truncate">
              {inviteUrl}
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={handleCopyInvite}>
              <Copy className="w-3.5 h-3.5" /> Copy
            </Button>
          </div>
          <div className="flex justify-center">
            <QRCodeSVG value={inviteUrl} size={140} className="rounded-lg" />
          </div>
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Participants ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {participants.map((p) => {
              const ready = p.status === 'location_set';
              return (
                <div key={p.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/50">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback className="text-xs">{initials(p.user_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.user_name}</p>
                    <span
                      className={`text-[10px] flex items-center gap-0.5 ${ready ? 'text-green-600' : 'text-amber-600'}`}
                    >
                      {ready ? (
                        <>
                          <Check className="w-3 h-3" /> Ready
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" /> Thinking
                        </>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Confirmed venue */}
      {meetup.status === 'Confirmed' && meetup.final_venue && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-green-800">Confirmed Venue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold">{meetup.final_venue.name}</p>
            <p className="text-sm text-muted-foreground">{meetup.final_venue.address}</p>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${meetup.final_venue.location?.lat},${meetup.final_venue.location?.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Get Directions
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="pt-2">
        {isOrganizer ? (
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={() => {
              deleteMeetup.mutate(meetup.id);
              navigate('/dashboard');
            }}
          >
            <Trash2 className="w-4 h-4" /> Delete Meetup
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full gap-2 text-destructive border-destructive"
            onClick={() => {
              leaveMeetup.mutate(meetup.id);
              navigate('/dashboard');
            }}
          >
            <LogOut className="w-4 h-4" /> Leave Meetup
          </Button>
        )}
      </div>
    </div>
  );
}
