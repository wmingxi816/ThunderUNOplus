# Phase 7C：房主顺移、混沌 bot、更新日志与回合决策收口

## 阶段目标

Phase 7C 记录的是一次“把半成品改动真正收成闭环”的收口阶段。重点不是再铺一层新系统，而是把已经开始推进的共享状态、房间生命周期、机器人入口、音频反馈、设置入口和文档说明整理成一致的最终行为。

这一轮最终落地了 5 组变化：

1. 房主在回合决策阶段主动离房后的顺位与自动继续。
2. 房主/非房主在回合决策弹窗中的权限切换。
3. 大厅机器人从单一入口扩展为 `最强bot / 混沌bot` 双入口。
4. 设置里的独立更新日志入口，以及 `update-log.md` 资源。
5. 出局音效、罚抽减速音效和相关文档说明的统一收口。

## 与旧阶段文档的关系

本阶段是对旧行为说明的覆盖，不是并存规则。

- 它覆盖了 Phase 5A 里“普通玩家在结束弹窗中可以选择 `留在房间 / 离开房间`”的旧口径。现在普通玩家只显示“等待房主决定重开/继续游戏”，不再拥有那两个按钮。
- 它扩展了 Phase 6A 里单一 `greedy-v1` 机器人的设计。当前大厅机器人入口已经分成 `strong -> greedy-v1` 和 `chaos -> chaos-v1`。
- 它补充了 Phase 7A 的音频与设置能力，把“出局音效、更新日志面板、pitch 保持关闭”这些新行为正式写入记录。

阅读顺序建议：

1. 如果你想看机器人最初是怎么引入的，先看 `PHASE6A`。
2. 如果你想看这轮最终行为是什么，以本阶段文档为准。

## 核心变更

### 1. 房主顺移与自动继续

- 只在“房主主动离房”时处理顺位，不把单纯断线视为放弃权限。
- 对局已进入回合决策阶段时，如果房主淘汰后主动离房：
  - 新房主按原始座位/加入顺序顺移到当前仍在房间中的最早玩家。
  - 若仍有至少两名活跃玩家，则服务端自动执行一次 `continueGame()` 语义。
  - 若活跃玩家不足两名，则只转移权限，不自动继续。
- `roundDecisionPending` 正式进入共享快照，作为客户端等待弹窗、服务端继续逻辑和旧状态兼容判断的统一开关。

### 2. 回合决策弹窗

- 房主显示 `重开一把 / 继续游戏`。
- 非房主只显示 `等待房主决定重开/继续游戏`。
- 当服务端自动继续成功，或者新的 snapshot 标明 `roundDecisionPending=false` 时，等待弹窗立刻关闭。
- 如果房主在回合决策阶段离房，客户端收到新的 `hostPlayerId` 后会立即切换按钮权限，不需要刷新页面。

### 3. 机器人双入口与独立策略层

- 协议层新增 `ClientAddBotMessage.botType`，字面量固定为 `"strong" | "chaos"`。
- 房间层 `ServerRoomPlayer.botProfile.strategy` 从单一 `"greedy-v1"` 扩展为：
  - `"greedy-v1"`
  - `"chaos-v1"`
- 大厅 UI 现在保留一个“添加机器人”按钮，同时增加一个下拉：
  - `最强bot`
  - `混沌bot`
- 服务端新增独立策略目录：
  - `greedyStrategy.ts`
  - `chaosStrategy.ts`
  - `dispatchBotStrategy.ts`
- 调度器和开发脚本改为统一通过 `dispatchBotStrategy()` 分发，而不是直接写死 greedy。

### 4. chaos-v1 的核心决策

- `chaos-v1` 先复用现有候选生成器拿到所有合法动作，再计算 `chaosScore`。
- 只要存在 `chaosScore > 0` 的候选，就优先选 chaos 分最高者；如果全不命中，则回退到 greedy。
- 当前已经写进实现和测试的高优先级规则包括：
  - `wild` 指向下家唯一缺色。
  - 不可叠加回应的加牌压制。
  - `swap-hands` 针对短手牌玩家或持有 `+10` 的对手。
  - `reverse` 命中“上家接不了这个颜色”。
  - `+10` 配合自己手里的 `swap-hands`。
  - 黑牌偏多且手牌过大时优先打 `+6` / `+10`。
  - `penalty-draw` 针对超大手牌对手。
- “上家接不了某颜色”没有进公共协议，而是保存在服务端房间私有状态 `lastUnanswerableColorByPlayerId` 中。

### 5. 更新日志与音频

- 设置面板新增独立“日志”按钮，不复用规则弹窗。
- 前端读取 `apps/client-web/public/update-log.md`，只解析 `##` 标题和 `-` 列表项。
- 文件不存在、拉取失败或内容为空时，面板显示空状态文案“暂无更新日志”。
- 新增出局音效资源 `apps/client-web/public/sounds/出局音效.mp3`：
  - 首次收到本轮 `player-eliminated` 事件时启动。
  - 循环播放。
  - 跟随背景音乐音量滑杆。
  - 继续游戏、重开、离房、自动继续成功时停止并重置。
  - 同一轮出局音效只允许启动一次。
- 罚抽减速音效播放前，统一关闭：
  - `preservesPitch`
  - `webkitPreservesPitch`
  - `mozPreservesPitch`

## 影响文件

### 共享类型与核心状态

- `packages/shared-types/src/game.ts`
- `packages/shared-types/src/snapshot.ts`
- `packages/protocol/src/messages.ts`
- `packages/uno-core/src/reducer/effects.ts`
- `packages/uno-core/src/view/createPlayerGameSnapshot.ts`

### 服务端

- `apps/game-server/src/room/roomManager.ts`
- `apps/game-server/src/room/roomTypes.ts`
- `apps/game-server/src/dispatch/dispatchCommand.ts`
- `apps/game-server/src/bot/strategies/`
- `apps/game-server/src/bot/botScheduler.ts`
- `apps/game-server/src/dev/botSelfPlay.ts`

### 前端

- `apps/client-web/src/main.ts`
- `apps/client-web/src/styles.css`
- `apps/client-web/src/protocol/clientMessages.ts`
- `apps/client-web/public/update-log.md`
- `apps/client-web/public/sounds/出局音效.mp3`

### 文档与验证

- `next-step.md`
- `README.md`
- `apps/client-web/e2e/round-decision-host-transfer.spec.ts`
- `apps/game-server/src/tests/dispatchBotStrategy.test.ts`
- `apps/game-server/src/tests/chaosStrategy.test.ts`

## 验证记录

本阶段完成后，执行过以下 fresh 验证：

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:e2e
```

验证范围包括：

- 共享类型、协议、前端、服务端、模拟器全量 typecheck。
- `protocol`、`uno-core`、`game-server`、`client-web` 的全量单测。
- 全量 Playwright e2e，包括新增的：
  - `round-decision-host-transfer.spec.ts`

## 验收标准

本阶段完成后应满足：

1. `roundDecisionPending` 已成为共享快照正式字段。
2. 非房主在回合决策阶段只显示等待文案。
3. 房主淘汰并离房后，房主顺位与自动继续行为正确。
4. 大厅机器人入口支持 `最强bot / 混沌bot`。
5. 服务端具备 `greedy-v1 / chaos-v1` 两套策略入口。
6. 更新日志按钮与 `update-log.md` 加载链路可用。
7. 出局音效和罚抽减速音效生命周期正确。
8. `next-step.md` 与 `README.md` 已同步本轮行为。

## 后续建议

后续如果继续写日志，建议按下面的边界拆：

1. 如果是继续打磨 `chaos-v1` 权重和策略，记到机器人调优阶段。
2. 如果是继续打磨回合决策、观战、房内重开之类房间生命周期，单独开新 Phase。
3. 如果是继续打磨设置、更新日志、音频和 UI 面板，再开一篇 UI/UX 补充 Phase。
