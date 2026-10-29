import 'server-only';
import { z } from 'zod';
export const agentKinds = ['candidate', 'outreach', 'response'] as const;
export const agentInputSchema = z.object({
  kind: z.enum(agentKinds),
  context: z.string().trim().min(1).max(12000),
});
export const agentOutputSchema = z.object({
  mode: z.literal('mock'),
  agent: z.enum(agentKinds),
  summary: z.string(),
  requiresApproval: z.literal(true),
});
export type AgentInput = z.infer<typeof agentInputSchema>;
export type AgentOutput = z.infer<typeof agentOutputSchema>;
export interface AgentAdapter {
  run(input: AgentInput): Promise<AgentOutput>;
}
const summaries = {
  candidate: 'Sample profile analysis: review skills, work history, and eligibility before use.',
  outreach:
    'Sample draft: introduce your relevant experience and ask for a conversation. Review and personalize before approval.',
  response: 'Sample classification: human review required. No reply has been read or sent.',
};
export const mockAgent: AgentAdapter = {
  async run(input) {
    const parsed = agentInputSchema.parse(input);
    return agentOutputSchema.parse({
      mode: 'mock',
      agent: parsed.kind,
      summary: summaries[parsed.kind],
      requiresApproval: true,
    });
  },
};
export async function runAgent(input: AgentInput) {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEMO_MODE === 'false')
    throw new Error('External agent execution is not enabled');
  if (process.env.LYZR_MODE && process.env.LYZR_MODE !== 'mock')
    throw new Error('Live Lyzr adapter requires a verified API contract');
  return mockAgent.run(input);
}
