export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string
          room_code: string
          nickname: string
          score: number
          gold: number
          avatar: string | null
          is_online: boolean
          position?: number
          active_item?: Json | null
          item_effects?: Json | null
          health?: number
          attack_power?: number
          defense?: number
          caught_fishes?: Json | null
          fishing_points?: number
          factories?: Json | null
          factory_money?: number
          cafe_cash?: number
          cafe_customers_served?: number
          mafia_cash?: number
          mafia_diamonds?: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_code: string
          nickname: string
          score?: number
          gold?: number
          avatar?: string | null
          is_online?: boolean
          position?: number
          active_item?: Json | null
          item_effects?: Json | null
          health?: number
          attack_power?: number
          defense?: number
          caught_fishes?: Json | null
          fishing_points?: number
          factories?: Json | null
          factory_money?: number
          cafe_cash?: number
          cafe_customers_served?: number
          mafia_cash?: number
          mafia_diamonds?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          room_code?: string
          nickname?: string
          score?: number
          gold?: number
          avatar?: string | null
          is_online?: boolean
          position?: number
          active_item?: Json | null
          item_effects?: Json | null
          health?: number
          attack_power?: number
          defense?: number
          caught_fishes?: Json | null
          fishing_points?: number
          factories?: Json | null
          factory_money?: number
          cafe_cash?: number
          cafe_customers_served?: number
          mafia_cash?: number
          mafia_diamonds?: number
          created_at?: string
          updated_at?: string
        }
      }
      question_sets: {
        Row: {
          id: string
          title: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          title: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      rooms: {
        Row: {
          room_code: string
          status: 'waiting' | 'playing' | 'finished'
          current_q_index: number
          game_mode?: 'gold_quest' | 'racing' | 'battle_royale' | 'fishing' | 'factory' | 'cafe' | 'mafia' | 'pool' | 'tower' | 'dontlookdown'
          set_id?: string | null
          duration_seconds?: number | null
          started_at?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          room_code: string
          status?: 'waiting' | 'playing' | 'finished'
          current_q_index?: number
          game_mode?: 'gold_quest' | 'racing' | 'battle_royale' | 'fishing' | 'factory' | 'cafe' | 'mafia' | 'pool' | 'tower' | 'dontlookdown'
          set_id?: string | null
          duration_seconds?: number | null
          started_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          room_code?: string
          status?: 'waiting' | 'playing' | 'finished'
          current_q_index?: number
          game_mode?: 'gold_quest' | 'racing' | 'battle_royale' | 'fishing' | 'factory' | 'cafe' | 'mafia' | 'pool' | 'tower' | 'dontlookdown'
          set_id?: string | null
          duration_seconds?: number | null
          started_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      questions: {
        Row: {
          id: string
          set_id: string
          type: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
          question_text: string
          options: Json
          answer: string
          created_at: string
        }
        Insert: {
          id?: string
          set_id: string
          type: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
          question_text: string
          options: Json
          answer: string
          created_at?: string
        }
        Update: {
          id?: string
          set_id?: string
          type?: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
          question_text?: string
          options?: Json
          answer?: string
          created_at?: string
        }
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
  }
}

