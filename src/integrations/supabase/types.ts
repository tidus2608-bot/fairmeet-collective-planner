export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          meetup_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          meetup_id: string
          user_id: string
          user_name: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meetup_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
        ]
      }
      meetups: {
        Row: {
          created_at: string
          final_venue: Json | null
          id: string
          invite_code: string
          name: string
          organizer_id: string
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          final_venue?: Json | null
          id?: string
          invite_code?: string
          name: string
          organizer_id: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          final_venue?: Json | null
          id?: string
          invite_code?: string
          name?: string
          organizer_id?: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          meetup_id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          meetup_id: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          meetup_id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          fairness_importance: number | null
          id: string
          location: Json | null
          max_travel_time: number | null
          meetup_id: string
          status: string
          transport_mode: string
          user_id: string
          user_name: string
          venue_types: string[] | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          fairness_importance?: number | null
          id?: string
          location?: Json | null
          max_travel_time?: number | null
          meetup_id: string
          status?: string
          transport_mode?: string
          user_id: string
          user_name: string
          venue_types?: string[] | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          fairness_importance?: number | null
          id?: string
          location?: Json | null
          max_travel_time?: number | null
          meetup_id?: string
          status?: string
          transport_mode?: string
          user_id?: string
          user_name?: string
          venue_types?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          meetup_id: string
          user_id: string
          venue_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          meetup_id: string
          user_id: string
          venue_id: string
          vote_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          meetup_id?: string
          user_id?: string
          venue_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          categories: string[]
          created_at: string
          id: string
          keyword: string
          max_travel_minutes: number
          min_rating: number
          open_now: boolean
          price_levels: number[]
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?: string[]
          created_at?: string
          id?: string
          keyword?: string
          max_travel_minutes?: number
          min_rating?: number
          open_now?: boolean
          price_levels?: number[]
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?: string[]
          created_at?: string
          id?: string
          keyword?: string
          max_travel_minutes?: number
          min_rating?: number
          open_now?: boolean
          price_levels?: number[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      venue_suggestions: {
        Row: {
          added_by: string | null
          address: string
          ai_theme: string | null
          category: string
          created_at: string
          google_place_id: string | null
          id: string
          in_poll: boolean
          location: Json
          meetup_id: string
          name: string
          opening_hours: Json | null
          phone: string | null
          photo_reference: string | null
          price_level: number | null
          rating: number
          travel_times: Json | null
          website: string | null
          worst_minutes: number | null
        }
        Insert: {
          added_by?: string | null
          address: string
          ai_theme?: string | null
          category?: string
          created_at?: string
          google_place_id?: string | null
          id?: string
          in_poll?: boolean
          location: Json
          meetup_id: string
          name: string
          opening_hours?: Json | null
          phone?: string | null
          photo_reference?: string | null
          price_level?: number | null
          rating?: number
          travel_times?: Json | null
          website?: string | null
          worst_minutes?: number | null
        }
        Update: {
          added_by?: string | null
          address?: string
          ai_theme?: string | null
          category?: string
          created_at?: string
          google_place_id?: string | null
          id?: string
          in_poll?: boolean
          location?: Json
          meetup_id?: string
          name?: string
          opening_hours?: Json | null
          phone?: string | null
          photo_reference?: string | null
          price_level?: number | null
          rating?: number
          travel_times?: Json | null
          website?: string | null
          worst_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_suggestions_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_meetup_participant: {
        Args: { _meetup_id: string; _user_id: string }
        Returns: boolean
      }
      join_meetup_by_code: {
        Args: { _code: string; _name: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
