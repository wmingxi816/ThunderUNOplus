import {
  PROTOCOL_VERSION,
  type ClientPingMessage,
  type ServerPongMessage
} from "@thunder-uno/protocol";
import type { ServerConnection } from "../connection/connectionTypes";

export function createPongMessage(
  requestId: string,
  timestampMs: number
): ServerPongMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "pong",
    requestId,
    timestampMs
  };
}

/**
 * 第一版心跳先只支持“客户端 ping -> 服务端 pong”。
 * 这样本地 dev client 和集成测试已经足够验证连接活性。
 */
export function handlePing(
  connection: ServerConnection,
  message: ClientPingMessage
): ServerPongMessage {
  const pong = createPongMessage(message.requestId, message.timestampMs);
  connection.send(pong);
  return pong;
}
