import type { UIMessage } from 'ai';
import type { InterviewMessageMetadata, InterviewMessageRole } from '@/types/interview';

export type InterviewUIMessage = UIMessage & {
  metadata?: {
    interviewRole?: InterviewMessageRole;
    interviewMetadata?: InterviewMessageMetadata;
  };
};

interface DbInterviewMessage {
  id: string;
  role: InterviewMessageRole;
  content: string;
  metadata?: InterviewMessageMetadata | null;
}

function mapInterviewRoleToUiRole(role: InterviewMessageRole): UIMessage['role'] {
  if (role === 'interviewer') return 'assistant';
  if (role === 'candidate') return 'user';
  return 'system';
}

export function dbInterviewMessagesToUIMessages(dbMessages: DbInterviewMessage[]): InterviewUIMessage[] {
  return dbMessages.map((message) => ({
    id: message.id,
    role: mapInterviewRoleToUiRole(message.role),
    metadata: {
      interviewRole: message.role,
      interviewMetadata: message.metadata || {},
    },
    parts: [{ type: 'text', text: message.content }],
  }));
}

export function getInterviewRole(message: UIMessage): InterviewMessageRole | undefined {
  return (message as InterviewUIMessage).metadata?.interviewRole;
}
