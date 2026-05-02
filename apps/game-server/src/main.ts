import { ConnectionRegistry } from "./connection/connectionRegistry";
import { RoomManager } from "./room/roomManager";

/**
 * Phase 3A 先只组装“内存中的服务端脑子”。
 * 这里不接 WebSocket，只暴露房间管理和连接注册两个核心部件。
 */
export function createInMemoryGameServer() {
  const connectionRegistry = new ConnectionRegistry();
  const roomManager = new RoomManager({
    connectionRegistry
  });

  return {
    connectionRegistry,
    roomManager
  };
}
