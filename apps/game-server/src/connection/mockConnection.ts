import type { ServerMessage } from "@thunder-uno/protocol";
import { createConnectionId } from "../ids/createConnectionId";
import type { MockServerConnection } from "./connectionTypes";

export interface CreateMockConnectionParams {
  connectionId?: string;
  userId: string;
}

/**
 * 测试阶段用它替代真实 socket。
 * send 只做一件事：把消息记到 sentMessages，方便断言广播结果。
 */
export function createMockConnection(
  params: CreateMockConnectionParams
): MockServerConnection {
  const sentMessages: ServerMessage[] = [];

  return {
    connectionId: params.connectionId ?? createConnectionId(),
    userId: params.userId,
    roomId: null,
    playerId: null,
    sentMessages,
    send(message) {
      sentMessages.push(message);
    }
  };
}
