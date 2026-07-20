export interface ScoringConfig {
  win: number;
  draw: number;
  loss: number;
  kill: number;
  mvp: number;
  tournamentVictory: number;
}

export interface RankingInput {
  wins: number;
  draws: number;
  losses: number;
  kills: number;
  mvpAwards: number;
  tournamentVictories: number;
  adjustment: number;
}

export function calculatePoints(
  input: RankingInput,
  config: ScoringConfig,
): number {
  return (
    input.wins * config.win +
    input.draws * config.draw +
    input.losses * config.loss +
    input.kills * config.kill +
    input.mvpAwards * config.mvp +
    input.tournamentVictories * config.tournamentVictory +
    input.adjustment
  );
}

export function rankMovement(
  currentRank: number,
  previousRank: number,
): number {
  return previousRank - currentRank;
}
