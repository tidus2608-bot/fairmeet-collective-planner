import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCreateMeetup } from '@/hooks/useMeetups';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AiIdeasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Idea {
  title: string;
  description: string;
  emoji: string;
}

export default function AiIdeasModal({ open, onOpenChange }: AiIdeasModalProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const createMeetup = useCreateMeetup();
  const navigate = useNavigate();

  const generateIdeas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-ideas');
      if (error) throw error;
      setIdeas(data.ideas || []);
    } catch {
      setIdeas([
        { title: 'Weekend Street Food Tour', description: 'Explore Hanoi\'s best street food stalls together', emoji: '🍜' },
        { title: 'Sunset at West Lake', description: 'Enjoy golden hour with drinks by the lake', emoji: '🌅' },
        { title: 'Old Quarter Coffee Crawl', description: 'Hit 3 hidden gem cafés in the Old Quarter', emoji: '☕' },
        { title: 'Temple of Literature Picnic', description: 'Cultural visit followed by a chill picnic', emoji: '🏛️' },
      ]);
    }
    setLoading(false);
  };

  const useIdea = async (title: string) => {
    try {
      const meetup = await createMeetup.mutateAsync(title);
      onOpenChange(false);
      navigate(`/meetup/${meetup.id}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> AI Meetup Ideas
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {ideas.length === 0 && !loading && (
            <Button onClick={generateIdeas} className="w-full gap-2">
              <Sparkles className="w-4 h-4" /> Generate Ideas for Hanoi
            </Button>
          )}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          {ideas.map((idea, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{idea.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold">{idea.title}</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">{idea.description}</p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" className="w-full mt-3" onClick={() => useIdea(idea.title)}>
                  Use this Idea
                </Button>
              </CardContent>
            </Card>
          ))}
          {ideas.length > 0 && (
            <Button variant="outline" onClick={generateIdeas} className="w-full" disabled={loading}>Regenerate</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
