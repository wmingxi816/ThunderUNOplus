import type { GameState } from "../gameState";
import { clearChallengeWindow } from "./effects";
import { applyChallengeDrawCommand } from "./applyChallenge";
import { applyDrawCardCommand } from "./applyDrawCard";
import { applyKeepDrawnCardCommand } from "./applyKeepDrawnCard";
import { applyResolveDrawStackCommand } from "./applyDrawStack";
import { applyResolveDrawUntilColorCommand } from "./applyDrawUntilColor";
import {
  applyPlayCardCommand,
  applyPlayDiscardSameColorCommand,
  applyPlayMultipleNumberCommand,
  applyPlaySequenceCommand
} from "./applyPlayCard";
import { applyReportUnoCommand, applySayUnoCommand } from "./applyUno";
import { ERROR_CODES, rejectCommand } from "./errors";
import type {
  ApplyCommandResult,
  ChooseInitialDirectionCommand,
  GameCommand
} from "./types";

const TURN_COMPLETING_COMMANDS = new Set<GameCommand["type"]>([
  "play-card",
  "play-sequence",
  "play-multiple-number",
  "play-discard-same-color",
  "draw-card",
  "keep-drawn-card",
  "resolve-draw-stack",
  "resolve-draw-until-color"
]);

/** Phase 2B 的统一命令入口。 */
export function applyCommand(
  state: GameState,
  command: GameCommand
): ApplyCommandResult {
  const result = dispatchCommand(state, command);

  if (result.events.some((event) => event.type === "command-rejected")) {
    return result;
  }

  result.state.snapshotVersion += 1;
  maybeExpirePreviousChallengeWindow(state, result, command);

  return result;
}

function dispatchCommand(
  state: GameState,
  command: GameCommand
): ApplyCommandResult {
  if (state.initialDirectionChoice.active && command.type !== "choose-initial-direction") {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.initialDirectionChoiceRequired,
      "Initial turn direction must be chosen before taking actions."
    );
  }

  switch (command.type) {
    case "choose-initial-direction":
      return applyChooseInitialDirectionCommand(state, command);
    case "play-card":
      return applyPlayCardCommand(state, command);
    case "play-sequence":
      return applyPlaySequenceCommand(state, command);
    case "play-multiple-number":
      return applyPlayMultipleNumberCommand(state, command);
    case "play-discard-same-color":
      return applyPlayDiscardSameColorCommand(state, command);
    case "draw-card":
      return applyDrawCardCommand(state, command);
    case "keep-drawn-card":
      return applyKeepDrawnCardCommand(state, command);
    case "resolve-draw-stack":
      return applyResolveDrawStackCommand(state, command);
    case "resolve-draw-until-color":
      return applyResolveDrawUntilColorCommand(state, command);
    case "say-uno":
      return applySayUnoCommand(state, command);
    case "report-uno":
      return applyReportUnoCommand(state, command);
    case "challenge-draw":
      return applyChallengeDrawCommand(state, command);
    default: {
      const exhaustiveCheck: never = command;
      throw new Error(`Unsupported command: ${String(exhaustiveCheck)}`);
    }
  }
}

function applyChooseInitialDirectionCommand(
  state: GameState,
  command: ChooseInitialDirectionCommand
): ApplyCommandResult {
  if (!state.initialDirectionChoice.active) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.initialDirectionChoiceNotActive,
      "Initial turn direction has already been chosen."
    );
  }

  if (
    state.initialDirectionChoice.chooserPlayerId !== command.playerId ||
    state.currentPlayerId !== command.playerId
  ) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.notCurrentPlayer,
      "Only the first player can choose the initial turn direction."
    );
  }

  state.direction = command.direction;
  state.initialDirectionChoice = {
    active: false,
    chooserPlayerId: null
  };

  return {
    state,
    events: [
      {
        type: "direction-changed",
        direction: state.direction
      }
    ]
  };
}

/**
 * 质疑窗口是“上一位主动摸牌玩家”的临时保护信息。
 *
 * 一旦下一家完成自己的回合动作，这个窗口就应该自然失效；
 * 但如果下一家也主动摸牌并产生了新的质疑窗口，就保留新的那一个。
 */
function maybeExpirePreviousChallengeWindow(
  previousState: GameState,
  result: ApplyCommandResult,
  command: GameCommand
): void {
  if (
    !previousState.challengeWindow.active ||
    !previousState.challengeWindow.expiresWhenNextPlayerCompletesAction ||
    previousState.currentPlayerId !== command.playerId ||
    previousState.challengeWindow.targetPlayerId === command.playerId ||
    !TURN_COMPLETING_COMMANDS.has(command.type)
  ) {
    return;
  }

  const nextWindow = result.state.challengeWindow;
  const replacedByNewWindow =
    nextWindow.active &&
    nextWindow.targetPlayerId !== previousState.challengeWindow.targetPlayerId;

  if (!replacedByNewWindow) {
    clearChallengeWindow(result.state);
  }
}
