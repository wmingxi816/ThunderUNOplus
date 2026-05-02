# 雷霆UNOplus 状态机设计

## 目标

这份文档描述 Phase 2C 之后的真实状态边界，用来约束：

- `packages/uno-core` 如何推进权威状态
- `packages/protocol` 如何封装命令、事件和快照
- 服务端未来如何广播“同一局、不同视角”的裁剪结果

规则与牌库的唯一来源：

- [GAME-RULES.md](../GAME-RULES.md)
- [CARD-CONFIG.md](../CARD-CONFIG.md)

---

## 设计原则

- 服务端是唯一权威状态源。
- 客户端只能提交命令，不能本地裁定是否合法。
- `packages/uno-core` 负责所有规则判断和状态推进。
- `packages/protocol` 负责消息外壳和快照传输结构。
- 客户端只能拿到“自己的完整手牌 + 他人的公开状态”。

---

## 房间状态机

```txt
lobby
  -> starting
  -> playing
  -> settled
  -> closed
```

### `lobby`

- 房主已创建房间。
- 玩家可通过房间号加入。
- 允许 3 到 8 人进入房间。

### `starting`

- 房主点击开始后进入。
- 锁定玩家名单、模式和座位。
- 调用 `createInitialGame()` 生成第一帧 `GameState`。

### `playing`

- 服务端维护：
  - 当前玩家
  - 当前颜色
  - 出牌方向
  - 摸牌堆 / 弃牌堆
  - 加牌链
  - 罚抽状态
  - UNO 待喊状态
  - 质疑窗口
  - 淘汰与胜利

### `settled`

- 某位玩家打空手牌，或只剩 1 名未淘汰玩家时进入。
- 生成结算结果，广播胜者和关键事件。

### `closed`

- 房间主动解散或服务端生命周期结束。

---

## 对局主状态

当前 `uno-core` 的 `GameState.status` 只有：

```txt
in-progress
finished
```

说明：

- `in-progress` 覆盖正常出牌、摸牌、加牌链、罚抽、UNO、质疑等所有运行中状态。
- `finished` 表示对局结束，不再接受新的对局命令。

Phase 2C 选择把“是否可质疑”“是否待罚抽”“是否在加牌链中”拆到独立子状态里，而不是额外增加更细的顶层状态枚举。

---

## 运行时子状态

### `drawStack`

```ts
{
  active: boolean;
  amount: number;
  previousDrawValue: 2 | 4 | 6 | 10 | null;
  targetPlayerId: string | null;
}
```

表示当前是否有累计加牌压力，以及谁必须响应。

### `drawUntilColor`

```ts
{
  active: boolean;
  color: CardColor | null;
  targetPlayerId: string | null;
}
```

表示当前是否存在“罚抽直到摸到指定颜色”为止的压力。

### `challengeWindow`

```ts
{
  active: boolean;
  targetPlayerId: string | null;
  hadBlackCardBeforeDraw: boolean;
  expiresWhenNextPlayerCompletesAction: boolean;
}
```

说明：

- `hadBlackCardBeforeDraw` 是服务端隐藏信息。
- 它只存在于权威 `GameState` 中。
- 普通玩家快照里绝不能泄露这个字段。

---

## 单命令流转

```txt
client command
  -> protocol message
  -> server receives requestId / roomId / playerId / timestampMs
  -> applyCommand(state, command)
  -> state updated
  -> GameEvent[] returned
  -> snapshotVersion + 1
  -> createPlayerGameSnapshot(state, viewerPlayerId)
  -> broadcast events + per-player snapshot
```

### 说明

- `applyCommand()` 是对局推进唯一入口。
- 非法命令不会修改原状态，只返回 `command-rejected`。
- 合法命令返回新的 `GameState` 和一组 `GameEvent`。

---

## 摸牌与回洗状态侧路

Phase 2C 新增统一摸牌函数：

```txt
drawCardsFromState(state, count)
```

状态流转：

```txt
draw requested
  -> drawPile enough
  -> direct draw

draw requested
  -> drawPile empty or insufficient
  -> recycle discardPile except topCard
  -> deterministic reshuffle
  -> continue draw

draw requested
  -> no drawPile and no recyclable discard
  -> emit draw-pile-exhausted
  -> stop safely
```

关键约束：

- 顶牌必须保留在弃牌堆，不能被洗回摸牌堆。
- 回洗会产生 `deck-reshuffled` 事件。
- 完全无牌可摸时会产生 `draw-pile-exhausted` 事件。

---

## 玩家视角快照

服务端广播时不能直接发送完整 `GameState`。

Phase 2C 使用：

```txt
createPlayerGameSnapshot(state, viewerPlayerId)
```

输出规则：

- 自己可以看到完整手牌。
- 其他玩家只能看到：
  - `playerId`
  - 昵称 / 头像
  - 手牌数量
  - 是否已喊 UNO
  - 是否淘汰
  - 是否当前行动玩家
- 可以看到公共信息：
  - `roomId`
  - `snapshotVersion`
  - `currentPlayerId`
  - `currentColor`
  - `direction`
  - `topCard`
  - `drawPileCount`
  - `drawStack`
  - `drawUntilColor`
  - `challengeWindow.active`
  - `winnerPlayerIds`

---

## 断线重连侧路

```txt
connected
  -> reconnecting
  -> connected

connected
  -> disconnected
```

### 说明

- 房间和对局不会因为单个玩家掉线而暂停。
- 重连成功后，服务端应重新下发该玩家视角的最新快照。

---

## 当前未落地部分

- 真实 WebSocket 连接管理
- 服务端房间容器
- 数据库存档
- 超时托管
- 本地命令行连续对局模拟器
