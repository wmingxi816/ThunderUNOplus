# 雷霆UNOplus 第三阶段 A 交付清单 2.4.0

## 阶段目标

本阶段完成 `apps/game-server` 的内存房间服务层，实现：

- 房间创建
- 加入房间
- 离开房间
- 房主开局
- 内存连接注册表
- 命令分发
- 事件广播
- 玩家视角快照广播

本阶段仍然不实现：

- 真实 WebSocket
- 微信登录
- 数据库
- 事件持久化
- 回放系统
- Cocos UI

---

## 本次完成内容

### 1. game-server 包结构

已新增：

- `apps/game-server/tsconfig.build.json`
- `apps/game-server/src/main.ts`
- `apps/game-server/src/ids/createRoomId.ts`
- `apps/game-server/src/ids/createPlayerId.ts`
- `apps/game-server/src/ids/createConnectionId.ts`
- `apps/game-server/src/ids/createRequestId.ts`
- `apps/game-server/src/connection/connectionTypes.ts`
- `apps/game-server/src/connection/connectionRegistry.ts`
- `apps/game-server/src/connection/mockConnection.ts`
- `apps/game-server/src/room/roomTypes.ts`
- `apps/game-server/src/room/roomManager.ts`
- `apps/game-server/src/broadcast/createRoomSnapshot.ts`
- `apps/game-server/src/broadcast/broadcastRoomState.ts`
- `apps/game-server/src/broadcast/broadcastEvents.ts`
- `apps/game-server/src/broadcast/sendSnapshotsToRoom.ts`
- `apps/game-server/src/dispatch/dispatchCommand.ts`
- `apps/game-server/src/errors/serverErrors.ts`

并更新：

- `apps/game-server/package.json`
- `apps/game-server/src/index.ts`

---

### 2. RoomRuntime 与 ServerRoomPlayer

当前服务端内部类型：

- `RoomRuntime.status` 使用 `waiting / playing / finished`
- `ServerRoomPlayer` 记录 `userId / playerId / connectionId / seatIndex / connected`

这里和协议层快照故意分层：

- `RoomRuntime` 只给服务端自己用
- 发给客户端时，统一转成 `packages/protocol` 的 `SnapshotEnvelope`

房间状态映射策略：

- `waiting -> lobby`
- `playing -> playing`
- `finished -> settled`

---

### 3. ConnectionRegistry

当前已支持：

- `registerConnection`
- `unregisterConnection`
- `bindPlayer`
- `unbindConnection`
- `getConnection`
- `getConnectionByPlayerId`
- `getConnectionsByRoomId`
- `sendToPlayer`
- `sendToRoom`

并实现了 `mockConnection`：

- 不接真实 socket
- `send(message)` 只把消息记入 `sentMessages`
- 方便测试断言广播结果

---

### 4. RoomManager

当前已支持：

- `createRoom`
- `joinRoom`
- `leaveRoom`
- `startGame`
- `getRoom`
- `deleteRoom`
- `listRooms`

关键策略：

- `roomId` 为 6 位数字字符串
- 同一个 `userId` 在同一房间重复 `joinRoom` 时视为重连，不新增玩家
- waiting 状态下离开房间会真正移除玩家，并重新整理 `seatIndex`
- waiting 状态下房主离开时，房主转交给当前 `seatIndex` 最小的剩余玩家
- playing 状态下离开房间只标记断开，不移除玩家，为后续断线重连预留恢复点
- `startGame` 只允许房主触发，并直接调用 `createInitialGame`

---

### 5. dispatchCommand

当前命令链路：

```txt
ClientCommandMessage
-> 找到 room
-> 校验 room / gameState / playerId
-> 调用 uno-core.applyCommand
-> 更新 room.gameState 与 snapshotVersion
-> 广播 events
-> 给每位在线玩家发送裁剪后的 snapshot
```

规则边界保持严格：

- `game-server` 不重写规则
- 合法性只由 `uno-core.applyCommand` 判断
- 服务端只做身份校验、状态保存和广播

特殊处理：

- 如果 `applyCommand` 返回 `command-rejected`
- 服务端不会崩溃
- 该事件只回给请求玩家
- 不会把错误出牌广播给整房间

---

### 6. 广播与快照

已实现：

- `broadcastEvents`
- `sendSnapshotsToRoom`
- `broadcastRoomState`
- `createRoomSnapshot`

保证：

- lobby 使用房间快照
- playing 使用玩家视角对局快照
- 每位玩家收到的对局 snapshot 都是独立裁剪版本
- 不泄漏其他玩家手牌
- 不泄漏 `challengeWindow.hadBlackCardBeforeDraw`
- 不泄漏完整 `drawPile`

---

### 7. 服务端错误码

本阶段扩展了协议错误码，新增：

- `room-not-waiting`
- `room-not-playing`
- `room-full`
- `player-not-in-room`
- `not-room-owner`
- `game-not-started`
- `game-already-started`
- `invalid-player-count`
- `player-id-mismatch`
- `connection-not-found`

并在 `apps/game-server/src/errors/serverErrors.ts` 中统一封装成：

- `GameServerError`
- `createServerErrorMessage`

---

### 8. 测试补齐

已新增测试：

- `apps/game-server/src/tests/roomManager.test.ts`
- `apps/game-server/src/tests/connectionRegistry.test.ts`
- `apps/game-server/src/tests/dispatchCommand.test.ts`
- `apps/game-server/src/tests/broadcast.test.ts`

覆盖内容包括：

- RoomManager 12 条行为
- ConnectionRegistry 5 条行为
- dispatchCommand 10 条行为
- broadcast / snapshot 6 条行为

重点覆盖了：

- 8 人满房限制
- 同 userId 重连
- 非房主不能开局
- 开局后 `room.status` 与 `gameState`
- `snapshotVersion` 递增
- 合法 command 的 event / snapshot 广播
- `command-rejected` 不崩溃且只回请求玩家
- 玩家视角 snapshot 隐私裁剪

---

## 本地验证结果

已实际运行并通过：

```bash
pnpm --filter @thunder-uno/game-server test
pnpm --filter @thunder-uno/game-server typecheck
pnpm typecheck
pnpm test
```

当前结果：

- `game-server` typecheck 通过
- `game-server` `4` 个测试文件、`33` 个测试全部通过
- 根目录 `typecheck` 通过
- 根目录 `test` 通过

---

## 当前仍未完成的内容

- 还没有接真实 WebSocket
- 还没有实现 message handler
- 还没有做 heartbeat
- 还没有做 reconnect 协议
- 还没有做数据库和事件持久化
- 还没有做客户端 Cocos UI

---

## 下一阶段建议

1. 进入 Phase 3B，接入真实 WebSocket
2. 增加 `connect / disconnect / reconnect` 生命周期
3. 增加 `create-room / join-room / start-game / leave-room / command` 消息处理器
4. 把 `mockConnection` 平滑替换成真实连接适配层
