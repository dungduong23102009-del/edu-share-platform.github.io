export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      document_analyses: {
        Row: {
          created_at: string;
          current_run_id: string;
          document_id: string;
          document_title: string | null;
          document_type: string;
          language: string;
          model: string;
          raw_analysis: Json;
          summary: string;
          updated_at: string;
          warnings: Json;
        };
        Insert: {
          created_at?: string;
          current_run_id: string;
          document_id: string;
          document_title?: string | null;
          document_type: string;
          language: string;
          model: string;
          raw_analysis: Json;
          summary: string;
          updated_at?: string;
          warnings: Json;
        };
        Update: {
          created_at?: string;
          current_run_id?: string;
          document_id?: string;
          document_title?: string | null;
          document_type?: string;
          language?: string;
          model?: string;
          raw_analysis?: Json;
          summary?: string;
          updated_at?: string;
          warnings?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "document_analyses_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: true;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      document_solver_jobs: {
        Row: {
          analysis_run_id: string;
          created_at: string;
          document_id: string;
          error: string | null;
          expires_at: string | null;
          run_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          analysis_run_id: string;
          created_at?: string;
          document_id: string;
          error?: string | null;
          expires_at?: string | null;
          run_id: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          analysis_run_id?: string;
          created_at?: string;
          document_id?: string;
          error?: string | null;
          expires_at?: string | null;
          run_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_solver_jobs_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: true;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          analysis_error: string | null;
          analysis_expires_at: string | null;
          analysis_run_id: string | null;
          analysis_stage: string | null;
          analysis_started_at: string | null;
          created_at: string;
          file_sha256: string;
          file_size: number;
          id: string;
          mime_type: string;
          original_filename: string;
          status: string;
          storage_path: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          analysis_error?: string | null;
          analysis_expires_at?: string | null;
          analysis_run_id?: string | null;
          analysis_stage?: string | null;
          analysis_started_at?: string | null;
          created_at?: string;
          file_sha256: string;
          file_size: number;
          id?: string;
          mime_type: string;
          original_filename: string;
          status?: string;
          storage_path: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          analysis_error?: string | null;
          analysis_expires_at?: string | null;
          analysis_run_id?: string | null;
          analysis_stage?: string | null;
          analysis_started_at?: string | null;
          created_at?: string;
          file_sha256?: string;
          file_size?: number;
          id?: string;
          mime_type?: string;
          original_filename?: string;
          status?: string;
          storage_path?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      question_solutions: {
        Row: {
          ai_confidence: number | null;
          ai_model: string | null;
          ai_provider: string | null;
          analysis_run_id: string;
          answer_origin: string;
          choices: Json;
          correct_answer: string | null;
          correct_choice: string | null;
          created_at: string;
          document_id: string;
          explanation: string | null;
          needs_review: boolean;
          original_type: string;
          parsing_warnings: Json;
          question_id: string;
          question_text: string;
          quiz_ready: boolean;
          raw_choices: Json;
          raw_question_text: string;
          solver_error: string | null;
          solver_run_id: string | null;
          solver_status: string;
          updated_at: string;
        };
        Insert: {
          ai_confidence?: number | null;
          ai_model?: string | null;
          ai_provider?: string | null;
          analysis_run_id: string;
          answer_origin: string;
          choices: Json;
          correct_answer?: string | null;
          correct_choice?: string | null;
          created_at?: string;
          document_id: string;
          explanation?: string | null;
          needs_review?: boolean;
          original_type: string;
          parsing_warnings?: Json;
          question_id: string;
          question_text: string;
          quiz_ready?: boolean;
          raw_choices: Json;
          raw_question_text: string;
          solver_error?: string | null;
          solver_run_id?: string | null;
          solver_status: string;
          updated_at?: string;
        };
        Update: {
          ai_confidence?: number | null;
          ai_model?: string | null;
          ai_provider?: string | null;
          analysis_run_id?: string;
          answer_origin?: string;
          choices?: Json;
          correct_answer?: string | null;
          correct_choice?: string | null;
          created_at?: string;
          document_id?: string;
          explanation?: string | null;
          needs_review?: boolean;
          original_type?: string;
          parsing_warnings?: Json;
          question_id?: string;
          question_text?: string;
          quiz_ready?: boolean;
          raw_choices?: Json;
          raw_question_text?: string;
          solver_error?: string | null;
          solver_run_id?: string | null;
          solver_status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_solutions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_solutions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          analysis_run_id: string | null;
          answer_origin: string | null;
          answer_source_excerpt: string | null;
          choices: Json;
          correct_answer: string | null;
          created_at: string;
          difficulty: string | null;
          document_id: string;
          explanation: string | null;
          extraction_confidence: number | null;
          id: string;
          question_text: string;
          source_excerpt: string | null;
          source_page: number | null;
          topic_id: string | null;
          validation_warning: string | null;
        };
        Insert: {
          analysis_run_id?: string | null;
          answer_origin?: string | null;
          answer_source_excerpt?: string | null;
          choices: Json;
          correct_answer?: string | null;
          created_at?: string;
          difficulty?: string | null;
          document_id: string;
          explanation?: string | null;
          extraction_confidence?: number | null;
          id?: string;
          question_text: string;
          source_excerpt?: string | null;
          source_page?: number | null;
          topic_id?: string | null;
          validation_warning?: string | null;
        };
        Update: {
          analysis_run_id?: string | null;
          answer_origin?: string | null;
          answer_source_excerpt?: string | null;
          choices?: Json;
          correct_answer?: string | null;
          created_at?: string;
          difficulty?: string | null;
          document_id?: string;
          explanation?: string | null;
          extraction_confidence?: number | null;
          id?: string;
          question_text?: string;
          source_excerpt?: string | null;
          source_page?: number | null;
          topic_id?: string | null;
          validation_warning?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "questions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_topic_id_document_id_fkey";
            columns: ["topic_id", "document_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id", "document_id"];
          },
        ];
      };
      quiz_answers: {
        Row: {
          attempt_id: string;
          created_at: string;
          id: string;
          is_correct: boolean | null;
          question_id: string;
          selected_answer: string | null;
        };
        Insert: {
          attempt_id: string;
          created_at?: string;
          id?: string;
          is_correct?: boolean | null;
          question_id: string;
          selected_answer?: string | null;
        };
        Update: {
          attempt_id?: string;
          created_at?: string;
          id?: string;
          is_correct?: boolean | null;
          question_id?: string;
          selected_answer?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "quiz_attempts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_attempts: {
        Row: {
          completed_at: string | null;
          correct_count: number;
          id: string;
          incorrect_count: number;
          quiz_id: string;
          score: number | null;
          started_at: string;
          total_questions: number;
          unanswered_count: number;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          correct_count?: number;
          id?: string;
          incorrect_count?: number;
          quiz_id: string;
          score?: number | null;
          started_at?: string;
          total_questions: number;
          unanswered_count?: number;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          correct_count?: number;
          id?: string;
          incorrect_count?: number;
          quiz_id?: string;
          score?: number | null;
          started_at?: string;
          total_questions?: number;
          unanswered_count?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_user_id_fkey";
            columns: ["quiz_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      quizzes: {
        Row: {
          created_at: string;
          document_id: string;
          id: string;
          settings: Json;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          document_id: string;
          id?: string;
          settings?: Json;
          title: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          document_id?: string;
          id?: string;
          settings?: Json;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quizzes_document_id_user_id_fkey";
            columns: ["document_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      topics: {
        Row: {
          analysis_run_id: string | null;
          created_at: string;
          document_id: string;
          id: string;
          sort_order: number;
          source_pages: Json;
          summary: string | null;
          title: string;
        };
        Insert: {
          analysis_run_id?: string | null;
          created_at?: string;
          document_id: string;
          id?: string;
          sort_order?: number;
          source_pages?: Json;
          summary?: string | null;
          title: string;
        };
        Update: {
          analysis_run_id?: string | null;
          created_at?: string;
          document_id?: string;
          id?: string;
          sort_order?: number;
          source_pages?: Json;
          summary?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "topics_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_document_analysis: {
        Args: { p_document_id: string; p_reprocess?: boolean };
        Returns: Json;
      };
      claim_document_solver: {
        Args: { p_document_id: string; p_regenerate?: boolean };
        Returns: Json;
      };
      claim_document_solver_v2: {
        Args: { p_document_id: string; p_regenerate?: boolean };
        Returns: Json;
      };
      complete_document_analysis: {
        Args: {
          p_analysis: Json;
          p_document_id: string;
          p_model: string;
          p_run_id: string;
        };
        Returns: boolean;
      };
      complete_question_solutions: {
        Args: {
          p_document_id: string;
          p_model: string;
          p_results: Json;
          p_run_id: string;
        };
        Returns: number;
      };
      complete_question_solutions_v2: {
        Args: {
          p_document_id: string;
          p_model: string;
          p_results: Json;
          p_run_id: string;
        };
        Returns: number;
      };
      expire_document_analysis: {
        Args: { p_document_id: string };
        Returns: undefined;
      };
      expire_document_solver: {
        Args: { p_document_id: string };
        Returns: undefined;
      };
      finish_document_solver: {
        Args: { p_document_id: string; p_error?: string; p_run_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
