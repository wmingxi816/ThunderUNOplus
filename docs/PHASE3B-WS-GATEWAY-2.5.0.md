# 雷霆UNOplus 第三阶段 B 交付清单 2.5.0

## 阶段目标

本阶段把 Phase 3A 的内存房间服务层接到真实 WebSocket 上，完成本地开发闭环：

- 启动 WebSocket server
- 用真实连接替换 `mockConnection`
- 处理 `create-room / join-room / start-game / leave-room / command / ping / reconnect`
- 支持 disconnect / reconnect
- 提供本地 `dev` 服务和 `dev:client` 联调脚本
- 补齐 WebSocket 集成测试

本阶段仍然不实现：

- Cocos UI
- 微信登录
- 数据库
- 事件持久化
- 回放系统
- 线上部署

---

## 本次新增和修改的核心文件

### 协议层

- `packages/protocol/src/messages.ts`
- `packages/protocol/src/messages.test.ts`
- `packages/protocol/package.json`

### game-server 代码

- `apps/game-server/package.json`
- `apps/game-server/tsconfig.json`
- `apps/game-server/src/gateway/wsServer.ts`
- `apps/game-server/src/gateway/wsConnection.ts`
- `apps/game-server/src/gateway/messageHandler.ts`
- `apps/game-server/src/gateway/parseMessage.ts`
- `apps/game-server/src/gateway/heartbeat.ts`
- `apps/game-server/src/gateway/lifecycle.ts`
- `apps/game-server/src/dev/runLocalServer.ts`
- `apps/game-server/src/dev/devClient.ts`
- `apps/game-server/src/broadcast/broadcastRoomState.ts`
- `apps/game-server/src/broadcast/sendSnapshotsToRoom.ts`
- `apps/game-server/src/errors/serverErrors.ts`
- `apps/game-server/src/room/roomTypes.ts`
- `apps/game-server/src/room/roomManager.ts`
- `apps/game-server/src/index.ts`

### 测试

- `apps/game-server/src/tests/broadcast.test.ts`
- `apps/game-server/src/tests/messageHandler.test.ts`
- `apps/game-server/src/tests/wsServer.test.ts`
- `apps/game-server/src/tests/reconnect.test.ts`
- `apps/game-server/src/tests/wsTestUtils.ts`

### 文档

- `README.md`
- `docs/PROTOCOL.md`
- `docs/PHASE3B-WS-GATEWAY-2.5.0.md`
- `package.json`

---

## 关键实现

### 1. WebSocket Server

入口：

- `apps/game-server/src/gateway/wsServer.ts`

职责：

- 启动 `ws` 服务
- 为每个连接生成 `connectionId`
- 包装成 `WsConnection`
- 注册到 `ConnectionRegistry`
- 监听 `message / close / error`
- 转发给 `messageHandler`

默认端口：

- `8787`

也支持：

- `PORT=8791 corepack pnpm --filter @thunder-uno/game-server dev`

---

### 2. WsConnection 适配层

入口：

- `apps/game-server/src/gateway/wsConnection.ts`

设计目标：

- 保持和 `mockConnection` 相同的 `ServerConnection` 接口
- 内部把 `send(message)` 转成 `raw.send(JSON.stringify(message))`
- 若连接已关闭或发送失败，不抛未捕获异常

这样 `ConnectionRegistry`、`broadcastEvents`、`sendSnapshotsToRoom` 可以不关心底层到底是 mock 还是真实 socket。

---

### 3. messageHandler

入口：

- `apps/game-server/src/gateway/messageHandler.ts`

当前支持的消息：

- `ping`
- `create-room`
- `join-room`
- `start-game`
- `leave-room`
- `command`
- `reconnect`

处理流程：

1. `parseMessage` 解析 JSON 和基础字段
2. 根据 `type` 分发到具体处理逻辑
3. 调用已有服务层
4. 返回 `room-state / events / snapshot / pong / error`

规则仍然只在 `uno-core`：

- `command` 继续复用 `dispatchCommand`
- `WebSocket` 层不重写任何出牌合法性逻辑

---

### 4. reconnect 流程

服务端支持：

- 根据 `roomId + userId` 查找原玩家
- 复用原 `playerId`
- 保持原 `seatIndex`
- 更新 `connectionId`
- 标记 `connected = true`

返回策略：

- `waiting` 房间：发 `room-state`
- `playing` 房间：发玩家自己的 `snapshot`

---

### 5. disconnect 流程

当 WebSocket `close` 时：

- 找到绑定的 `roomId / playerId`
- 调用 `RoomManager.leaveRoom`
- `waiting` 房间下真正移除玩家
- `playing` 房间下只标记 `disconnected`
- 若房间仍存在，则广播新的 `room-state`
- 最后注销连接

---

### 6. heartbeat

本阶段只实现最小心跳：

- 客户端发 `ping`
- 服务端回 `pong`

入口：

- `apps/game-server/src/gateway/heartbeat.ts`

这已经够支撑本地联调和基础连通性验证，后续再考虑服务端主动探活和超时踢线。

---

### 7. dev server 与 dev client

本地服务端：

- `apps/game-server/src/dev/runLocalServer.ts`

本地调试客户端：

- `apps/game-server/src/dev/devClient.ts`

当前 `devClient` 会：

- 连接 `WS_URL`，默认 `ws://localhost:8787`
- 发送 `ping`
- 发送 `create-room`
- 打印返回消息
- 收到 `pong` 和 `room-state` 后自动断开退出

---

## 协议变化

### ClientMessage 新增

- `create-room`
- `start-game`
- `reconnect`

### ClientMessage 调整

- `ping` 现在带 `requestId`
- `join-room` 现在带 `roomId / userId / nickname / avatarUrl`

### ServerMessage 新增

- `room-state`
- `room-closed`

### ServerMessage 调整

- `pong` 现在带 `requestId`
- `error` 继续兼容协议错误码和服务端错误码

---

## 测试覆盖

### messageHandler

已覆盖：

- 非 JSON 返回 `error`
- 未知消息类型返回 `error`
- `ping` 返回 `pong`
- `create-room` 创建房间并绑定连接
- `join-room` 广播 `room-state`
- `start-game` 给所有玩家发各自 `snapshot`
- `command` 走 `dispatchCommand`
- `leave-room` 更新房间状态
- `reconnect` 复用原 `playerId`
- `command-rejected` 只回请求玩家
- 最后一名玩家离房时返回 `room-closed`

### wsServer / integration

已覆盖：

- 可以启动 WebSocket server
- 客户端可连接
- `ping -> pong`
- 单客户端 `create-room`
- 第二客户端 `join-room`
- 三客户端 `start-game`
- 每个客户端收到自己的 `snapshot`
- `snapshot` 不泄露他人手牌
- `close` 后玩家被标记 `disconnected`
- `reconnect` 后 `playerId` 不变

---

## 本地验证结果

已实际运行并通过：

```bash
corepack pnpm --filter @thunder-uno/protocol test
corepack pnpm --filter @thunder-uno/protocol typecheck
corepack pnpm --filter @thunder-uno/game-server test
corepack pnpm --filter @thunder-uno/game-server typecheck
corepack pnpm typecheck
corepack pnpm test
```

还额外跑通了本地联调：

```bash
PORT=8791 corepack pnpm --filter @thunder-uno/game-server dev
WS_URL=ws://localhost:8791 corepack pnpm --filter @thunder-uno/game-server dev:client
```

验证结果：

- `protocol`：`1` 个测试文件，`5` 个测试通过
- `uno-core`：`13` 个测试文件，`70` 个测试通过
- `simulator`：`3` 个测试文件，`11` 个测试通过
- `game-server`：`7` 个测试文件，`50` 个测试通过
- 根目录 `typecheck` 通过
- 根目录 `test` 通过

说明：

- 我的本地环境里默认 `8787` 端口当时已被占用，所以联调验证时改用了 `8791`
- 代码本身仍然默认监听 `8787`

---

## 当前仍未实现

- 服务端主动定时心跳和超时断线清理
- 线上部署地址和 `wss://` 配置
- 数据库和事件持久化
- 多进程或多实例房间同步
- 微信登录和用户系统
- Cocos 客户端 UI

---

## 下一阶段建议

1. 进入 Phase 3C，做本地多客户端联调脚本。
2. 固定三人流程：`create-room -> join-room -> join-room -> start-game -> command`。
3. 把 WebSocket 演示链路压稳后，再进入 Phase 4A 的 Cocos 客户端基础 UI。
