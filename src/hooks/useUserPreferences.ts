import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserPreferences {
  categories: string[];
  min_rating: number;
  max_travel_minutes: number;
  price_levels: number[];
  keyword: string;
}

export const DEFAULT_PREFS: UserPreferences = {
  categories: ['Food', 'Coffee', 'Drinks'],
  min_rating: 0,
  max_travel_minutes: 60,
  price_levels: [0, 1, 2, 3, 4],
  keyword: '',
};

export function useUserPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user_preferences', user?.id],
    queryFn: async (): Promise<UserPreferences> => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('categories, min_rating, max_travel_minutes, price_levels, keyword')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_PREFS;
      return {
        categories: data.categories ?? DEFAULT_PREFS.categories,
        min_rating: Number(data.min_rating ?? 0),
        max_travel_minutes: data.max_travel_minutes ?? 60,
        price_levels: data.price_levels ?? DEFAULT_PREFS.price_levels,
        keyword: data.keyword ?? '',
      };
    },
    enabled: !!user,
  });
}

export function useSaveUserPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: UserPreferences) => {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ user_id: user!.id, ...prefs }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user_preferences', user?.id] }),
  });
}
