function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

interface MeetupEvent {
  id: string;
  title: string;
  start: string; // ISO string
  location?: string;
}

// Builds a single-event .ics file and triggers a download. Defaults to a 2h duration.
export function downloadMeetupICS({ id, title, start, location }: MeetupEvent) {
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FairMeet//EN',
    'BEGIN:VEVENT',
    `UID:${id}@fairmeet`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(startDate)}`,
    `DTEND:${toICSDate(endDate)}`,
    `SUMMARY:${escapeICS(title)}`,
    location ? `LOCATION:${escapeICS(location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'meetup'}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
