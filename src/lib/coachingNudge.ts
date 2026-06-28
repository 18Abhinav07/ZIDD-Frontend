import { ChatMessage } from '@/types';

export interface CoachingNudge {
  afterMessageId: string;
  text: string;
}

// How many consecutive AI messages without a student turn triggers a gap nudge
const GAP_THRESHOLD = 2;
// Word count ratio below which a brevity nudge fires (student < 50% of AI average)
const BREVITY_RATIO_THRESHOLD = 0.5;
// Min messages in window before brevity check activates (avoids false positives early on)
const BREVITY_WINDOW = 6;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function averageAiWordCount(messages: ChatMessage[], windowSize: number): number {
  const aiMessages = messages
    .slice(-windowSize)
    .filter((m) => m.role === 'assistant' && m.content);
  if (aiMessages.length === 0) return 0;
  return aiMessages.reduce((sum, m) => sum + wordCount(m.content), 0) / aiMessages.length;
}

/**
 * Returns a coaching nudge to display after a specific message, or null if
 * no nudge is warranted. Called after every new message lands.
 *
 * Two conditions:
 * 1. Gap: 2+ consecutive AI turns without a student contribution
 * 2. Brevity: student's last message is <50% the average AI message length
 */
export function getCoachingNudge(messages: ChatMessage[]): CoachingNudge | null {
  if (messages.length === 0) return null;

  // Count consecutive AI turns since the last user message
  let consecutiveAiTurns = 0;
  let lastUserMsgId: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant') {
      consecutiveAiTurns++;
    } else {
      lastUserMsgId = m.id;
      break;
    }
  }

  if (consecutiveAiTurns >= GAP_THRESHOLD && lastUserMsgId) {
    return {
      afterMessageId: lastUserMsgId,
      text: "Two rounds have passed — jump in. Even one clear claim is enough to shift the discussion.",
    };
  }

  // Brevity check: only if the last message is from the student
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role !== 'user') return null;

  if (messages.length >= BREVITY_WINDOW) {
    const avgAi = averageAiWordCount(messages, BREVITY_WINDOW);
    const userWords = wordCount(lastMsg.content);
    if (avgAi > 0 && userWords / avgAi < BREVITY_RATIO_THRESHOLD) {
      return {
        afterMessageId: lastMsg.id,
        text: "Good start — can you back that up with a specific example or challenge one of their points?",
      };
    }
  }

  return null;
}
