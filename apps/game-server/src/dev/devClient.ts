import { WebSocket } from "ws";
import { PROTOCOL_VERSION } from "@thunder-uno/protocol";

const wsUrl = process.env.WS_URL ?? "ws://localhost:8787";
const socket = new WebSocket(wsUrl);
let sawPong = false;
let sawRoomState = false;
let closedByClient = false;

const shutdownTimer = setTimeout(() => {
  console.error("[dev-client] timed out before receiving expected messages");
  closedByClient = true;
  socket.close();
}, 5000);

function tryFinish(): void {
  if (!sawPong || !sawRoomState) {
    return;
  }

  clearTimeout(shutdownTimer);
  closedByClient = true;
  socket.close();
}

socket.on("open", () => {
  console.log(`[dev-client] connected to ${wsUrl}`);

  socket.send(
    JSON.stringify({
      protocolVersion: PROTOCOL_VERSION,
      type: "ping",
      requestId: "req-ping-1",
      timestampMs: Date.now()
    })
  );

  socket.send(
    JSON.stringify({
      protocolVersion: PROTOCOL_VERSION,
      type: "create-room",
      requestId: "req-create-room-1",
      userId: "dev-user-001",
      nickname: "Dev Player",
      avatarUrl: null,
      mode: "no-challenge",
      timestampMs: Date.now()
    })
  );
});

socket.on("message", (data) => {
  const rawText = data.toString();
  console.log("[dev-client] message:", rawText);

  try {
    const message = JSON.parse(rawText) as { type?: string };

    if (message.type === "pong") {
      sawPong = true;
    }

    if (message.type === "room-state") {
      sawRoomState = true;
    }

    tryFinish();
  } catch {
    // 本地调试客户端只负责打印原始消息，不因为解析失败中断连接。
  }
});

socket.on("close", () => {
  console.log("[dev-client] disconnected");
  process.exit(closedByClient ? 0 : 1);
});

socket.on("error", (error) => {
  clearTimeout(shutdownTimer);
  console.error("[dev-client] error:", error);
  process.exit(1);
});
