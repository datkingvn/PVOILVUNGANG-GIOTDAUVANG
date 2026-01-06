/**
 * Round 3 game engine utilities
 */

import type { PendingAnswer } from "@/types/game";

/**
 * Calculate Round 3 score based on submission order
 * 1st correct answer: 40 points
 * 2nd correct answer: 30 points
 * 3rd correct answer: 20 points
 * 4th correct answer: 10 points
 * 5th and beyond: 0 points
 */
export function calculateRound3Score(submissionOrder: number): number {
  switch (submissionOrder) {
    case 1:
      return 40;
    case 2:
      return 30;
    case 3:
      return 20;
    case 4:
      return 10;
    default:
      return 0;
  }
}

/**
 * Sort answers by timestamp (earliest first)
 */
export function sortAnswersByTimestamp(answers: PendingAnswer[]): PendingAnswer[] {
  return [...answers].sort((a, b) => a.submittedAt - b.submittedAt);
}

/**
 * Get submission order of a team in a sorted list of correct answers
 * Returns 1-based order (1 = first, 2 = second, etc.)
 */
export function getSubmissionOrder(
  sortedCorrectAnswers: PendingAnswer[],
  teamId: string
): number {
  const index = sortedCorrectAnswers.findIndex((answer) => answer.teamId === teamId);
  return index === -1 ? 0 : index + 1;
}

/**
 * Normalize arrange answer (for comparison)
 * - Convert to uppercase
 * - Remove spaces
 * - Trim
 */
export function normalizeArrangeAnswer(answer: string): string {
  return answer.toUpperCase().replace(/\s+/g, "").trim();
}

