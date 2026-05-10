export const ERROR_CODES = {
  gameFinished: "GAME_FINISHED",
  playerNotFound: "PLAYER_NOT_FOUND",
  playerEliminated: "PLAYER_ELIMINATED",
  notCurrentPlayer: "NOT_CURRENT_PLAYER",
  cardNotFound: "CARD_NOT_FOUND",
  invalidCombination: "INVALID_COMBINATION",
  cardNotPlayable: "CARD_NOT_PLAYABLE",
  declaredColorRequired: "DECLARED_COLOR_REQUIRED",
  drawStackActive: "DRAW_STACK_ACTIVE",
  drawStackNotActive: "DRAW_STACK_NOT_ACTIVE",
  drawUntilColorActive: "DRAW_UNTIL_COLOR_ACTIVE",
  drawUntilColorNotActive: "DRAW_UNTIL_COLOR_NOT_ACTIVE",
  normalDrawDecisionRequired: "NORMAL_DRAW_DECISION_REQUIRED",
  normalDrawDecisionNotActive: "NORMAL_DRAW_DECISION_NOT_ACTIVE",
  initialDirectionChoiceRequired: "INITIAL_DIRECTION_CHOICE_REQUIRED",
  initialDirectionChoiceNotActive: "INITIAL_DIRECTION_CHOICE_NOT_ACTIVE",
  unoNotAvailable: "UNO_NOT_AVAILABLE",
  unoReportFailed: "UNO_REPORT_FAILED",
  challengeNotAvailable: "CHALLENGE_NOT_AVAILABLE"
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
