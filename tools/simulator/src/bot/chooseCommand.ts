import {
  getNextActivePlayerId,
  type GameCommand,
  type GamePlayerState,
  type GameState
} from "@thunder-uno/uno-core";
import { chooseColor } from "./chooseColor";
import { findPlayableCard } from "./findPlayableCard";
import {
  findPlayableDiscardSameColor,
  type DiscardSameColorChoice
} from "./findPlayableDiscardSameColor";
import { findPlayableMultiple } from "./findPlayableMultiple";
import { findPlayableSequence } from "./findPlayableSequence";
import type { BotDecision } from "../simulationTypes";

/** 根据当前权威状态为当前玩家选择下一条命令。 */
export function chooseCommand(
  state: GameState,
  player: GamePlayerState
): BotDecision {
  if (state.drawUntilColor.active && state.drawUntilColor.targetPlayerId === player.id) {
    return {
      command: {
        type: "resolve-draw-until-color",
        playerId: player.id,
        timestampMs: state.now + 1000
      },
      reason: "resolve-draw-until-color"
    };
  }

  if (state.drawStack.active && state.drawStack.targetPlayerId === player.id) {
    const stackCard = findPlayableCard(state, player);

    if (stackCard !== null) {
      return {
        command: createPlayCardCommand(state, player, stackCard),
        reason: "stack-draw-card"
      };
    }

    return {
      command: {
        type: "resolve-draw-stack",
        playerId: player.id,
        timestampMs: state.now + 1000
      },
      reason: "resolve-draw-stack"
    };
  }

  const discardSameColorChoice = findPlayableDiscardSameColor(state, player);

  if (discardSameColorChoice !== null) {
    return {
      command: createDiscardSameColorCommand(state, player, discardSameColorChoice),
      reason: "play-discard-same-color"
    };
  }

  const sequenceCards = findPlayableSequence(state, player);

  if (sequenceCards !== null) {
    return {
      command: {
        type: "play-sequence",
        playerId: player.id,
        cardIds: sequenceCards.map((card) => card.id),
        timestampMs: state.now + 1000
      },
      reason: "play-sequence"
    };
  }

  const multipleCards = findPlayableMultiple(state, player);

  if (multipleCards !== null) {
    return {
      command: {
        type: "play-multiple-number",
        playerId: player.id,
        cardIds: multipleCards.map((card) => card.id),
        timestampMs: state.now + 1000
      },
      reason: "play-multiple-number"
    };
  }

  const singleCard = findPlayableCard(state, player);

  if (singleCard !== null) {
    return {
      command: createPlayCardCommand(state, player, singleCard),
      reason: "play-card"
    };
  }

  return {
    command: {
      type: "draw-card",
      playerId: player.id,
      timestampMs: state.now + 1000
    },
    reason: "draw-card"
  };
}

/** 找到一个可以执行质疑的玩家。 */
export function chooseChallengePlayerId(state: GameState): string | null {
  if (
    !state.challengeWindow.active ||
    state.challengeWindow.targetPlayerId === null
  ) {
    return null;
  }

  const currentPlayerCandidate = state.players.find(
    (player) => player.id === state.currentPlayerId
  );

  if (
    currentPlayerCandidate !== undefined &&
    !currentPlayerCandidate.isEliminated &&
    currentPlayerCandidate.id !== state.challengeWindow.targetPlayerId
  ) {
    return currentPlayerCandidate.id;
  }

  for (const playerId of state.playerOrder) {
    if (playerId === state.challengeWindow.targetPlayerId) {
      continue;
    }

    const player = state.players.find((candidate) => candidate.id === playerId);

    if (player !== undefined && !player.isEliminated) {
      return player.id;
    }
  }

  return null;
}

/** 选择一个可执行 report-uno 的举报者。 */
export function chooseUnoReporterId(
  state: GameState,
  targetPlayerId: string
): string | null {
  for (const playerId of state.playerOrder) {
    if (playerId === targetPlayerId) {
      continue;
    }

    const player = state.players.find((candidate) => candidate.id === playerId);

    if (player !== undefined && !player.isEliminated) {
      return player.id;
    }
  }

  return null;
}

/** 找到当前可以被揭发的 UNO 目标。 */
export function findReportableUnoTarget(
  state: GameState
): GamePlayerState | null {
  return (
    state.players.find((player) => {
      return (
        !player.isEliminated &&
        player.handCount === 1 &&
        !player.hasCalledUno &&
        player.unoPendingSinceMs !== null &&
        player.unoProtectionEndsAtMs !== null &&
        state.now >= player.unoProtectionEndsAtMs
      );
    }) ?? null
  );
}

/** 找到一个应该自动喊 UNO 的玩家。 */
export function findAutoUnoTarget(state: GameState): GamePlayerState | null {
  return (
    state.players.find((player) => {
      return (
        !player.isEliminated &&
        player.handCount === 1 &&
        !player.hasCalledUno &&
        player.unoPendingSinceMs !== null
      );
    }) ?? null
  );
}

function createPlayCardCommand(
  state: GameState,
  player: GamePlayerState,
  card: GamePlayerState["hand"][number]
): GameCommand {
  const declaredColor =
    card.isBlack ? chooseColor(player.hand.filter((item) => item.id !== card.id)) : undefined;

  return {
    type: "play-card",
    playerId: player.id,
    cardId: card.id,
    ...(declaredColor === undefined ? {} : { declaredColor }),
    timestampMs: state.now + 1000
  };
}

function createDiscardSameColorCommand(
  state: GameState,
  player: GamePlayerState,
  choice: DiscardSameColorChoice
): GameCommand {
  return {
    type: "play-discard-same-color",
    playerId: player.id,
    mainCardId: choice.mainCard.id,
    attachedCardIds: choice.attachedCards.map((card) => card.id),
    timestampMs: state.now + 1000
  };
}

/** 给日志层暴露一个轻量级“下一家”查询入口。 */
export function getExpectedNextPlayerId(state: GameState): string | null {
  return getNextActivePlayerId(state, state.currentPlayerId, 1);
}
