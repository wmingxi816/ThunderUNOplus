import type { CardColor, CardKind, DrawValue } from "./card";
import type { CardId, PlayerId, TurnDirection } from "./common";
import type { GameState } from "./game";
import type { GameCommandType } from "./command";
import type { ErrorCode } from "./errors";

export const GAME_EVENT_TYPES = [
  "command-rejected",
  "cards-played",
  "cards-drawn",
  "normal-draw-offer-opened",
  "normal-draw-offer-kept",
  "turn-advanced",
  "draw-stack-updated",
  "draw-stack-cleared",
  "direction-changed",
  "draw-until-color-started",
  "draw-until-color-resolved",
  "challenge-window-opened",
  "challenge-resolved",
  "uno-pending",
  "uno-called",
  "uno-report-failed-protected",
  "uno-penalty-applied",
  "player-eliminated",
  "game-finished",
  "deck-reshuffled",
  "draw-pile-exhausted"
] as const;
export type GameEventType = (typeof GAME_EVENT_TYPES)[number];

export interface CommandRejectedEvent {
  type: "command-rejected";
  commandType: GameCommandType;
  playerId: PlayerId;
  code: ErrorCode;
  message: string;
}

export interface CardsPlayedEvent {
  type: "cards-played";
  playerId: PlayerId;
  cardIds: string[];
  topCardId: string;
  playPattern?: "single" | "sequence" | "multiple-number" | "discard-same-color";
  topCardKind?: CardKind;
  topCardDrawValue?: DrawValue;
  declaredColor?: CardColor;
}

export interface CardsDrawnEvent {
  type: "cards-drawn";
  playerId: PlayerId;
  count: number;
  reason:
    | "normal-draw"
    | "draw-stack"
    | "draw-until-color"
    | "challenge-penalty"
    | "uno-penalty";
  drawUntilColor?: {
    targetColor: CardColor;
    revealedColor: CardColor | null;
    matched: boolean;
  };
}

export interface NormalDrawOfferOpenedEvent {
  type: "normal-draw-offer-opened";
  playerId: PlayerId;
  cardId: string;
}

export interface NormalDrawOfferKeptEvent {
  type: "normal-draw-offer-kept";
  playerId: PlayerId;
  cardId: string;
}

export interface TurnAdvancedEvent {
  type: "turn-advanced";
  previousPlayerId: PlayerId;
  currentPlayerId: PlayerId;
}

export interface DrawStackUpdatedEvent {
  type: "draw-stack-updated";
  amount: number;
  targetPlayerId: PlayerId | null;
}

export interface DrawStackClearedEvent {
  type: "draw-stack-cleared";
  reason: "resolved" | "canceled-by-draw-ten";
  topCardId?: CardId;
}

export interface DirectionChangedEvent {
  type: "direction-changed";
  direction: TurnDirection;
}

export interface DrawUntilColorStartedEvent {
  type: "draw-until-color-started";
  targetPlayerId: PlayerId;
  color: CardColor;
}

export interface DrawUntilColorResolvedEvent {
  type: "draw-until-color-resolved";
  targetPlayerId: PlayerId;
  color: CardColor;
  drawnCount: number;
}

export interface ChallengeWindowOpenedEvent {
  type: "challenge-window-opened";
  targetPlayerId: PlayerId;
}

export interface ChallengeResolvedEvent {
  type: "challenge-resolved";
  challengerPlayerId: PlayerId;
  targetPlayerId: PlayerId;
  success: boolean;
  penaltyPlayerId: PlayerId;
  drawCount: number;
}

export interface UnoPendingEvent {
  type: "uno-pending";
  playerId: PlayerId;
}

export interface UnoCalledEvent {
  type: "uno-called";
  playerId: PlayerId;
}

export interface UnoReportFailedProtectedEvent {
  type: "uno-report-failed-protected";
  targetPlayerId: PlayerId;
  reporterPlayerId: PlayerId;
  protectionEndsAtMs: number | null;
}

export interface UnoPenaltyAppliedEvent {
  type: "uno-penalty-applied";
  targetPlayerId: PlayerId;
  reporterPlayerId: PlayerId;
  drawCount: number;
}

export interface PlayerEliminatedEvent {
  type: "player-eliminated";
  playerId: PlayerId;
  handCount: number;
  reason: "hand-limit";
}

export interface GameFinishedEvent {
  type: "game-finished";
  winnerPlayerIds: PlayerId[];
}

export interface DeckReshuffledEvent {
  type: "deck-reshuffled";
  recycledCardCount: number;
  newDrawPileCount: number;
  shuffleCounter: number;
}

export interface DrawPileExhaustedEvent {
  type: "draw-pile-exhausted";
  requestedCount: number;
  drawnCount: number;
}

export type GameEvent =
  | CommandRejectedEvent
  | CardsPlayedEvent
  | CardsDrawnEvent
  | NormalDrawOfferOpenedEvent
  | NormalDrawOfferKeptEvent
  | TurnAdvancedEvent
  | DrawStackUpdatedEvent
  | DrawStackClearedEvent
  | DirectionChangedEvent
  | DrawUntilColorStartedEvent
  | DrawUntilColorResolvedEvent
  | ChallengeWindowOpenedEvent
  | ChallengeResolvedEvent
  | UnoPendingEvent
  | UnoCalledEvent
  | UnoReportFailedProtectedEvent
  | UnoPenaltyAppliedEvent
  | PlayerEliminatedEvent
  | GameFinishedEvent
  | DeckReshuffledEvent
  | DrawPileExhaustedEvent;

export interface ApplyCommandResult {
  state: GameState;
  events: GameEvent[];
}
