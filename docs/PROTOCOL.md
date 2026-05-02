# 雷霆UNOplus 协议设计

## 目标

协议层负责定义客户端和服务端之间的消息边界，不承载游戏规则本身。规则仍然只存在于 `packages/uno-core`，协议只负责：

- 约定消息格式
- 约定快照裁剪边界
- 约定错误码
- 约定协议版本

当前核心代码位置：

- [packages/protocol/src/messages.ts](../packages/protocol/src/messages.ts)
- [packages/protocol/src/snapshots.ts](../packages/protocol/src/snapshots.ts)
- [packages/protocol/src/errors.ts](../packages/protocol/src/errors.ts)
- [packages/shared-types/src/index.ts](../packages/shared-types/src/index.ts)

---

## 核心原则

- 客户端只发命令，不发规则结论。
- 服务端只回事件和玩家视角快照。
- 不直接广播完整 `GameState`。
- 其他玩家的手牌内容永远不可见。
- `challengeWindow.hadBlackCardBeforeDraw` 这类隐藏字段绝不出现在普通快照中。

---

## ClientMessage

```ts
type ClientMessage =
  | ClientPingMessage
  | ClientCreateRoomMessage
  | ClientJoinRoomMessage
  | ClientStartGameMessage
  | ClientLeaveRoomMessage
  | ClientCommandMessage
  | ClientReconnectMessage;
```

### `ping`

```ts
{
  protocolVersion: PROTOCOL_VERSION;
  type: "ping";
  requestId: string;
  timestampMs: number;
}
```

用途：

- 客户端保活
- 测量往返延迟

### `create-room`

```ts
{
  protocolVersion: PROTOCOL_VERSION;
  type: "create-room";
  requestId: string;
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
  mode: GameMode;
  timestampMs: number;
}
```

用途：

- 创建房间
- 创建房主玩家
- 绑定当前连接

### `join-room`

```ts
{
  protocolVersion: PROTOCOL_VERSION;
  type: "join-room";
  requestId: string;
  roomId: string;
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
  timestampMs: number;
}
```

用途：

- 输入房间号加入房间
- 若同 `userId` 已存在，可复用玩家身份

### `start-game`

```ts
{
  protocolVersion: PROTOCOL_VERSION;
  type: "start-game";
  requestId: string;
  roomId: string;
  playerId: string;
  seed?: string | number;
  timestampMs: number;
}
```

用途：

- 房主开始对局
- 本地联调时可选透传 `seed`，让服务端洗牌可复现

### `leave-room`

```ts
{
  protocolVersion: PROTOCOL_VERSION;
  type: "leave-room";
  requestId: string;
  roomId: string;
  playerId: string;
  timestampMs: number;
}
```

用途：

- 主动离开房间

### `command`

```ts
{
  protocolVersion: PROTOCOL_VERSION;
  type: "command";
  requestId: string;
  roomId: string;
  playerId: string;
  command: GameCommand;
  timestampMs: number;
}
```

用途：

- 统一进入 `uno-core.applyCommand`

### `reconnect`

```ts
{
  protocolVersion: PROTOCOL_VERSION;
  type: "reconnect";
  requestId: string;
  roomId: string;
  userId: string;
  timestampMs: number;
}
```

用途：

- 断线后复用原 `playerId`
- 重新绑定新连接

---

## ServerMessage

```ts
type ServerMessage =
  | ServerPongMessage
  | ServerRoomStateMessage
  | ServerEventsMessage
  | ServerSnapshotMessage
  | ServerErrorMessage
  | ServerRoomClosedMessage;
```

### `pong`

```ts
{
  protocolVersion: PROTOCOL_VERSION;
  type: "pong";
  requestId: string;
  timestampMs: number;
}
```

### `room-state`

```ts
{
  protocolVersion: PROTOCOL_VERSION;
  type: "room-state";
  requestId?: string;
  roomId: string;
  room: PlayerRoomSnapshot;
  snapshotVersion: number;
}
```

用途：

- lobby 阶段同步房间成员列表
- waiting 房间的加入、离开、房主变更广播

### `events`

```ts
{
  protocolVersion: PROTOCOL_VERSION;
  type: "events";
  requestId?: string;
  roomId: string;
  events: GameEvent[];
  snapshotVersion: number;
}
```

用途：

- 表达命令执行产生的事实
- 如 `cards-played`、`cards-drawn`、`command-rejected`

### `snapshot`

```ts
{
  protocolVersion: PROTOCOL_VERSION;
  type: "snapshot";
  roomId: string;
  playerId: string;
  snapshot: SnapshotPayload;
  snapshotVersion: number;
}
```

用途：

- 给单个玩家发送裁剪后的视角快照
- playing 状态下每个玩家收到的内容都可能不同

### `error`

```ts
{
  protocolVersion: PROTOCOL_VERSION;
  type: "error";
  requestId?: string;
  roomId?: string;
  code: ProtocolErrorCode | ErrorCode;
  message: string;
}
```

用途：

- 解析错误
- 房间状态错误
- 身份校验错误

### `room-closed`

```ts
{
  protocolVersion: PROTOCOL_VERSION;
  type: "room-closed";
  requestId?: string;
  roomId: string;
}
```

用途：

- waiting 房间最后一人离开后告知客户端房间已销毁

---

## 快照边界

当前使用两类快照：

- `PlayerRoomSnapshot`
- `PlayerGameSnapshot`

### 房间快照可见内容

- `roomId`
- `roomCode`
- `status`
- `mode`
- `hostPlayerId`
- `snapshotVersion`
- `players`

每个玩家条目只包含：

- `playerId`
- `displayName`
- `avatarUrl`
- `seatIndex`
- `isHost`
- `connectionStatus`

### 对局快照可见内容

自己可见：

- 完整手牌
- 自己是否已喊 UNO
- 自己是否淘汰

别人可见：

- `playerId`
- `displayName`
- `avatarUrl`
- `handCount`
- `hasCalledUno`
- `isEliminated`
- `isCurrentPlayer`

公共可见：

- `currentPlayerId`
- `currentColor`
- `direction`
- `topCard`
- `drawPileCount`
- `drawStack`
- `drawUntilColor`
- `challengeWindow.active`
- `winnerPlayerIds`

绝不泄露：

- 其他玩家具体手牌
- `drawPile` 实际内容
- `challengeWindow.hadBlackCardBeforeDraw`

---

## 协议版本

当前协议版本常量：

```ts
PROTOCOL_VERSION = "1.0.0-alpha.1"
```

所有客户端消息都必须带上 `protocolVersion`。若版本不匹配，服务端会返回 `protocol-version-mismatch`。

---

## 当前状态

截至 Phase 3C，协议已经真实接入 `apps/game-server` 的 WebSocket 网关，并被本地多客户端联调工具实际使用：

- `create-room`
- `join-room`
- `start-game`
- `start-game seed` 可选透传
- `leave-room`
- `command`
- `ping`
- `reconnect`

下一步建议进入 Phase 4A，开始 Cocos / 微信小游戏客户端基础 UI。
