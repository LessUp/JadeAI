import { convertToModelMessages, type UIMessage } from 'ai';

const MAX_ROUNDS = 10;
export const MAX_CHAT_CONTEXT_MESSAGES = MAX_ROUNDS * 2;

export async function buildChatContextMessages(messages: UIMessage[]) {
  // Limit by UI turns first so tool-call + tool-result model messages stay intact.
  return convertToModelMessages(messages.slice(-MAX_CHAT_CONTEXT_MESSAGES));
}
