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
      circles: {
        Row: {
          color: string
          created_at: string
          emoji: string
          id: string
          name: string
          tone: string
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          emoji?: string
          id?: string
          name: string
          tone?: string
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          tone?: string
          user_id?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          archived_at: string | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          app_version: string | null
          created_at: string
          id: string
          message: string
          surface: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          id?: string
          message: string
          surface?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          id?: string
          message?: string
          surface?: string
          user_id?: string
        }
        Relationships: []
      }
      import_candidates: {
        Row: {
          ai_bullets: Json | null
          ai_rationale: string | null
          ai_relevance_score: number | null
          company: string | null
          created_at: string
          dedupe_key: string | null
          dismissed: boolean
          email: string | null
          id: string
          name: string
          phone: string | null
          photo_path: string | null
          promoted: boolean
          promoted_person_id: string | null
          raw: Json
          session_id: string
          source: string
          title: string | null
          user_id: string
        }
        Insert: {
          ai_bullets?: Json | null
          ai_rationale?: string | null
          ai_relevance_score?: number | null
          company?: string | null
          created_at?: string
          dedupe_key?: string | null
          dismissed?: boolean
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_path?: string | null
          promoted?: boolean
          promoted_person_id?: string | null
          raw?: Json
          session_id: string
          source: string
          title?: string | null
          user_id: string
        }
        Update: {
          ai_bullets?: Json | null
          ai_rationale?: string | null
          ai_relevance_score?: number | null
          company?: string | null
          created_at?: string
          dedupe_key?: string | null
          dismissed?: boolean
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_path?: string | null
          promoted?: boolean
          promoted_person_id?: string | null
          raw?: Json
          session_id?: string
          source?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      import_sessions: {
        Row: {
          candidates_count: number
          created_at: string
          filter_text: string | null
          id: string
          promoted_count: number
          sources: string[]
          user_id: string
        }
        Insert: {
          candidates_count?: number
          created_at?: string
          filter_text?: string | null
          id?: string
          promoted_count?: number
          sources?: string[]
          user_id: string
        }
        Update: {
          candidates_count?: number
          created_at?: string
          filter_text?: string | null
          id?: string
          promoted_count?: number
          sources?: string[]
          user_id?: string
        }
        Relationships: []
      }
      person_events: {
        Row: {
          created_at: string
          event_id: string
          id: string
          person_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          person_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          person_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_events_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          created_at: string
          id: string
          note: string | null
          person_a_id: string
          person_b_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          person_a_id: string
          person_b_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          person_a_id?: string
          person_b_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_person_a_id_fkey"
            columns: ["person_a_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_person_b_id_fkey"
            columns: ["person_b_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          id: string
          meeting_date: string
          notes: string | null
          person_id: string
          place: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_date?: string
          notes?: string | null
          person_id: string
          place?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_date?: string
          notes?: string | null
          person_id?: string
          place?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          created_at: string
          external_name: string | null
          id: string
          meeting_id: string
          person_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          external_name?: string | null
          id?: string
          meeting_id: string
          person_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          external_name?: string | null
          id?: string
          meeting_id?: string
          person_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      person_circles: {
        Row: {
          circle_id: string
          id: string
          person_id: string
        }
        Insert: {
          circle_id: string
          id?: string
          person_id: string
        }
        Update: {
          circle_id?: string
          id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_circles_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_circles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          created_at: string
          date_met: string | null
          how_we_met: string | null
          id: string
          important_info: string | null
          ios_contact_id: string | null
          known_people_notes: string | null
          linkedin_url: string | null
          misc_notes: string | null
          name: string
          photos: string[]
          physical_description: string | null
          physical_description_ai_generated: boolean
          reminder_date: string | null
          reminder_note: string | null
          updated_at: string
          user_id: string | null
          where_when: string | null
        }
        Insert: {
          created_at?: string
          date_met?: string | null
          how_we_met?: string | null
          id?: string
          important_info?: string | null
          ios_contact_id?: string | null
          known_people_notes?: string | null
          linkedin_url?: string | null
          misc_notes?: string | null
          name?: string
          photos?: string[]
          physical_description?: string | null
          physical_description_ai_generated?: boolean
          reminder_date?: string | null
          reminder_note?: string | null
          updated_at?: string
          user_id?: string | null
          where_when?: string | null
        }
        Update: {
          created_at?: string
          date_met?: string | null
          how_we_met?: string | null
          id?: string
          important_info?: string | null
          ios_contact_id?: string | null
          known_people_notes?: string | null
          linkedin_url?: string | null
          misc_notes?: string | null
          name?: string
          photos?: string[]
          physical_description?: string | null
          physical_description_ai_generated?: boolean
          reminder_date?: string | null
          reminder_note?: string | null
          updated_at?: string
          user_id?: string | null
          where_when?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
