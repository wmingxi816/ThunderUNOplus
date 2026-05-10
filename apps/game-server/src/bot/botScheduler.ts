import { PROTOCOL_VERSION, type ClientCommandMessage } from "@thunder-uno/protocol";
import type { GameCommand, PlayerId, RoomId } from "@thunder-uno/shared-types";
import { ConnectionRegistry } from "../connection/connectionRegistry";
import { dispatchCommand } from "../dispatch/dispatchCommand";
import { RoomManager } from "../room/roomManager";
import type { RoomRuntime } from "../room/roomTypes";
import { decideGreedyBotAction } from "./greedyBot";

const BOT_THINK_MS = 3_000;
const BOT_DRAW_THINK_MIN_MS = 2_000;
const BOT_DRAW_THINK_MAX_MS = 4_000;

interface BotTimer {
  roomId: RoomId;
  playerId: PlayerId;
  snapshotVersion: number;
  timer: ReturnType<typeof setTimeout>;
}

export interface BotSchedulerOptions {
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
  thinkMs?: number;
  drawThinkMs?: number;
  drawThinkMinMs?: number;
  drawThinkMaxMs?: number;
  random?: () => number;
}

export class BotScheduler {
  private readonly roomManager: RoomManager;
  private readonly connectionRegistry: ConnectionRegistry;
  private readonly thinkMs: number;
  private readonly fixedDrawThinkMs: number | null;
  private readonly drawThinkMinMs: number;
  private readonly drawThinkMaxMs: number;
  private readonly random: () => number;
  private readonly timers = new Map<RoomId, BotTimer>();

  constructor(options: BotSchedulerOptions) {
    this.roomManager = options.roomManager;
    this.connectionRegistry = options.connectionRegistry;
    this.thinkMs = options.thinkMs ?? BOT_THINK_MS;
    this.fixedDrawThinkMs = options.drawThinkMs ?? null;
    this.drawThinkMinMs = options.drawThinkMinMs ?? BOT_DRAW_THINK_MIN_MS;
    this.drawThinkMaxMs = options.drawThinkMaxMs ?? BOT_DRAW_THINK_MAX_MS;
    this.random = options.random ?? Math.random;
  }

  scheduleRoom(roomId: RoomId, delayMs = this.thinkMs): void {
    const room = this.roomManager.getRoom(roomId);

    if (room === null || room.gameState === null) {
      this.clearRoom(roomId);
      return;
    }

    const botPlayer = this.getCurrentBotPlayer(room);

    if (botPlayer === null) {
      this.clearRoom(roomId);
      return;
    }

    const existingTimer = this.timers.get(roomId);
    if (
      existingTimer !== undefined &&
      existingTimer.playerId === botPlayer.playerId &&
      existingTimer.snapshotVersion === room.snapshotVersion
    ) {
      return;
    }

    this.clearRoom(roomId);

    const timer = setTimeout(() => {
      this.executeScheduledTurn(roomId, botPlayer.playerId, room.snapshotVersion);
    }, delayMs);

    this.timers.set(roomId, {
      roomId,
      playerId: botPlayer.playerId,
      snapshotVersion: room.snapshotVersion,
      timer
    });
  }

  clearRoom(roomId: RoomId): void {
    const existingTimer = this.timers.get(roomId);

    if (existingTimer === undefined) {
      return;
    }

    clearTimeout(existingTimer.timer);
    this.timers.delete(roomId);
  }

  dispose(): void {
    for (const roomId of this.timers.keys()) {
      this.clearRoom(roomId);
    }
  }

  private executeScheduledTurn(
    roomId: RoomId,
    playerId: PlayerId,
    snapshotVersion: number
  ): void {
    this.timers.delete(roomId);

    const room = this.roomManager.getRoom(roomId);

    if (room === null || room.gameState === null) {
      return;
    }

    const botPlayer = this.getCurrentBotPlayer(room);

    if (
      botPlayer === null ||
      botPlayer.playerId !== playerId ||
      room.snapshotVersion !== snapshotVersion
    ) {
      this.scheduleRoom(roomId);
      return;
    }

    if (room.gameState.initialDirectionChoice?.active === true) {
      this.dispatchBotCommand(roomId, playerId, {
        type: "choose-initial-direction",
        playerId,
        direction: this.random() < 0.5 ? "clockwise" : "counter-clockwise"
      });
      this.scheduleRoom(roomId, this.thinkMs);
      return;
    }

    const decision = decideGreedyBotAction({
      state: room.gameState,
      playerId,
      forgetUnoRate: botPlayer.botProfile?.forgetUnoRate ?? 0.2,
      random: this.random
    });

    if (decision === null) {
      return;
    }

    const result = this.dispatchBotCommand(roomId, playerId, decision.command);

    if (result.room !== null && decision.willCallUno) {
      const refreshedBot = result.room.gameState?.players.find(
        (player) => player.id === playerId
      );

      if (
        refreshedBot !== undefined &&
        refreshedBot.handCount === 1 &&
        refreshedBot.unoPendingSinceMs !== null &&
        !refreshedBot.hasCalledUno
      ) {
        this.dispatchBotCommand(roomId, playerId, {
          type: "say-uno",
          playerId
        });
      }
    }

    this.scheduleRoom(
      roomId,
      isBotDrawLikeCommand(decision.command) ? this.getDrawThinkDelayMs() : this.thinkMs
    );
  }

  private getDrawThinkDelayMs(): number {
    if (this.fixedDrawThinkMs !== null) {
      return this.fixedDrawThinkMs;
    }

    const minMs = Math.min(this.drawThinkMinMs, this.drawThinkMaxMs);
    const maxMs = Math.max(this.drawThinkMinMs, this.drawThinkMaxMs);

    return Math.round(minMs + this.random() * (maxMs - minMs));
  }

  private dispatchBotCommand(
    roomId: RoomId,
    playerId: PlayerId,
    command: GameCommand
  ) {
    return dispatchCommand({
      roomManager: this.roomManager,
      connectionRegistry: this.connectionRegistry,
      message: {
        protocolVersion: PROTOCOL_VERSION,
        type: "command",
        requestId: `bot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        roomId,
        playerId,
        command: {
          ...command,
          playerId,
          timestampMs: Date.now()
        },
        timestampMs: Date.now()
      } satisfies ClientCommandMessage
    });
  }

  private getCurrentBotPlayer(room: RoomRuntime) {
    if (
      room.status !== "playing" ||
      room.gameState === null ||
      room.gameState.status === "finished"
    ) {
      return null;
    }

    const currentPlayerId = room.gameState.currentPlayerId;
    const roomPlayer = room.players.find((player) => player.playerId === currentPlayerId);
    const gamePlayer = room.gameState.players.find((player) => player.id === currentPlayerId);

    if (
      roomPlayer === undefined ||
      gamePlayer === undefined ||
      !roomPlayer.isBot ||
      gamePlayer.isEliminated ||
      gamePlayer.isRoundWinner ||
      gamePlayer.hasLeftRoom
    ) {
      return null;
    }

    return roomPlayer;
  }
}

function isBotDrawLikeCommand(command: GameCommand): boolean {
  return (
    command.type === "draw-card" ||
    command.type === "resolve-draw-stack" ||
    command.type === "resolve-draw-until-color" ||
    command.type === "keep-drawn-card"
  );
}
