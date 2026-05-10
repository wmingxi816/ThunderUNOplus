# 机器人交换手牌贪心策略设计

目标：让机器人在“手牌质量较差”或“手牌数量过多”时，更倾向于打出 `交换手牌`。如果满足条件，打出 `交换手牌` 的候选动作分数提升到约 `3000` 分。

当前机器人评分入口：

- 文件：`apps/game-server/src/bot/botScoring.ts`
- 主函数：`scoreCandidate()`
- 候选动作来自：`apps/game-server/src/bot/botCandidates.ts`
- 当前决策入口：`apps/game-server/src/bot/greedyBot.ts`

## 一、现有评分结构

`scoreCandidate()` 当前会先模拟执行候选命令：

```ts
const result = applyCommand(cloneGameState(state), command);
```

如果命令合法，再累加各类分数：

1. 出牌张数：`candidate.cardIds.length * 100`
2. 剩余手牌奖励：剩 0、1、2 张时加分
3. 手牌较多时一次打多张加分
4. 对下家施压：`scorePressure()`
5. 加牌链响应：`scoreDrawStack()`
6. 变色颜色选择：`scoreDeclaredColor()`
7. 强牌保留成本：`scoreReserveCost()`
8. 同色丢弃策略：`scoreDiscardSameColor()`
9. 数字牌结构策略：`scoreSingleNumberStructure()`
10. 少量随机扰动：`random() * 8`

新逻辑应作为一个新的评分函数接入，不改变候选动作生成。

## 二、新增评分函数

建议新增：

```ts
scoreSwapHandsOpportunity(state, beforePlayer.hand, command): number
```

调用位置放在 `scoreCandidate()` 里：

```ts
score += scoreSwapHandsOpportunity(state, beforePlayer.hand, command);
```

建议放在 `scoreReserveCost()` 后、`scoreDiscardSameColor()` 前。原因是 `交换手牌` 属于单牌策略，应该在普通组合策略前完成“是否值得主动交换”的判断。

## 三、交换手牌识别

只处理单张出牌候选：

```ts
if (command.type !== "play-card") return 0;

const card = hand.find((candidate) => candidate.id === command.cardId);
if (card?.kind !== "swap-hands") return 0;
```

也就是说，只有当前候选动作确实是在打出 `交换手牌` 时才会加分。

## 四、触发条件一：手牌超过 15 张

如果机器人当前手牌数量超过 15 张，说明它已经处于明显劣势。此时 `交换手牌` 可以直接改变局面，应该给高优先级。

建议：

```ts
if (hand.length > 15) {
  return 3000;
}
```

这个分数应当高于普通出牌、普通加牌施压、多张出牌收益，但仍低于直接获胜的 `10000` 分。

## 五、触发条件二：手牌大多是普通数字牌或普通技能牌

需要新增一个“手牌质量评分”。核心思想：

- 手牌越多普通牌，越适合交换。
- 手牌里强牌越多，越不应该随便交换。
- 手牌很少时，即使都是普通牌，也不应该乱交换。

### 普通数字牌

```ts
card.kind === "number"
```

### 普通技能牌

建议把下面牌视为低价值普通技能牌：

```ts
skip
reverse
discard-same-color
swap-hands
```

说明：`swap-hands` 本身也算普通技能牌，但只有当前候选动作是打出它时才触发交换评分。

### 中等价值牌

普通加牌有一定施压能力，不建议和普通技能牌完全等价：

```ts
draw-two
draw-four
```

### 高价值牌

下面这些牌应视为强牌：

```ts
wild
penalty-draw
wild-reverse-draw-four
wild-draw-six
wild-draw-ten
```

## 六、手牌质量评分设计

新增：

```ts
evaluateHandExchangeProfile(hand: readonly Card[]): {
  averageValue: number;
  lowValueRatio: number;
}
```

每张牌给一个“保留价值”，分数越低越适合交换：

```txt
number: 1
skip: 2
reverse: 2
discard-same-color: 2
swap-hands: 2
draw-two: 4
draw-four: 5
wild: 7
penalty-draw: 7
wild-reverse-draw-four: 8
wild-draw-six: 9
wild-draw-ten: 10
```

计算：

```ts
const averageValue = totalValue / hand.length;
const lowValueRatio = lowValueCardCount / hand.length;
```

其中低价值牌建议定义为：

```ts
value <= 2
```

## 七、普通牌过多时的触发阈值

建议触发条件：

```txt
hand.length >= 7
lowValueRatio >= 0.7
averageValue <= 3
```

满足时：

```ts
return 3000;
```

理由：

1. `hand.length >= 7`：避免机器人手牌很少、快赢时乱交换。
2. `lowValueRatio >= 0.7`：确保“大多是普通数字牌或普通技能牌”。
3. `averageValue <= 3`：避免手里混入大量强牌时误判。

## 八、最终建议伪代码

```ts
function scoreSwapHandsOpportunity(
  state: GameState,
  hand: readonly Card[],
  command: GameCommand
): number {
  if (command.type !== "play-card") {
    return 0;
  }

  const card = hand.find((candidate) => candidate.id === command.cardId);

  if (card?.kind !== "swap-hands") {
    return 0;
  }

  if (hand.length > 15) {
    return 3000;
  }

  const profile = evaluateHandExchangeProfile(hand);

  if (
    hand.length >= 7 &&
    profile.lowValueRatio >= 0.7 &&
    profile.averageValue <= 3
  ) {
    return 3000;
  }

  return 0;
}
```

## 九、可选渐进分方案

第一版建议直接返回 `3000`，便于测试。

如果后续觉得机器人过于激进，可以改成渐进分：

```txt
hand.length > 15: +3000
lowValueRatio >= 0.8 且 averageValue <= 3: +3000
lowValueRatio >= 0.7 且 averageValue <= 3: +2400
lowValueRatio >= 0.6 且 averageValue <= 3: +1600
```

## 十、与现有策略的关系

新增策略只影响 `swap-hands`。

不会影响：

- 普通数字牌结构策略
- 同色丢弃策略
- 加牌链响应
- 罚抽响应
- 变色声明颜色
- 直接获胜

分数层级预期：

```txt
直接获胜: +10000
交换手牌强触发: +3000
高压 +10 / +6 等施压: 几百到一千以内
普通多张出牌: 几百
普通单张出牌: 一百左右
```

这样机器人在能直接赢时仍然先赢；不能赢但手牌很多或质量很差时，才优先交换。

## 十一、测试设计

建议新增或扩展机器人测试。

### 用例 1：手牌超过 15 张时优先交换

构造：

- 机器人手牌 16 张。
- 包含一张可出的 `swap-hands`。
- 同时包含其他可出的普通牌。

期望：

```ts
decision.command.type === "play-card"
decision.command.cardId === swapHandsCard.id
decision.score >= 3000
```

### 用例 2：手牌大多普通牌时优先交换

构造：

- 机器人手牌 8 到 10 张。
- 70% 以上是数字牌、禁、反转、同色丢弃、交换手牌。
- 包含一张可出的 `swap-hands`。
- 同时包含一张可出的普通数字牌。

期望：机器人选择打出 `swap-hands`。

### 用例 3：手里强牌较多时不强行交换

构造：

- 手牌不超过 15 张。
- 有 `+6`、`+10`、罚抽、黑变色等强牌。
- 包含一张可出的 `swap-hands`。
- 同时存在其他可出牌。

期望：

- `swap-hands` 不获得 3000 分。
- 机器人不会因为普通阈值误判而强行交换。

### 用例 4：手牌很少时不乱交换

构造：

- 手牌 3 到 4 张。
- 大多是普通牌。
- 有 `swap-hands`。

期望：

- 不触发 3000 分。
- 避免机器人快赢时打乱自己的优势。
