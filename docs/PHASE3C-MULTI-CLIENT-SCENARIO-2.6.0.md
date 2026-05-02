# 雷霆UNOplus 第三阶段 C 交付清单 2.6.0

## 阶段目标

本阶段在已经完成的真实 WebSocket 网关之上，补齐“多客户端真实联调”这一层，验证整条链路：

- 多个假客户端通过真实 WebSocket 接入
- `create-room / join-room / start-game / command / reconnect`
- 房间广播、事件广播、玩家快照裁剪
- 对局可以持续推进
- 断线重连后仍能继续跑

本阶段仍然不实现：

- Cocos UI
- 微信登录
- 数据库
- 事件持久化
- 正式线上部署

---

## 本次新增和修改的核心文件

### 协议与脚本

- `packages/protocol/src/messages.ts`
- `packages/protocol/src/messages.test.ts`
- `apps/game-server/package.json`

### Phase 3C 核心代码

- `apps/game-server/src/dev/devWsClient.ts`
- `apps/game-server/src/dev/scenarioDecision.ts`
- `apps/game-server/src/dev/scenarioRandom.ts`
- `apps/game-server/src/dev/scenarioTypes.ts`
- `apps/game-server/src/dev/multiClientScenario.ts`

### WebSocket 层调整

- `apps/game-server/src/gateway/parseMessage.ts`
- `apps/game-server/src/gateway/messageHandler.ts`
- `apps/game-server/src/index.ts`

### 新增测试

- `apps/game-server/src/tests/devWsClient.test.ts`
- `apps/game-server/src/tests/multiClientScenario.test.ts`

### 文档同步

- `README.md`
- `docs/PROTOCOL.md`
- `docs/项目开发文档.md`
- `docs/PHASE3C-MULTI-CLIENT-SCENARIO-2.6.0.md`

---

## 关键实现

### 1. `DevWsClient`

入口：

- `apps/game-server/src/dev/devWsClient.ts`

职责：

- 包装真实 `WebSocket` 客户端连接
- 维护 `roomId / playerId`
- 维护 `latestRoomState / latestSnapshot`
- 提供 `createRoom / joinRoom / startGame / sendCommand / reconnect`
- 只保存客户端可见的快照，不碰完整 `GameState`

这让测试和本地联调都能复用同一套客户端抽象。

### 2. `runMultiClientScenario`

入口：

- `apps/game-server/src/dev/multiClientScenario.ts`

能力：

- 按参数创建 3 到 8 个假客户端
- 真实连接 `ws://localhost:8787`
- 自动建房、进房、开局
- 自动轮流发命令推进对局
- 支持可选断线重连测试
- 支持 `verbose` 日志
- 在 `finished / stuck / failed` 之间给出明确结果

### 3. 客户端决策逻辑

入口：

- `apps/game-server/src/dev/scenarioDecision.ts`

当前策略故意保持简单：

- 如果自己在 `drawUntilColor` 目标上，发 `resolve-draw-until-color`
- 如果自己在 `drawStack` 目标上，优先找能叠的加牌，否则 `resolve-draw-stack`
- 普通回合优先找第一张“看起来可打”的单牌
- 没牌可打就 `draw-card`
- 黑牌根据手牌剩余颜色数量自动选色
- 当自己只剩 1 张且未喊 UNO，自动 `say-uno`
- 根据 `uno-pending` 事件和公开快照，自动 `report-uno`
- 在 `with-challenge` 模式下，按种子随机决定是否 `challenge-draw`

注意：

- 这些只是非权威启发式
- 真正合法性仍然只由服务端 `dispatchCommand -> uno-core.applyCommand` 裁定

### 4. `start-game seed` 透传

本阶段把 `ClientStartGameMessage` 扩展为可选 `seed`。

目的：

- 本地联调脚本传入 `--seed`
- 服务端开局洗牌可复现
- 客户端本地随机决策也可复现

---

## CLI 使用方式

服务端：

```bash
corepack pnpm --filter @thunder-uno/game-server dev
```

单客户端快速验证：

```bash
corepack pnpm --filter @thunder-uno/game-server dev:client
```

多客户端联调：

```bash
corepack pnpm --filter @thunder-uno/game-server dev:scenario --players 3 --mode no-challenge
corepack pnpm --filter @thunder-uno/game-server dev:scenario --players 8 --mode with-challenge --test-reconnect
corepack pnpm --filter @thunder-uno/game-server dev:scenario --players 4 --mode no-challenge --seed 1001 --verbose
```

支持参数：

- `--players`
- `--mode`
- `--ws-url`
- `--seed`
- `--max-steps`
- `--verbose`
- `--test-reconnect`

---

## 测试覆盖

### `devWsClient.test.ts`

已覆盖：

- 多客户端 `create-room / join-room / start-game`
- `snapshot` 不泄露其他玩家手牌
- 当前玩家命令可推进 `snapshotVersion`
- 非当前玩家命令会被 `command-rejected`
- `command-rejected` 只回请求者

### `multiClientScenario.test.ts`

已覆盖：

- `3` 人 `no-challenge` 场景可推进若干步不崩溃
- `8` 人 `with-challenge` + `reconnect` 场景可稳定推进

这里的“稳定推进”允许两种结果：

- `finished`
- `stuck`

只要不是 `failed`，就说明 WebSocket 链路、房间链路、快照链路和重连链路都没有崩。

---

## 本地验证结果

已实际运行并通过：

```bash
corepack pnpm --filter @thunder-uno/protocol test
corepack pnpm --filter @thunder-uno/game-server typecheck
corepack pnpm --filter @thunder-uno/game-server test
corepack pnpm typecheck
corepack pnpm test
```

新增后的关键结果：

- `protocol`：`1` 个测试文件，`6` 个测试通过
- `game-server`：`9` 个测试文件，`55` 个测试通过

还额外验证了：

```bash
PORT=8792 corepack pnpm --filter @thunder-uno/game-server dev
WS_URL=ws://localhost:8792 corepack pnpm --filter @thunder-uno/game-server dev:scenario --players 8 --mode with-challenge --seed 2002 --max-steps 80 --test-reconnect --verbose
```

说明：

- 某些长局在 `maxSteps` 内不一定结束
- 这类场景现在会返回 `stuck`，而不是误判成 `failed`

---

## 当前仍未实现

- 服务端主动 heartbeat 和超时踢线
- 更复杂的客户端组合牌策略
- 本地多客户端可视化面板
- 微信小游戏 Cocos UI
- 正式线上 `wss://` 部署

---

## 下一阶段建议

1. 进入 Phase 4A，开始 Cocos / 微信小游戏客户端基础 UI。
2. 先做登录页、大厅页、房间页和最小对局页骨架。
3. 客户端网络层直接复用当前 `packages/protocol`，不要在 UI 层重复定义消息结构。
