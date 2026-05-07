import { describe, expect, it } from "vitest";
import {
  buildCommandMessage,
  buildContinueGameMessage,
  buildCreateRoomMessage,
  buildJoinRoomMessage,
  buildReconnectMessage,
  buildRestartGameMessage,
  buildSetReadyMessage
} from "./clientMessages";

describe("client message builders", () => {
  it("builds create-room messages for the web client", () => {
    const message = buildCreateRoomMessage({
      requestId: "req-create",
      userId: "user-1",
      nickname: "网页玩家",
      mode: "no-challenge"
    });

    expect(message).toMatchObject({
      type: "create-room",
      requestId: "req-create",
      userId: "user-1",
      nickname: "网页玩家",
      mode: "no-challenge"
    });
  });

  it("builds join-room messages", () => {
    const message = buildJoinRoomMessage({
      requestId: "req-join",
      roomId: "ROOM1",
      userId: "user-2",
      nickname: "加入者"
    });

    expect(message.roomId).toBe("ROOM1");
  });

  it("adds player identity to command messages", () => {
    const message = buildCommandMessage({
      requestId: "req-command",
      roomId: "ROOM1",
      playerId: "player-1",
      command: {
        type: "play-sequence",
        cardIds: ["c1", "c2", "c3", "c4", "c5"]
      }
    });

    expect(message.command).toMatchObject({
      type: "play-sequence",
      playerId: "player-1",
      cardIds: ["c1", "c2", "c3", "c4", "c5"]
    });
  });

  it("builds create-room messages with a custom room id", () => {
    const message = buildCreateRoomMessage({
      requestId: "req-create-custom",
      userId: "user-1",
      nickname: "网页玩家",
      mode: "no-challenge",
      roomId: "123456"
    });

    expect(message).toMatchObject({
      type: "create-room",
      roomId: "123456"
    });
  });

  it("builds reconnect messages with the stable web user identity", () => {
    const message = buildReconnectMessage({
      requestId: "req-reconnect",
      roomId: "ROOM1",
      userId: "web-user-1"
    });

    expect(message).toMatchObject({
      type: "reconnect",
      requestId: "req-reconnect",
      roomId: "ROOM1",
      userId: "web-user-1"
    });
  });

  it("builds ready messages", () => {
    const message = buildSetReadyMessage({
      requestId: "req-ready",
      roomId: "ROOM1",
      playerId: "player-2",
      ready: true
    });

    expect(message).toMatchObject({
      type: "set-ready",
      requestId: "req-ready",
      roomId: "ROOM1",
      playerId: "player-2",
      ready: true
    });
  });

  it("builds restart and continue game messages", () => {
    expect(
      buildRestartGameMessage({
        requestId: "req-restart",
        roomId: "ROOM1",
        playerId: "player-1"
      })
    ).toMatchObject({
      type: "restart-game",
      requestId: "req-restart",
      roomId: "ROOM1",
      playerId: "player-1"
    });

    expect(
      buildContinueGameMessage({
        requestId: "req-continue",
        roomId: "ROOM1",
        playerId: "player-1"
      })
    ).toMatchObject({
      type: "continue-game",
      requestId: "req-continue",
      roomId: "ROOM1",
      playerId: "player-1"
    });
  });
});
