/**
 * Placeholder. Generate real types with:
 *   supabase gen types typescript --local > src/lib/supabase/database.types.ts
 *
 * Or from your hosted project:
 *   supabase gen types typescript --project-id YOUR_REF > src/lib/supabase/database.types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      sources: {
        Row: {
          id: string;
          name: string;
          state: string | null;
          type: "federal" | "state" | "institution" | "aggregator";
          url: string;
          adapter_key: string;
          last_crawled_at: string | null;
          status: "active" | "paused" | "errored";
          error_count: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["sources"]["Row"],
          "id" | "created_at" | "updated_at" | "error_count" | "status" | "metadata"
        > & {
          id?: string;
          error_count?: number;
          status?: "active" | "paused" | "errored";
          metadata?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["sources"]["Insert"]>;
      };
      rfps: {
        Row: {
          id: string;
          source_id: string;
          external_id: string;
          title: string;
          description: string | null;
          full_text: string | null;
          url: string;
          agency_name: string | null;
          state: string | null;
          posted_at: string | null;
          due_at: string | null;
          estimated_value_cents: number | null;
          raw_payload: Json;
          content_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["rfps"]["Row"],
          "id" | "created_at" | "updated_at" | "raw_payload"
        > & {
          id?: string;
          raw_payload?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["rfps"]["Insert"]>;
      };
      rfp_classifications: {
        Row: {
          rfp_id: string;
          vertical:
            | "higher_ed"
            | "healthcare"
            | "k12"
            | "state_local_gov"
            | "federal_gov"
            | "other";
          category: string;
          confidence: number;
          tags: string[];
          classified_at: string;
          model_version: string;
        };
        Insert: Omit<Database["public"]["Tables"]["rfp_classifications"]["Row"], "classified_at"> & {
          classified_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rfp_classifications"]["Insert"]>;
      };
      rfp_embeddings: {
        Row: {
          rfp_id: string;
          embedding: number[];
          model_version: string;
          embedded_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["rfp_embeddings"]["Row"], "embedded_at"> & {
          embedded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rfp_embeddings"]["Insert"]>;
      };
      profiles: { Row: { id: string; email: string; display_name: string | null; role: "admin" | "member"; created_at: string }; Insert: { id: string; email: string; display_name?: string | null; role?: "admin" | "member" }; Update: Partial<{ email: string; display_name: string | null; role: "admin" | "member" }> };
      saved_searches: { Row: { id: string; user_id: string; name: string; keyword_query: string | null; semantic_query: string | null; semantic_query_embedding: number[] | null; filters: Json; alert_frequency: "realtime" | "daily" | "weekly" | "never"; last_matched_at: string | null; created_at: string; updated_at: string }; Insert: { user_id: string; name: string; keyword_query?: string | null; semantic_query?: string | null; semantic_query_embedding?: number[] | null; filters?: Json; alert_frequency?: "realtime" | "daily" | "weekly" | "never" }; Update: Partial<Database["public"]["Tables"]["saved_searches"]["Insert"]> };
      alerts: { Row: { id: string; user_id: string; rfp_id: string; saved_search_id: string; relevance_score: number | null; sent_at: string | null; clicked_at: string | null; created_at: string }; Insert: { user_id: string; rfp_id: string; saved_search_id: string; relevance_score?: number | null }; Update: Partial<{ sent_at: string | null; clicked_at: string | null }> };
      awards: {
        Row: {
          id: string;
          source_id: string;
          external_id: string;
          award_type: "contract" | "grant" | "loan" | "direct_payment" | "idv" | "other";
          title: string | null;
          description: string | null;
          piid_or_fain: string | null;
          url: string;
          recipient_name: string | null;
          recipient_uei: string | null;
          recipient_state: string | null;
          awarding_agency: string | null;
          awarding_sub_agency: string | null;
          action_date: string | null;
          start_date: string | null;
          end_date: string | null;
          total_obligated_cents: number | null;
          base_and_all_options_cents: number | null;
          naics_code: string | null;
          psc_code: string | null;
          place_of_performance_state: string | null;
          raw_payload: Json;
          content_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["awards"]["Row"],
          "id" | "created_at" | "updated_at" | "raw_payload"
        > & { id?: string; raw_payload?: Json };
        Update: Partial<Database["public"]["Tables"]["awards"]["Insert"]>;
      };
      award_embeddings: {
        Row: {
          award_id: string;
          embedding: number[];
          model_version: string;
          embedded_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["award_embeddings"]["Row"], "embedded_at"> & {
          embedded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["award_embeddings"]["Insert"]>;
      };
    };
    Functions: {
      search_rfps: {
        Args: {
          p_keyword?: string | null;
          p_query_embedding?: number[] | null;
          p_vertical?: string | null;
          p_category?: string | null;
          p_state?: string | null;
          p_posted_after?: string | null;
          p_due_after?: string | null;
          p_min_value_cents?: number | null;
          p_similarity_threshold?: number;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          rfp_id: string;
          title: string;
          description: string | null;
          agency_name: string | null;
          state: string | null;
          url: string;
          posted_at: string | null;
          due_at: string | null;
          estimated_value_cents: number | null;
          vertical: string | null;
          category: string | null;
          tags: string[] | null;
          similarity: number | null;
        }[];
      };
      find_similar_rfps: {
        Args: { p_rfp_id: string; p_limit?: number; p_min_similarity?: number };
        Returns: {
          rfp_id: string;
          title: string;
          agency_name: string | null;
          state: string | null;
          posted_at: string | null;
          similarity: number;
        }[];
      };
      find_similar_awards: {
        Args: {
          p_rfp_id: string;
          p_limit?: number;
          p_min_similarity?: number;
          p_award_type?: string | null;
          p_max_age_days?: number | null;
        };
        Returns: {
          award_id: string;
          title: string | null;
          description: string | null;
          award_type: string;
          recipient_name: string | null;
          recipient_state: string | null;
          awarding_agency: string | null;
          awarding_sub_agency: string | null;
          action_date: string | null;
          total_obligated_cents: number | null;
          naics_code: string | null;
          url: string;
          similarity: number;
        }[];
      };
      find_awards_for_recipient: {
        Args: { p_recipient_pattern: string; p_limit?: number };
        Returns: {
          award_id: string;
          title: string | null;
          award_type: string;
          recipient_name: string | null;
          awarding_agency: string | null;
          action_date: string | null;
          total_obligated_cents: number | null;
          url: string;
        }[];
      };
    };
  };
};
