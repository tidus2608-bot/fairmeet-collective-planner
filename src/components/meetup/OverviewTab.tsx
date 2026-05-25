import { useState } from 'react';
import { Copy, Trash2, LogOut, Check, Clock, ExternalLink, CalendarPlus, Save } from 'lucide-react';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
                  ? 'bg-surface-container text-on-surface-variant'
                  : meetup.status === 'Voting'
                    ? 'bg-primary-container/10 text-primary'
                    : 'bg-tertiary-container/10 text-tertiary'
              }
            >
              {meetup.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Stat boxes: readiness + date */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface-container-low rounded-lg p-4 flex flex-col gap-1">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Readiness</span>
              <span className="text-base font-bold text-primary">
                {readyCount}/{total} Ready
              </span>
            </div>
            <div className="bg-surface-container-low rounded-lg p-4 flex flex-col gap-1">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                {meetup.scheduled_at ? 'Date' : 'Status'}
              </span>
              <span className="text-base font-bold text-primary">
                {meetup.scheduled_at
                  ? format(new Date(meetup.scheduled_at), 'MMM d, h:mm a')
                  : meetup.status}
              </span>
            </div>
          </div>
          {/* Group consensus progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Group consensus</span>
              <span className="font-medium text-primary">
                {total > 0 ? Math.round((readyCount / total) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 w-full bg-secondary-container rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${total > 0 ? (readyCount / total) * 100 : 0}%` }}
              />
            </div>
          </div>
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
            <div className="flex-1 text-xs text-on-surface-variant bg-surface-container-low rounded-lg px-3 py-2 font-mono truncate">
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Participants</CardTitle>
            <span className="text-sm text-on-surface-variant">{total} invited</span>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="divide-y divide-surface-container-high">
            {participants.map((p, idx) => {
              const ready = p.status === 'location_set';
              const avatarBg = idx % 2 === 0
                ? 'bg-primary-fixed text-on-primary-fixed'
                : 'bg-secondary-fixed text-on-secondary-fixed';
              return (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className={`text-sm font-medium ${avatarBg}`}>{initials(p.user_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-on-surface">{p.user_name}</p>
                      <p className="text-xs text-on-surface-variant">
                        {ready ? 'Location set' : 'Pending location…'}
                      </p>
                    </div>
                  </div>
                  {ready ? (
                    <Check className="w-5 h-5 text-tertiary shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-outline-variant shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Confirmed venue */}
      {meetup.status === 'Confirmed' && meetup.final_venue && (
        <Card className="border-tertiary-container/30 bg-tertiary-container/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-tertiary">Confirmed Venue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold text-on-surface">{meetup.final_venue.name}</p>
            <p className="text-sm text-on-surface-variant">{meetup.final_venue.address}</p>
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
