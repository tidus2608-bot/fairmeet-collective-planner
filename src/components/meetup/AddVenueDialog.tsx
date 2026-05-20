import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import { useAddVenues } from '@/hooks/useMeetups';
import { toast } from 'sonner';

const categories = ['Food', 'Drinks', 'Coffee'] as const;

interface Props {
  meetupId: string;
  userId: string;
}

export default function AddVenueDialog({ meetupId, userId }: Props) {
  const addVenues = useAddVenues();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('Food');
  const [place, setPlace] = useState<{ lat: number; lng: number; address: string } | null>(null);

  const reset = () => {
    setName('');
    setCategory('Food');
    setPlace(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Enter a venue name'); return; }
    if (!place) { toast.error('Pick a location for the venue'); return; }
    try {
      await addVenues.mutateAsync({
        meetupId,
        venues: [{
          name: name.trim(),
          category,
          address: place.address,
          location: { lat: place.lat, lng: place.lng },
          rating: 0,
          added_by: userId,
        }],
      });
      toast.success(`Added ${name.trim()}`);
      reset();
      setOpen(false);
    } catch {
      toast.error('Could not add venue');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          <Plus className="w-4 h-4" /> Add a venue manually
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a venue</DialogTitle>
          <DialogDescription>Suggest your own spot. It joins the list for everyone to consider.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="venue-name">Name</Label>
            <Input id="venue-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Corner Bistro" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <PlacesAutocomplete
              placeholder="Search for the venue address..."
              onSelect={(p) => setPlace(p)}
            />
            {place && <p className="text-xs text-muted-foreground">{place.address}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={addVenues.isPending} className="gap-2">
            {addVenues.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Add venue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
