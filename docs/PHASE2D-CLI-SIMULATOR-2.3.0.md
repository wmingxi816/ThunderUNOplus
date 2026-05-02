# 雷霆UNOplus 第二阶段 D 交付清单 2.3.0

## 阶段目标

本阶段完成“本地命令行连续对局模拟器”，用于在不接入 `apps/game-server`、WebSocket、数据库和 Cocos UI 的前提下，持续验证 `uno-core` reducer 在完整对局中的稳定性。

本阶段仍然不实现：

- `apps/game-server`
- 真实 WebSocket
- 微信登录
- 数据库
- 事件持久化
- 回放系统

---

## 本次完成内容

### 1. 新增 `tools/simulator` workspace 包

已新增：

- `tools/simulator/package.json`
- `tools/simulator/tsconfig.json`
- `tools/simulator/tsconfig.build.json`
- `tools/simulator/src/index.ts`
- `tools/simulator/src/cli.ts`
- `tools/simulator/src/simulateGame.ts`
- `tools/simulator/src/batchSimulate.ts`

并将 `pnpm-workspace.yaml` 扩展为同时收纳：

- `apps/*`
- `packages/*`
- `tools/*`

---

### 2. 实现 CLI 单局与批量模拟

当前已支持命令：

```bash
pnpm --filter @thunder-uno/simulator simulate --players 4 --mode no-challenge --seed 1001
pnpm --filter @thunder-uno/simulator simulate --players 8 --mode with-challenge --seed 2002
pnpm --filter @thunder-uno/simulator batch --games 100 --players 3 --mode no-challenge
pnpm --filter @thunder-uno/simulator batch --games 100 --players 8 --mode with-challenge
```

支持参数：

- `--players`
- `--mode`
- `--seed`
- `--max-steps`
- `--verbose`
- `--games`
- `--auto-uno`
- `--challenge-rate`

CLI 已补充参数校验：

- `players` 必须是 `3-8`
- `games` 必须大于等于 `1`
- `maxSteps` 必须大于等于 `1`

---

### 3. 实现假玩家决策层

已新增：

- `tools/simulator/src/bot/chooseColor.ts`
- `tools/simulator/src/bot/findPlayableCard.ts`
- `tools/simulator/src/bot/findPlayableSequence.ts`
- `tools/simulator/src/bot/findPlayableMultiple.ts`
- `tools/simulator/src/bot/findPlayableDiscardSameColor.ts`
- `tools/simulator/src/bot/chooseCommand.ts`

当前 bot 决策顺序：

1. 如果当前玩家是 `drawUntilColor` 目标，执行 `resolve-draw-until-color`
2. 如果当前玩家是 `drawStack` 目标，优先尝试叠加，否则执行 `resolve-draw-stack`
3. 优先尝试 `play-discard-same-color`
4. 再尝试 `play-sequence`
5. 再尝试 `play-multiple-number`
6. 再尝试单张 `play-card`
7. 如果都不能出，执行 `draw-card`

黑牌声明颜色策略：

- 选择当前玩家剩余手牌中数量最多的颜色
- 如果没有彩色牌，默认声明 `red`

UNO / 质疑辅助策略：

- `autoUno=true` 时会自动发送 `say-uno`
- 有可揭发目标时会自动挑选一个可行动玩家发送 `report-uno`
- `with-challenge` 模式下会按 `challengeRate` 概率发起 `challenge-draw`

---

### 4. 实现 invariant 检查

已新增：

- `tools/simulator/src/invariant/validateGameStateInvariant.ts`
- `tools/simulator/src/invariant/formatInvariantFailure.ts`

当前至少检查：

1. `currentPlayerId` 必须存在且不能指向已淘汰玩家
2. `discardPile` 必须至少保留一张牌
3. `currentColor` 必须是 `red / yellow / blue / green`
4. 每个玩家 `handCount` 不能为负数
5. 每个玩家 `handCount` 必须与 `hand.length` 一致
6. 玩家手牌、`drawPile`、`discardPile` 之间的 `card id` 不能重复
7. `drawStack.active=true` 时目标玩家必须存在且未淘汰
8. `drawUntilColor.active=true` 时目标玩家必须存在且未淘汰
9. `winnerPlayerIds` 非空时 `status` 必须为 `finished`
10. `status=finished` 时必须存在至少一个赢家
11. 玩家视角快照不能泄漏 `challengeWindow` 隐藏字段
12. 玩家视角快照不能泄漏完整 `drawPile`

如果 invariant 失败，会输出：

- seed
- step
- player count
- mode
- last command
- recent events
- state 摘要

---

### 5. 实现日志与统计输出

已新增：

- `tools/simulator/src/logger/simulationLogger.ts`
- `tools/simulator/src/stats/simulationStats.ts`
- `tools/simulator/src/random.ts`

当前支持：

- 单步 verbose 日志
- 单局摘要
- 批量统计报告
- 失败 seed 收集

---

### 6. 测试补齐

已新增测试：

- `tools/simulator/tests/simulateGame.test.ts`
- `tools/simulator/tests/invariant.test.ts`
- `tools/simulator/tests/batchSimulate.test.ts`

覆盖内容包括：

1. 可以创建 `3` 人 `no-challenge` 对局
2. 可以创建 `8` 人 `with-challenge` 对局
3. 单局模拟能在 `maxSteps` 内结束或返回明确 `stuck`
4. 相同 seed 的模拟结果可复现
5. invariant 能发现重复 `card id`
6. invariant 能发现 `currentPlayerId` 指向淘汰玩家
7. batch 模式可以运行多局并输出统计
8. 黑牌 `declaredColor` 会被自动补全
9. `drawStack` 目标玩家会优先尝试叠加，否则 `resolve-draw-stack`
10. `drawUntilColor` 目标玩家会执行 `resolve-draw-until-color`

---

## 本地验证结果

已实际运行并通过：

```bash
pnpm typecheck
pnpm test
pnpm --filter @thunder-uno/simulator typecheck
pnpm --filter @thunder-uno/simulator test
pnpm --filter @thunder-uno/simulator simulate --players 4 --mode no-challenge --seed 1001
pnpm --filter @thunder-uno/simulator simulate --players 8 --mode with-challenge --seed 2002
pnpm --filter @thunder-uno/simulator batch --games 20 --players 4 --mode no-challenge
```

当前结果：

- 根目录 `typecheck` 通过
- 根目录 `test` 通过
- `simulator` typecheck 通过
- `simulator` `3` 个测试文件、`11` 个测试全部通过
- 单局示例：`4` 人 `no-challenge`，`seed=1001`，`53` 步结束，赢家 `p2`
- 单局示例：`8` 人 `with-challenge`，`seed=2002`，`49` 步结束，赢家 `p3`
- 批量示例：`20` 局 `4` 人 `no-challenge`，`20` 局全部结束，无 stuck，无 invariant 失败

单局示例输出：

```txt
game started | seed=1001 | players=4 | mode=no-challenge
game finished
status=finished | winner=p2 | steps=53 | eliminated=none | reshuffles=0 | rejected=0
```

批量示例输出：

```txt
totalGames=20 | finishedGames=20 | stuckGames=0 | failedInvariantGames=0 | averageSteps=56.45 | maxSteps=142 | minSteps=18 | averageReshuffles=0.00 | averageRejectedCommands=0.00 | eliminationCount=5 | winnerDistribution=p3:6, p2:7, p1:5, p4:2 | seedRange=1-20
```

---

## 当前仍未完成的内容

- 还没有进入 `apps/game-server` 的内存房间容器
- 还没有接真实 WebSocket
- 还没有做事件持久化 / 回放系统
- 还没有做数据库与微信登录
- 还没有做客户端 Cocos UI

---

## 下一阶段建议

1. 进入 Phase 3A，实现 `apps/game-server` 内存房间容器
2. 增加 `RoomManager`、`ConnectionRegistry`、`dispatchCommand`
3. 把 `packages/protocol` 的 envelope 接到服务端广播链路
4. 基于 `createPlayerGameSnapshot` 向不同玩家发送裁剪后的权威快照
