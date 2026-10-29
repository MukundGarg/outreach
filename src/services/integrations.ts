import type { CandidateProfile } from '@/lib/domain';
export type DisabledResult = { enabled: false; reason: string };
export const integrationStatus: DisabledResult = {
  enabled: false,
  reason: 'Not enabled in the MVP foundation. No external action will be performed.',
};
export interface GmailIntegration {
  connect(): Promise<DisabledResult>;
  send(input: {
    draftId: string;
    approvalId: string;
    idempotencyKey: string;
  }): Promise<DisabledResult>;
  readThread(threadId: string): Promise<DisabledResult>;
}
export interface FormAssistance {
  prepare(url: string, profile: CandidateProfile): Promise<DisabledResult>;
  submit(approvalId: string, idempotencyKey: string): Promise<DisabledResult>;
}
export interface ResumeExtractor {
  extract(storagePath: string): Promise<DisabledResult>;
}
export interface FollowupScheduler {
  schedule(messageId: string, at: string, approvalId: string): Promise<DisabledResult>;
}
export interface ReplyClassifier {
  classify(messageId: string): Promise<DisabledResult>;
}
