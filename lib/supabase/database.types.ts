export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          role: 'teacher' | 'student'
          full_name: string
          username: string | null
          organization_id: string | null
        }
        Insert: {
          id: string
          email: string
          role: 'teacher' | 'student'
          full_name: string
          username?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          email?: string
          role?: 'teacher' | 'student'
          full_name?: string
          username?: string | null
          organization_id?: string | null
        }
      }
      topics: {
        Row: {
          id: string
          component: '01' | '02'
          title: string
          order_number: number
        }
        Insert: {
          id?: string
          component: '01' | '02'
          title: string
          order_number: number
        }
        Update: {
          id?: string
          component?: '01' | '02'
          title?: string
          order_number?: number
        }
      }
      subtopics: {
        Row: {
          id: string
          topic_id: string
          title: string
          content_json: Json
          order_number: number
        }
        Insert: {
          id?: string
          topic_id: string
          title: string
          content_json: Json
          order_number: number
        }
        Update: {
          id?: string
          topic_id?: string
          title?: string
          content_json?: Json
          order_number?: number
        }
      }
      released_subtopics: {
        Row: {
          id: string
          subtopic_id: string
          teacher_id: string
          released_at: string
        }
        Insert: {
          id?: string
          subtopic_id: string
          teacher_id: string
          released_at?: string
        }
        Update: {
          id?: string
          subtopic_id?: string
          teacher_id?: string
          released_at?: string
        }
      }
      question_sets: {
        Row: {
          id: string
          subtopic_id: string
          teacher_id: string
          questions_json: Json
          created_at: string
        }
        Insert: {
          id?: string
          subtopic_id: string
          teacher_id: string
          questions_json: Json
          created_at?: string
        }
        Update: {
          id?: string
          subtopic_id?: string
          teacher_id?: string
          questions_json?: Json
          created_at?: string
        }
      }
      student_answers: {
        Row: {
          id: string
          question_set_id: string
          student_id: string
          answers_json: Json
          scores_json: Json
          feedback_json: Json
          submitted_at: string
          total_score: number
        }
        Insert: {
          id?: string
          question_set_id: string
          student_id: string
          answers_json: Json
          scores_json: Json
          feedback_json: Json
          submitted_at?: string
          total_score: number
        }
        Update: {
          id?: string
          question_set_id?: string
          student_id?: string
          answers_json?: Json
          scores_json?: Json
          feedback_json?: Json
          submitted_at?: string
          total_score?: number
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
