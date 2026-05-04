/**
 * 对局运行时状态模型的本地导出入口。
 *
 * Phase 2C 开始，稳定的状态类型统一收敛到 shared-types。
 * uno-core 继续通过这个文件做二次导出，避免外层调用方大面积改路径。
 */
export {
  GAME_MODES,
  GAME_STATUSES,
  PLAYER_ELIMINATION_REASONS,
  TURN_DIRECTIONS,
  type ChallengeWindowState,
  type CreateInitialGameParams,
  type DrawStackState,
  type DrawUntilColorState,
  type GameMode,
  type GameState,
  type GameStatus,
  type NormalDrawOfferState,
  type PublicChallengeWindowState,
  type TurnDirection
} from "@thunder-uno/shared-types";

export type {
  GamePlayerState,
  InitialGamePlayerInput,
  PlayerEliminationReason
} from "@thunder-uno/shared-types";
