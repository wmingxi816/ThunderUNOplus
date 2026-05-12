# Phase 7B：贪心机器人权重可测化与固定手牌调参

## 阶段目标

Phase 7B 主要围绕服务端贪心机器人 `greedy-v1` 做算法调参基础设施建设。

本阶段不是新增游戏规则，也不是让机器人绕过 `uno-core`。目标是把“机器人为什么这样出牌”变得可测、可解释、可重复验证，避免后续靠直觉随意调整分值。

核心目标：

1. 把机器人评分里的散落数字收敛成命名权重。
2. 增加三机器人自走测试，用于验证稳定性。
3. 增加候选权重 A/B 对照，用于判断新权重是否真的更强。
4. 增加固定手牌场景实验室，用于校准单张牌或某类牌的局部价值。
5. 根据固定场景结果，优化 `+6`、`+10` 的保留策略。

## 背景问题

Phase 6A 已经设计并实现了服务端贪心机器人。机器人可以生成候选动作，并通过评分选择最高分动作。

但原评分逻辑存在两个调试问题：

1. 分值直接散落在 `botScoring.ts` 中，例如 `100`、`1200`、`-260`，很难知道每个数字对应哪个策略意图。
2. 单纯让三个相同机器人互打，只能测试是否稳定，不能证明某个权重更好。

实际调参需要两类测试：

1. 整局级测试：多局自走和 A/B 对战，看整体稳定性和胜率。
2. 局面级测试：固定手牌、固定顶牌、固定下家手牌数，看某张牌是否排在合理位置。

## 核心改动

### 1. 评分权重集中化

文件：

```txt
apps/game-server/src/bot/botScoring.ts
```

新增：

```ts
BotScoringWeights
DEFAULT_BOT_SCORING_WEIGHTS
```

将原本散落在评分函数中的数字抽成命名权重，例如：

- `cardReduction`
- `winBonus`
- `unoBonus`
- `drawCommandPenalty`
- `nextPlayerOneCardDangerBonus`
- `drawTwoPressure`
- `wildDrawSixPressure`
- `reserveWildDrawSixCost`
- `reserveWildDrawTenCost`
- `discardLargeHandBonus`
- `isolatedNumberBaseBonus`

这样后续调参时可以明确知道每个数字在控制哪一类行为。

### 2. 机器人决策支持实验权重

文件：

```txt
apps/game-server/src/bot/greedyBot.ts
```

`decideGreedyBotAction()` 新增可选参数：

```ts
weights?: BotScoringWeights
```

默认仍使用 `DEFAULT_BOT_SCORING_WEIGHTS`，生产行为不需要额外传参。

测试或实验脚本可以给某个机器人传入候选权重，从而和默认机器人对战。

### 3. 三机器人自走与 A/B 对照

文件：

```txt
apps/game-server/src/dev/botSelfPlay.ts
```

新增能力：

1. `simulateGreedyBotSelfPlay()`：三个机器人自走一局。
2. `runGreedyBotBatch()`：批量运行多局，统计完成数、卡死数、非法命令数、平均步数、命令分布。
3. `evaluateGreedyBotWeights()`：候选权重机器人轮流坐 1/2/3 号位，对战两个默认权重机器人。
4. `createPressureTunedWeights()`：保留一组“压制倾向增强”的实验权重。

新增脚本：

```bash
corepack pnpm --filter @thunder-uno/game-server bot:self-play
```

常用命令：

```bash
corepack pnpm --filter @thunder-uno/game-server bot:self-play -- --games 100 --seed 33000 --players 3 --max-steps 1500
```

```bash
corepack pnpm --filter @thunder-uno/game-server bot:self-play -- --evaluate pressure --games 100 --seed 22000 --players 3 --max-steps 1500
```

判断口径：

- 三人局候选策略公平基线约为 `33.3%`。
- 候选权重必须在座位轮换后稳定高于 `33.3%`，才值得考虑采纳。
- 如果只是小样本领先，大样本回落到 `33.3%` 附近，则不采纳。

### 4. 固定手牌场景实验室

文件：

```txt
apps/game-server/src/dev/botScenarioLab.ts
```

新增固定局面评分工具。它可以手动设定：

- 顶牌
- 当前颜色
- 当前行动玩家
- 顺/逆时针方向
- 每个玩家的手牌
- 摸牌堆

然后输出机器人候选动作的评分排名。

新增脚本：

```bash
corepack pnpm --filter @thunder-uno/game-server bot:scenario
```

示例：

```bash
corepack pnpm --filter @thunder-uno/game-server bot:scenario -- --scenario pressure --limit 6
```

输出示例：

```txt
Scenario pressure | current=bot-1
01. score=720 play-card:...red-draw-two...
02. score=685 play-card:...wild-draw-six...
03. score=600 play-card:...red-skip...
04. score=-125 play-card:...red-9...
```

这个场景表示：

- 当前顶牌是红 5。
- 当前玩家有红 9、红禁、红 `+2`、黑色 `+6`。
- 下家只剩 1 张牌。

理想策略是先用红 `+2` 压制下家，同时尽量保留更稀缺的黑色 `+6`。固定场景评分可以直接验证这个排序。

### 5. `+6`、`+10` 保留策略优化

固定手牌场景暴露出一个问题：

当机器人已经有红 `+2` 可以压制下家时，旧权重仍然可能优先打黑色 `+6`。这会过早消耗高价值黑牌。

本阶段调整：

1. 提高默认 `reserveWildDrawSixCost`。
2. 提高默认 `reserveWildDrawTenCost`。
3. 新增 `hasPlayablePressureAlternative()`。
4. 如果手里存在可出的有色压制牌，例如禁、反转、`+2`、普通 `+4`，就不要因为下家危险而完全免除 `+6` / `+10` 的保留成本。

结果：

```txt
红 +2：720 分，排第 1
黑 +6：685 分，排第 2
红禁：600 分，排第 3
红 9：-125 分，排第 4
```

机器人仍然知道 `+6` 是强牌，但在已有足够压制手段时，会更倾向于保留它。

## 测试与验证

### 单元与回归测试

新增：

```txt
apps/game-server/src/tests/botSelfPlay.test.ts
```

覆盖：

1. 三机器人重复自走不会卡死。
2. 三机器人重复自走不会产生非法命令。
3. A/B 权重对照可以按座位轮换运行。
4. 固定手牌场景中，下家 1 张时压制牌高于普通数字牌。

验证命令：

```bash
corepack pnpm --filter @thunder-uno/game-server test -- botSelfPlay.test.ts greedyBot.test.ts
```

结果：

```txt
91 passed
```

### 类型检查

命令：

```bash
corepack pnpm --filter @thunder-uno/game-server typecheck
```

结果：

```txt
passed
```

### 批量自走

命令：

```bash
corepack pnpm --filter @thunder-uno/game-server bot:self-play -- --games 100 --seed 33000 --players 3 --max-steps 1500
```

结果：

```txt
games=100 finished=100 stuck=0 rejected=0
avgSteps=113.4 avgMaxHandCount=22.3
tuningHints:
- no obvious red flags in this batch.
```

### 候选权重对照

命令：

```bash
corepack pnpm --filter @thunder-uno/game-server bot:self-play -- --evaluate pressure --games 60 --seed 34000 --players 3 --max-steps 1500
```

结果：

```txt
baseGames=60 seatRotatedGames=180
contenderWins=62 contenderWinRate=34.4%
finished=180 stuck=0 rejected=0
```

这组 `pressure` 实验权重有小幅领先，但样本仍不足以证明它稳定优于默认权重。因此本阶段只采纳固定场景暴露出的 `+6/+10` 保留策略修正，不采纳整套 `pressure` 实验权重为默认策略。

## 新增文档

新增：

```txt
docs/GREEDY-BOT-WEIGHT-TUNING.md
```

该文档记录后续机器人调参方法：

1. 先用固定手牌场景判断局部排序是否合理。
2. 再用三机器人自走验证稳定性。
3. 最后用 A/B 座位轮换判断候选权重是否整体更强。
4. 每次只调整一组相关权重，避免结果难以解释。

## 验收标准

本阶段完成后应满足：

1. 机器人评分权重有统一命名配置。
2. 默认机器人行为不依赖实验参数。
3. 可以批量运行三机器人自走，并输出稳定性报告。
4. 可以运行候选权重和默认权重的座位轮换对照。
5. 可以固定手牌场景查看候选动作分数排名。
6. 固定压制场景中，红 `+2` 优先于黑色 `+6`。
7. 100 局三机器人自走全部结束，无卡死，无非法命令。
8. game-server 相关测试和类型检查通过。

## 后续方向

后续调参建议继续围绕固定场景库扩展：

1. 黑牌保留场景：有普通颜色牌可出时，不轻易打 `+6`、`+10`。
2. 冲刺场景：剩 2 张或 1 张时，验证机器人是否合理冒险。
3. 同色丢弃场景：手牌多时积极丢弃，手牌少时保留。
4. 顺子 / 连对场景：验证机器人不会轻易拆掉高价值组合。
5. 加牌链场景：验证不同累计惩罚下是否合理叠加或结算。

等固定场景库足够丰富后，可以进一步把候选权重搜索做成自动 sweep，但仍需要人工定义“局面排序预期”，否则容易只优化胜率而牺牲玩家观感。
