export interface ShouldAutoStartRoundInput {
  roundId: string | undefined;
  messageCount: number;
  isLoading: boolean;
  isViewingHistory: boolean;
  isRoundDone: boolean;
  loadingRoundId: string | null;
  lastInitRoundId: string | null;
}

export function shouldAutoStartRound({
  roundId,
  messageCount,
  isLoading,
  isViewingHistory,
  isRoundDone,
  loadingRoundId,
  lastInitRoundId,
}: ShouldAutoStartRoundInput): boolean {
  if (!roundId) return false;
  if (messageCount > 0) return false;
  if (isLoading || isViewingHistory || isRoundDone) return false;
  if (loadingRoundId === roundId) return false;
  return lastInitRoundId !== roundId;
}
