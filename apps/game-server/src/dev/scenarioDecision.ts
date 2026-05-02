import type {
  Card,
  CardColor,
  PlayerGameSnapshot,
  PlayerId,
  PlayerRoomSnapshot
} from "@thunder-uno/shared-types";
import type {
  PlayableCardChoice,
  PublicScenarioPlayerState,
  ScenarioDecision
} from "./scenarioTypes";

/**
 * 这里的决策逻辑故意只依赖玩家快照和房间快照。
 * 它不是权威规则，只是一个“尽量别发错命令”的本地机器人。
 * 最终是否合法仍由服务端和 uno-core 兜底。
 */

export function chooseTurnDecision(
  snapshot: PlayerGameSnapshot,
  nowMs: number
): ScenarioDecision {
  if (
    snapshot.drawUntilColor.active &&
    snapshot.drawUntilColor.targetPlayerId === snapshot.self.playerId
  ) {
    return {
      command: {
        type: "resolve-draw-until-color",
        playerId: snapshot.self.playerId,
        timestampMs: nowMs
      },
      summary: "resolve-draw-until-color"
    };
  }

  if (
    snapshot.drawStack.active &&
    snapshot.drawStack.targetPlayerId === snapshot.self.playerId
  ) {
    const stackCard = findStackableDrawCard(snapshot);

    if (stackCard !== null) {
      return {
        command: createPlayCardCommand(snapshot, stackCard, nowMs),
        summary: `stack ${stackCard.card.displayName}`
      };
    }

    return {
      command: {
        type: "resolve-draw-stack",
        playerId: snapshot.self.playerId,
        timestampMs: nowMs
      },
      summary: "resolve-draw-stack"
    };
  }

  const playableCard = findFirstLikelyPlayableCard(snapshot);

  if (playableCard !== null) {
    return {
      command: createPlayCardCommand(snapshot, playableCard, nowMs),
      summary: `play ${playableCard.card.displayName}`
    };
  }

  return {
    command: {
      type: "draw-card",
      playerId: snapshot.self.playerId,
      timestampMs: nowMs
    },
    summary: "draw-card"
  };
}

export function chooseAutoUnoDecision(
  playerId: PlayerId,
  nowMs: number
): ScenarioDecision {
  return {
    command: {
      type: "say-uno",
      playerId,
      timestampMs: nowMs
    },
    summary: "say-uno"
  };
}

export function chooseReportUnoDecision(
  reporterPlayerId: PlayerId,
  targetPlayerId: PlayerId,
  nowMs: number
): ScenarioDecision {
  return {
    command: {
      type: "report-uno",
      playerId: reporterPlayerId,
      targetPlayerId,
      timestampMs: nowMs
    },
    summary: `report-uno target=${targetPlayerId}`
  };
}

export function chooseChallengeDecision(
  challengerPlayerId: PlayerId,
  targetPlayerId: PlayerId,
  nowMs: number
): ScenarioDecision {
  return {
    command: {
      type: "challenge-draw",
      playerId: challengerPlayerId,
      targetPlayerId,
      timestampMs: nowMs
    },
    summary: `challenge-draw target=${targetPlayerId}`
  };
}

export function mergePublicPlayerStates(params: {
  snapshots: PlayerGameSnapshot[];
  roomSnapshots: PlayerRoomSnapshot[];
}): Map<PlayerId, PublicScenarioPlayerState> {
  const players = new Map<PlayerId, PublicScenarioPlayerState>();

  for (const snapshot of params.snapshots) {
    players.set(snapshot.self.playerId, {
      playerId: snapshot.self.playerId,
      handCount: snapshot.self.handCount,
      hasCalledUno: snapshot.self.hasCalledUno,
      isEliminated: snapshot.self.isEliminated,
      isCurrentPlayer: snapshot.self.isCurrentPlayer
    });

    for (const opponent of snapshot.opponents) {
      players.set(opponent.playerId, {
        playerId: opponent.playerId,
        handCount: opponent.handCount,
        hasCalledUno: opponent.hasCalledUno,
        isEliminated: opponent.isEliminated,
        isCurrentPlayer: opponent.isCurrentPlayer
      });
    }
  }

  for (const roomSnapshot of params.roomSnapshots) {
    for (const roomPlayer of roomSnapshot.players) {
      const existing = players.get(roomPlayer.playerId);

      if (existing === undefined) {
        players.set(roomPlayer.playerId, {
          playerId: roomPlayer.playerId,
          handCount: 0,
          hasCalledUno: false,
          isEliminated: false,
          isCurrentPlayer: false,
          seatIndex: roomPlayer.seatIndex,
          connectionStatus: roomPlayer.connectionStatus
        });
        continue;
      }

      existing.seatIndex = roomPlayer.seatIndex;
      existing.connectionStatus = roomPlayer.connectionStatus;
    }
  }

  return players;
}

export function findUnoReporterPlayerId(
  players: Map<PlayerId, PublicScenarioPlayerState>,
  targetPlayerId: PlayerId
): PlayerId | null {
  for (const player of players.values()) {
    if (
      player.playerId !== targetPlayerId &&
      !player.isEliminated &&
      player.connectionStatus !== "disconnected"
    ) {
      return player.playerId;
    }
  }

  return null;
}

export function findChallengePlayerId(
  players: Map<PlayerId, PublicScenarioPlayerState>,
  currentPlayerId: PlayerId,
  targetPlayerId: PlayerId
): PlayerId | null {
  const currentPlayer = players.get(currentPlayerId);

  if (
    currentPlayer !== undefined &&
    currentPlayer.playerId !== targetPlayerId &&
    !currentPlayer.isEliminated &&
    currentPlayer.connectionStatus !== "disconnected"
  ) {
    return currentPlayer.playerId;
  }

  for (const player of players.values()) {
    if (
      player.playerId !== targetPlayerId &&
      !player.isEliminated &&
      player.connectionStatus !== "disconnected"
    ) {
      return player.playerId;
    }
  }

  return null;
}

function findFirstLikelyPlayableCard(
  snapshot: PlayerGameSnapshot
): PlayableCardChoice | null {
  const coloredCards = snapshot.self.hand.filter((card) => !card.isBlack);
  const blackCards = snapshot.self.hand.filter((card) => card.isBlack);

  for (const card of [...coloredCards, ...blackCards]) {
    if (isLikelyPlayableCard(snapshot, card)) {
      return createPlayableCardChoice(snapshot, card);
    }
  }

  return null;
}

function findStackableDrawCard(
  snapshot: PlayerGameSnapshot
): PlayableCardChoice | null {
  for (const card of snapshot.self.hand) {
    if (!isDrawCard(card)) {
      continue;
    }

    if (card.isBlack) {
      return createPlayableCardChoice(snapshot, card);
    }

    if (card.color === snapshot.currentColor) {
      return createPlayableCardChoice(snapshot, card);
    }

    if (
      typeof card.drawValue === "number" &&
      typeof snapshot.topCard.drawValue === "number" &&
      card.drawValue === snapshot.topCard.drawValue
    ) {
      return createPlayableCardChoice(snapshot, card);
    }
  }

  return null;
}

function isLikelyPlayableCard(
  snapshot: PlayerGameSnapshot,
  card: Card
): boolean {
  if (card.isBlack) {
    return true;
  }

  if (card.color === snapshot.currentColor) {
    return true;
  }

  if (card.kind === "number" && snapshot.topCard.kind === "number") {
    return card.number === snapshot.topCard.number;
  }

  return false;
}

function isDrawCard(card: Card): boolean {
  return typeof card.drawValue === "number";
}

function createPlayableCardChoice(
  snapshot: PlayerGameSnapshot,
  card: Card
): PlayableCardChoice {
  if (!card.isBlack) {
    return { card };
  }

  return {
    card,
    declaredColor: chooseDeclaredColor(
      snapshot.self.hand.filter((candidate) => candidate.id !== card.id)
    )
  };
}

function createPlayCardCommand(
  snapshot: PlayerGameSnapshot,
  choice: PlayableCardChoice,
  nowMs: number
): ScenarioDecision["command"] {
  return {
    type: "play-card",
    playerId: snapshot.self.playerId,
    cardId: choice.card.id,
    ...(choice.declaredColor === undefined
      ? {}
      : { declaredColor: choice.declaredColor }),
    timestampMs: nowMs
  };
}

function chooseDeclaredColor(cards: Card[]): CardColor {
  const counts = new Map<CardColor, number>([
    ["red", 0],
    ["yellow", 0],
    ["blue", 0],
    ["green", 0]
  ]);

  for (const card of cards) {
    if (card.color === undefined) {
      continue;
    }

    counts.set(card.color, (counts.get(card.color) ?? 0) + 1);
  }

  let bestColor: CardColor = "red";
  let bestCount = -1;

  for (const [color, count] of counts) {
    if (count > bestCount) {
      bestColor = color;
      bestCount = count;
    }
  }

  return bestColor;
}
