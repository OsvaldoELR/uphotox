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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      board_stages: {
        Row: {
          board_id: number
          client_message: string | null
          created_at: string
          id: number
          name: string
          notify_client: boolean
          position: number
          studio_id: number
          updated_at: string
        }
        Insert: {
          board_id: number
          client_message?: string | null
          created_at?: string
          id?: never
          name: string
          notify_client?: boolean
          position: number
          studio_id: number
          updated_at?: string
        }
        Update: {
          board_id?: number
          client_message?: string | null
          created_at?: string
          id?: never
          name?: string
          notify_client?: boolean
          position?: number
          studio_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_stages_board_id_studio_id_fkey"
            columns: ["board_id", "studio_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id", "studio_id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: number
          name: string
          studio_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: never
          name: string
          studio_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: never
          name?: string
          studio_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boards_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      card_events: {
        Row: {
          actor_id: string | null
          card_id: number
          created_at: string
          detail: string | null
          from_stage_id: number | null
          id: number
          kind: string
          studio_id: number
          to_stage_id: number | null
        }
        Insert: {
          actor_id?: string | null
          card_id: number
          created_at?: string
          detail?: string | null
          from_stage_id?: number | null
          id?: never
          kind: string
          studio_id: number
          to_stage_id?: number | null
        }
        Update: {
          actor_id?: string | null
          card_id?: number
          created_at?: string
          detail?: string | null
          from_stage_id?: number | null
          id?: never
          kind?: string
          studio_id?: number
          to_stage_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "card_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_events_card_id_studio_id_fkey"
            columns: ["card_id", "studio_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "studio_id"]
          },
          {
            foreignKeyName: "card_events_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "board_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_events_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "board_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          assigned_to: string | null
          board_id: number
          client_id: number | null
          cover_path: string | null
          created_at: string
          created_by: string | null
          external_id: string | null
          gallery_url: string | null
          id: number
          notes: string | null
          position: number
          session_at: string | null
          source: string
          stage_entered_at: string
          stage_id: number
          studio_id: number
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          board_id: number
          client_id?: number | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          gallery_url?: string | null
          id?: never
          notes?: string | null
          position: number
          session_at?: string | null
          source?: string
          stage_entered_at?: string
          stage_id: number
          studio_id: number
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          board_id?: number
          client_id?: number | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          gallery_url?: string | null
          id?: never
          notes?: string | null
          position?: number
          session_at?: string | null
          source?: string
          stage_entered_at?: string
          stage_id?: number
          studio_id?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_assigned_to_studio_id_fkey"
            columns: ["assigned_to", "studio_id"]
            isOneToOne: false
            referencedRelation: "studio_members"
            referencedColumns: ["user_id", "studio_id"]
          },
          {
            foreignKeyName: "cards_board_id_studio_id_fkey"
            columns: ["board_id", "studio_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id", "studio_id"]
          },
          {
            foreignKeyName: "cards_client_id_studio_id_fkey"
            columns: ["client_id", "studio_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "studio_id"]
          },
          {
            foreignKeyName: "cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_stage_id_board_id_fkey"
            columns: ["stage_id", "board_id"]
            isOneToOne: false
            referencedRelation: "board_stages"
            referencedColumns: ["id", "board_id"]
          },
          {
            foreignKeyName: "cards_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: number
          notes: string | null
          phone: string | null
          studio_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: never
          notes?: string | null
          phone?: string | null
          studio_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: never
          notes?: string | null
          phone?: string | null
          studio_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      studio_integrations: {
        Row: {
          board_id: number | null
          created_at: string
          enabled: boolean
          id: number
          last_error: string | null
          last_received_at: string | null
          provider: string
          stage_id: number | null
          studio_id: number
          token: string
          updated_at: string
        }
        Insert: {
          board_id?: number | null
          created_at?: string
          enabled?: boolean
          id?: never
          last_error?: string | null
          last_received_at?: string | null
          provider: string
          stage_id?: number | null
          studio_id: number
          token: string
          updated_at?: string
        }
        Update: {
          board_id?: number | null
          created_at?: string
          enabled?: boolean
          id?: never
          last_error?: string | null
          last_received_at?: string | null
          provider?: string
          stage_id?: number | null
          studio_id?: number
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_integrations_board_id_studio_id_fkey"
            columns: ["board_id", "studio_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id", "studio_id"]
          },
          {
            foreignKeyName: "studio_integrations_stage_id_board_id_fkey"
            columns: ["stage_id", "board_id"]
            isOneToOne: false
            referencedRelation: "board_stages"
            referencedColumns: ["id", "board_id"]
          },
          {
            foreignKeyName: "studio_integrations_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_members: {
        Row: {
          created_at: string
          only_assigned: boolean
          permissions: string[]
          role: Database["public"]["Enums"]["studio_role"]
          studio_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          only_assigned?: boolean
          permissions?: string[]
          role: Database["public"]["Enums"]["studio_role"]
          studio_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          only_assigned?: boolean
          permissions?: string[]
          role?: Database["public"]["Enums"]["studio_role"]
          studio_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_members_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
          created_at: string
          id: number
          name: string
          owner_id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          owner_id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          owner_id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studios_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_studio: { Args: { studio_name: string }; Returns: number }
    }
    Enums: {
      studio_role: "owner" | "photographer" | "editor" | "assistant"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      studio_role: ["owner", "photographer", "editor", "assistant"],
    },
  },
} as const
