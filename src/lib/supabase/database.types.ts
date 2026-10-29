export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ApplicationStatus =
  | 'draft'
  | 'ready_for_review'
  | 'submitted'
  | 'awaiting_response'
  | 'under_review'
  | 'interview'
  | 'rejected'
  | 'offer'
  | 'closed';

export type OutreachStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'scheduled'
  | 'sent'
  | 'replied'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          headline: string | null;
          location: string | null;
          skills: string[];
          education: Json;
          experience: Json;
          projects: Json;
          portfolio_url: string | null;
          github_url: string | null;
          linkedin_url: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          email?: string | null;
          headline?: string | null;
          location?: string | null;
          skills?: string[];
          education?: Json;
          experience?: Json;
          projects?: Json;
          portfolio_url?: string | null;
          github_url?: string | null;
          linkedin_url?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string | null;
          headline?: string | null;
          location?: string | null;
          skills?: string[];
          education?: Json;
          experience?: Json;
          projects?: Json;
          portfolio_url?: string | null;
          github_url?: string | null;
          linkedin_url?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      candidate_preferences: {
        Row: {
          id: string;
          user_id: string;
          roles: string[];
          locations: string[];
          work_mode: 'remote' | 'hybrid' | 'on_site';
          relocation: boolean;
          employment_type: 'full_time' | 'part_time' | 'contract' | 'internship';
          expected_compensation: number | null;
          current_compensation: number | null;
          currency: string;
          industries: string[];
          followup_days: number;
          skip_weekends: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          roles?: string[];
          locations?: string[];
          work_mode?: 'remote' | 'hybrid' | 'on_site';
          relocation?: boolean;
          employment_type?: 'full_time' | 'part_time' | 'contract' | 'internship';
          expected_compensation?: number | null;
          current_compensation?: number | null;
          currency?: string;
          industries?: string[];
          followup_days?: number;
          skip_weekends?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          roles?: string[];
          locations?: string[];
          work_mode?: 'remote' | 'hybrid' | 'on_site';
          relocation?: boolean;
          employment_type?: 'full_time' | 'part_time' | 'contract' | 'internship';
          expected_compensation?: number | null;
          current_compensation?: number | null;
          currency?: string;
          industries?: string[];
          followup_days?: number;
          skip_weekends?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      resumes: {
        Row: {
          id: string;
          user_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          extraction_status: 'pending' | 'completed' | 'failed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          extraction_status?: 'pending' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          size_bytes?: number;
          extraction_status?: 'pending' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      job_applications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          company: string;
          url: string;
          location: string;
          job_description: string | null;
          status: ApplicationStatus;
          submission_idempotency_key: string | null;
          submission_approved_at: string | null;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          company: string;
          url?: string;
          location?: string;
          job_description?: string | null;
          status?: ApplicationStatus;
          submission_idempotency_key?: string | null;
          submission_approved_at?: string | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          company?: string;
          url?: string;
          location?: string;
          job_description?: string | null;
          status?: ApplicationStatus;
          submission_idempotency_key?: string | null;
          submission_approved_at?: string | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      application_events: {
        Row: {
          id: string;
          user_id: string;
          application_id: string;
          from_status: ApplicationStatus | null;
          to_status: ApplicationStatus;
          description: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          application_id: string;
          from_status?: ApplicationStatus | null;
          to_status: ApplicationStatus;
          description: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          application_id?: string;
          from_status?: ApplicationStatus | null;
          to_status?: ApplicationStatus;
          description?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recruiter_contacts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          email: string;
          company: string | null;
          role: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          email: string;
          company?: string | null;
          role?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          email?: string;
          company?: string | null;
          role?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      outreach_campaigns: {
        Row: {
          id: string;
          user_id: string;
          application_id: string | null;
          recruiter_contact_id: string;
          status: OutreachStatus;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          application_id?: string | null;
          recruiter_contact_id: string;
          status?: OutreachStatus;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          application_id?: string | null;
          recruiter_contact_id?: string;
          status?: OutreachStatus;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_messages: {
        Row: {
          id: string;
          user_id: string;
          campaign_id: string;
          gmail_message_id: string | null;
          gmail_thread_id: string | null;
          direction: 'inbound' | 'outbound';
          subject: string;
          body: string;
          status: 'draft' | 'approved' | 'sending' | 'sent' | 'failed' | 'received';
          idempotency_key: string;
          approved_at: string | null;
          sent_at: string | null;
          reply_classification:
            | 'interested'
            | 'not_interested'
            | 'out_of_office'
            | 'other'
            | 'needs_review'
            | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          campaign_id: string;
          gmail_message_id?: string | null;
          gmail_thread_id?: string | null;
          direction?: 'inbound' | 'outbound';
          subject: string;
          body: string;
          status?: 'draft' | 'approved' | 'sending' | 'sent' | 'failed' | 'received';
          idempotency_key?: string;
          approved_at?: string | null;
          sent_at?: string | null;
          reply_classification?:
            | 'interested'
            | 'not_interested'
            | 'out_of_office'
            | 'other'
            | 'needs_review'
            | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          campaign_id?: string;
          gmail_message_id?: string | null;
          gmail_thread_id?: string | null;
          direction?: 'inbound' | 'outbound';
          subject?: string;
          body?: string;
          status?: 'draft' | 'approved' | 'sending' | 'sent' | 'failed' | 'received';
          idempotency_key?: string;
          approved_at?: string | null;
          sent_at?: string | null;
          reply_classification?:
            | 'interested'
            | 'not_interested'
            | 'out_of_office'
            | 'other'
            | 'needs_review'
            | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      followup_schedules: {
        Row: {
          id: string;
          user_id: string;
          message_id: string;
          scheduled_at: string;
          skip_weekends: boolean;
          status: 'pending' | 'approved' | 'claimed' | 'completed' | 'cancelled' | 'failed';
          approved_at: string | null;
          claimed_at: string | null;
          idempotency_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          message_id: string;
          scheduled_at: string;
          skip_weekends?: boolean;
          status?: 'pending' | 'approved' | 'claimed' | 'completed' | 'cancelled' | 'failed';
          approved_at?: string | null;
          claimed_at?: string | null;
          idempotency_key?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          message_id?: string;
          scheduled_at?: string;
          skip_weekends?: boolean;
          status?: 'pending' | 'approved' | 'claimed' | 'completed' | 'cancelled' | 'failed';
          approved_at?: string | null;
          claimed_at?: string | null;
          idempotency_key?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agent_runs: {
        Row: {
          id: string;
          user_id: string;
          application_id: string | null;
          agent_kind: 'candidate' | 'outreach' | 'response';
          mode: 'mock' | 'live';
          status: 'pending' | 'completed' | 'failed';
          external_run_id: string | null;
          error_code: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          application_id?: string | null;
          agent_kind: 'candidate' | 'outreach' | 'response';
          mode: 'mock' | 'live';
          status?: 'pending' | 'completed' | 'failed';
          external_run_id?: string | null;
          error_code?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          application_id?: string | null;
          agent_kind?: 'candidate' | 'outreach' | 'response';
          mode?: 'mock' | 'live';
          status?: 'pending' | 'completed' | 'failed';
          external_run_id?: string | null;
          error_code?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
