import { useState } from 'react';
import { Calendar, Download, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  meetupName: string;
  meetupId: string;
  venueName: string;
  venueAddress: string;
}

// ── ICS helpers ──────────────────────────────────────────────────────────────

/** Format a Date as ICS local-time: YYYYMMDDTHHMMSS (floating, no Z).
 *  Floating time means "this time in whatever timezone the reader is in",
 *  which is the right default when all attendees meet at the same physical spot. */
function icsDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `T${p(d.getHours())}${p(d.getMinutes())}00`
  );
}

function escapeICS(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function buildICS(
  title: string,
  location: string,
  description: string,
  start: Date,
  end: Date,
  uid: string,
): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FairMeet//FairMeet//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${escapeICS(title)}`,
    `LOCATION:${escapeICS(location)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function googleCalUrl(
  title: string,
  location: string,
  description: string,
  start: Date,
  end: Date,
): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${icsDate(start)}/${icsDate(end)}`,
    details: description,
    location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CalendarExportDialog({
  meetupName,
  meetupId,
  venueName,
  venueAddress,
}: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('10:00');
  const [durationHours, setDurationHours] = useState('2');

  const buildDates = () => {
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    const start = new Date(y, m - 1, d, h, min, 0);
    const end = new Date(start.getTime() + parseFloat(durationHours) * 3_600_000);
    return { start, end };
  };

  const description = `FairMeet: ${meetupName}\nVenue: ${venueName}`;

  const handleDownload = () => {
    const { start, end } = buildDates();
    const ics = buildICS(
      meetupName,
      venueAddress,
      description,
      start,
      end,
      `meetup-${meetupId}@fairmeet`,
    );
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meetupName.replace(/[^a-zA-Z0-9]+/g, '-')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGoogle = () => {
    const { start, end } = buildDates();
    window.open(googleCalUrl(meetupName, venueAddress, description, start, end), '_blank');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar className="w-3.5 h-3.5" /> Add to Calendar
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Add to Calendar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Venue summary */}
          <div className="rounded-lg bg-muted px-3 py-2 text-sm">
            <p className="font-medium">{venueName}</p>
            <p className="text-muted-foreground text-xs mt-0.5 leading-snug">{venueAddress}</p>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Start time + duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start time</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={durationHours} onValueChange={setDurationHours}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="1.5">1.5 hours</SelectItem>
                  <SelectItem value="2">2 hours</SelectItem>
                  <SelectItem value="3">3 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Export buttons */}
          <div className="space-y-2 pt-1">
            <Button
              className="w-full gap-2"
              onClick={handleGoogle}
              disabled={!date}
            >
              <ExternalLink className="w-4 h-4" /> Open in Google Calendar
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleDownload}
              disabled={!date}
            >
              <Download className="w-4 h-4" /> Download .ics (Apple / Outlook)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
