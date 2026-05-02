import type { CardColor } from "./card";
import type { PlayerId, UnixMs } from "./common";

export const GAME_COMMAND_TYPES = [
  "play-card",
  "play-sequence",
  "play-multiple-number",
  "play-discard-same-color",
  "draw-card",
  "resolve-draw-stack",
  "resolve-draw-until-color",
  "say-uno",
  "report-uno",
  "challenge-draw"
] as const;
export type GameCommandType = (typeof GAME_COMMAND_TYPES)[number];

interface CommandBase<TType extends GameCommandType> {
  type: TType;
  playerId: PlayerId;
  timestampMs?: UnixMs;
}

export interface PlayCardCommand extends CommandBase<"play-card"> {
  cardId: string;
  declaredColor?: CardColor;
}

export interface PlaySequenceCommand extends CommandBase<"play-sequence"> {
  cardIds: string[];
}

export interface PlayMultipleNumberCommand
  extends CommandBase<"play-multiple-number"> {
  cardIds: string[];
}

export interface PlayDiscardSameColorCommand
  extends CommandBase<"play-discard-same-color"> {
  mainCardId: string;
  attachedCardIds: string[];
}

export interface DrawCardCommand extends CommandBase<"draw-card"> {}

export interface ResolveDrawStackCommand
  extends CommandBase<"resolve-draw-stack"> {}

export interface ResolveDrawUntilColorCommand
  extends CommandBase<"resolve-draw-until-color"> {}

export interface SayUnoCommand extends CommandBase<"say-uno"> {}

export interface ReportUnoCommand extends CommandBase<"report-uno"> {
  targetPlayerId: PlayerId;
}

export interface ChallengeDrawCommand extends CommandBase<"challenge-draw"> {
  targetPlayerId: PlayerId;
}

export type GameCommand =
  | PlayCardCommand
  | PlaySequenceCommand
  | PlayMultipleNumberCommand
  | PlayDiscardSameColorCommand
  | DrawCardCommand
  | ResolveDrawStackCommand
  | ResolveDrawUntilColorCommand
  | SayUnoCommand
  | ReportUnoCommand
  | ChallengeDrawCommand;
