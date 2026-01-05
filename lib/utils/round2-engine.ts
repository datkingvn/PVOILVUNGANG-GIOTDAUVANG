/**
 * Round 2 game engine utilities
 */

/**
 * Calculate CNV score based on opened clue count
 * After opening 1 piece: 80
 * After opening 2 pieces: 60
 * After opening 3 pieces: 40
 * After opening 4 pieces: 20
 */
export function calculateCNVScore(openedClueCount: number): number {
  switch (openedClueCount) {
    case 0:
      return 80; // Should not happen, but fallback
    case 1:
      return 80;
    case 2:
      return 60;
    case 3:
      return 40;
    case 4:
      return 20;
    default:
      return 20; // After 4 pieces, minimum score
  }
}

/**
 * Normalize answer text for comparison
 * - Convert to lowercase
 * - Remove Vietnamese accents/diacritics
 * - Trim whitespace
 * - Remove punctuation
 */
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,;:!?'"()\[\]{}]/g, "") // Remove punctuation
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/\s+/g, " "); // Normalize whitespace
}

/**
 * Suggest answer match type
 * Returns: "exact" | "near" | "no_match"
 */
export function suggestAnswerMatch(
  userAnswer: string,
  correctAnswer: string,
  acceptedAnswers?: string[]
): "exact" | "near" | "no_match" {
  const normalizedUser = normalizeAnswer(userAnswer);
  const normalizedCorrect = normalizeAnswer(correctAnswer);

  // Exact match
  if (normalizedUser === normalizedCorrect) {
    return "exact";
  }

  // Check accepted answers
  if (acceptedAnswers && acceptedAnswers.length > 0) {
    for (const accepted of acceptedAnswers) {
      if (normalizeAnswer(accepted) === normalizedUser) {
        return "exact";
      }
    }
  }

  // Near match: check if user answer contains correct answer or vice versa
  if (
    normalizedUser.includes(normalizedCorrect) ||
    normalizedCorrect.includes(normalizedUser)
  ) {
    // Check similarity (simple: if more than 70% characters match)
    const minLength = Math.min(normalizedUser.length, normalizedCorrect.length);
    const maxLength = Math.max(normalizedUser.length, normalizedCorrect.length);
    if (minLength / maxLength > 0.7) {
      return "near";
    }
  }

  return "no_match";
}

/**
 * Get next team in rotation
 * Skips eliminated teams
 */
export function getNextTeam(
  currentTeamId: string | undefined,
  teams: Array<{ teamId: string }>,
  eliminatedTeamIds: string[]
): string | null {
  if (teams.length === 0) {
    return null;
  }

  const activeTeams = teams.filter(
    (team) => !eliminatedTeamIds.includes(team.teamId)
  );

  if (activeTeams.length === 0) {
    return null;
  }

  if (!currentTeamId) {
    return activeTeams[0].teamId;
  }

  const currentIndex = activeTeams.findIndex(
    (team) => team.teamId === currentTeamId
  );

  if (currentIndex === -1) {
    return activeTeams[0].teamId;
  }

  const nextIndex = (currentIndex + 1) % activeTeams.length;
  return activeTeams[nextIndex].teamId;
}

/**
 * Count letters in answer (excluding spaces and punctuation)
 */
export function countLetters(answer: string): number {
  return normalizeAnswer(answer)
    .replace(/\s/g, "")
    .replace(/[^a-z0-9]/gi, "").length;
}

/**
 * Check if Round 2 is complete
 * Round 2 ends when:
 * - CNV is answered correctly
 * - All teams are eliminated
 */
export function checkRound2Complete(
  teams: Array<{ teamId: string }>,
  eliminatedTeamIds: string[]
): boolean {
  const activeTeams = teams.filter(
    (team) => !eliminatedTeamIds.includes(team.teamId)
  );
  return activeTeams.length === 0;
}


