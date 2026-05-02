# 雷霆UNOplus 第二阶段 C 交付清单 2.2.0

## 阶段目标

本阶段完成“服务端接入前的协议收口和规则补强”：

- 把 `uno-core` 的稳定命令 / 事件 / 状态同步到 `shared-types`
- 把 `protocol` 的消息 envelope 定下来
- 实现玩家视角快照裁剪
- 实现摸牌堆耗尽时的统一回洗

本阶段仍然**不实现**：

- Cocos UI
- 微信登录
- 数据库
- 真实 WebSocket
- 完整 `apps/game-server`

---

## 本次完成内容

### 1. shared-types 收口

已更新：

- `packages/shared-types/src/common.ts`
- `packages/shared-types/src/card.ts`
- `packages/shared-types/src/player.ts`
- `packages/shared-types/src/game.ts`
- `packages/shared-types/src/room.ts`
- `packages/shared-types/src/command.ts`
- `packages/shared-types/src/event.ts`
- `packages/shared-types/src/errors.ts`
- `packages/shared-types/src/snapshot.ts`

当前统一提供：

- `GameMode`
- `Card`
- `Player`
- `GameState`
- `RoomState`
- `GameCommand`
- `GameEvent`
- `ApplyCommandResult`
- `CommandRejectedEvent`
- `ErrorCode`

---

### 2. protocol 收口

已更新：

- `packages/protocol/src/messages.ts`
- `packages/protocol/src/snapshots.ts`
- `packages/protocol/src/errors.ts`
- `packages/protocol/src/index.ts`

当前已稳定：

- `ClientMessage`
- `ServerMessage`
- `CommandEnvelope`
- `EventEnvelope`
- `SnapshotEnvelope`
- `ErrorEnvelope`

并且 `protocol` 只依赖 `shared-types`，不依赖 `uno-core`。

---

### 3. 玩家视角快照裁剪

已新增：

- `packages/uno-core/src/view/createPlayerGameSnapshot.ts`

当前规则：

- 自己能看到完整手牌
- 其他玩家只能看到公开信息和手牌数量
- `drawPile` 只暴露剩余数量
- `challengeWindow` 只暴露公开信息
- `hadBlackCardBeforeDraw` 不会进入快照

---

### 4. 统一摸牌与回洗

已新增：

- `packages/uno-core/src/reducer/drawCardsFromState.ts`

当前所有这些路径都改为走统一摸牌函数：

- 普通摸牌
- 加牌链罚摸
- 罚抽
- 质疑罚摸
- UNO 揭发罚摸

新增事件：

- `deck-reshuffled`
- `draw-pile-exhausted`

---

### 5. 测试补强

已新增：

- `packages/shared-types/src/common.test.ts`
- `packages/protocol/src/messages.test.ts`
- `packages/uno-core/src/view/createPlayerGameSnapshot.test.ts`
- `packages/uno-core/src/reducer/drawCardsFromState.test.ts`

并补充了 reducer 集成测试，覆盖：

- 加牌链罚摸回洗
- 质疑罚摸回洗
- UNO 揭发罚摸回洗
- 罚抽摸牌回洗

---

## 本地验证结果

已通过：

```bash
pnpm --filter @thunder-uno/shared-types typecheck
pnpm --filter @thunder-uno/protocol typecheck
pnpm --filter @thunder-uno/uno-core test
pnpm --filter @thunder-uno/uno-core typecheck
```

补充跑过：

```bash
pnpm exec vitest run packages/shared-types/src/common.test.ts packages/protocol/src/messages.test.ts
```

当前结果：

- `shared-types` typecheck 通过
- `protocol` typecheck 通过
- `uno-core` `13` 个测试文件、`70` 个测试全部通过
- shared / protocol 额外 `4` 个测试通过

---

## 当前仍未完成的内容

- 还没有进入 `apps/game-server` 的房间容器与命令分发
- 还没有实现本地命令行连续对局模拟器
- 还没有做完整断线重连时的房间快照生成器
- 还没有做事件持久化 / 回放流

---

## 下一阶段建议

1. 进入 Phase 2D：本地命令行模拟器
2. 用 3 到 8 个假玩家持续跑对局，验证 reducer 连续稳定性
3. 模拟器稳定后，再进入 `apps/game-server`
