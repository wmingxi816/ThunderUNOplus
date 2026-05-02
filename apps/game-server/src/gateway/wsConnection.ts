import WebSocket from "ws";
import type { ServerMessage } from "@thunder-uno/protocol";
import type { ServerConnection } from "../connection/connectionTypes";

export interface WsConnection extends ServerConnection {
  raw: WebSocket;
}

/**
 * 真实 WebSocket 连接适配层。
 * 只要保持和 mockConnection 一样的 send 接口，Phase 3A 的连接注册表就能直接复用。
 */
export function createWsConnection(params: {
  connectionId: string;
  userId?: string;
  raw: WebSocket;
}): WsConnection {
  return {
    connectionId: params.connectionId,
    userId: params.userId ?? `guest-${params.connectionId}`,
    roomId: null,
    playerId: null,
    raw: params.raw,
    send(message: ServerMessage) {
      // WebSocket 已关闭或正在关闭时，发送直接忽略，避免未捕获异常打断服务。
      if (params.raw.readyState !== WebSocket.OPEN) {
        return;
      }

      try {
        params.raw.send(JSON.stringify(message));
      } catch {
        // Phase 3B 先做安全吞掉，后续接入日志系统时再统一记录。
      }
    }
  };
}
