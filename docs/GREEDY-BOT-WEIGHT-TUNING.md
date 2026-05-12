# 贪心机器人权重调参方法

机器人权重不要只靠单局观感调整。当前项目采用两层测试：

1. 稳定性自走：三个相同 `greedy-v1` 机器人反复对局，确认不会卡死、不会产生非法命令。
2. A/B 对照赛：候选权重机器人轮流坐 1/2/3 号位，另外两个座位使用默认权重，用固定种子比较胜率。

## 为什么不能只看自走胜率

三个相同机器人互打时，胜率主要反映座位、牌序和随机数，不反映权重强弱。它适合发现：

- 是否卡死。
- 是否打出非法命令。
- 对局是否异常变长。
- 某类命令是否从未被选择。

但它不能证明一组新权重更强。

## 推荐命令

稳定性自走：

```bash
corepack pnpm --filter @thunder-uno/game-server bot:self-play -- --games 100 --seed 9000 --players 3 --max-steps 1500
```

A/B 对照赛：

```bash
corepack pnpm --filter @thunder-uno/game-server bot:self-play -- --evaluate pressure --games 100 --seed 22000 --players 3 --max-steps 1500
```

固定手牌场景评分：

```bash
corepack pnpm --filter @thunder-uno/game-server bot:scenario -- --scenario pressure --limit 6
```

固定手牌场景用于回答“某张牌在这个局势下应该排第几”。例如下家只剩 1 张、自己同时有红 `+2` 和黑色 `+6` 时，理想结果是优先打红 `+2`，保留 `+6` 作为后续更强资源。

三人局公平基线约为 `33.3%`。候选权重必须在座位轮换后稳定高于这个值，才值得考虑进入默认策略。

## 采纳标准

一组候选权重至少满足：

- `rejected=0`
- `stuck=0`
- 100 局以上座位轮换胜率明显高于 `33.3%`
- 平均步数没有异常升高
- 命令分布没有明显退化，例如几乎不打组合牌、几乎不喊 UNO、过度摸牌

如果候选只在小样本中领先，大样本回到 `33.3%` 附近，应当视为没有有效提升。

## 固定手牌场景的用途

固定手牌场景比整局自走更适合调单张牌分值：

- 先构造一个明确局势，例如下家 1 张、自己有 `红+2`、`红禁`、`+6`。
- 看评分表中候选动作的顺序是否符合策略预期。
- 如果单局排序不合理，调整相关权重。
- 调整后必须再跑批量自走和 A/B 对照，避免局部变聪明、整体变弱。

当前样例：

```txt
Scenario pressure | current=bot-1
01. score=720 play-card:...red-draw-two...
02. score=685 play-card:...wild-draw-six...
03. score=600 play-card:...red-skip...
04. score=-125 play-card:...red-9...
```

这个排序说明：有可出的有色压制牌时，机器人会优先用 `红+2` 压下家，同时保留更稀缺的 `+6`。

## 当前实验结论

`pressure` 候选权重增强了下家低手牌时的压制倾向。小样本 30 局座位轮换胜率为 `35.6%`，但 100 局座位轮换后为 `33.0%`，没有超过默认权重。

结论：暂不采纳为默认权重，只保留为实验候选。

固定手牌场景暴露出默认权重曾经过度消耗 `+6/+10`：当已有红 `+2` 能压制下家时，机器人仍然优先打 `+6`。因此默认权重已提高 `reserveWildDrawSixCost` 和 `reserveWildDrawTenCost`，并加入“如果存在其他可出压制牌，就不要完全免除黑牌保留成本”的判断。

## 后续可调方向

优先测试这些旋钮：

- `cardReduction`：影响机器人整体减牌欲望。
- `unoBonus` / `twoCardsLeftBonus`：影响冲刺倾向。
- `discardLargeHandBonus` / `discardMediumHandBonus`：影响同色丢弃使用频率。
- `reserveWildDrawSixCost` / `reserveWildDrawTenCost`：影响是否保留高价值黑牌。
- `drawCommandPenalty`：影响无明显好牌时是否更愿意摸牌。
- `isolatedNumberBaseBonus`：影响是否先打掉破坏组合价值低的孤立牌。

每次只改一组相关权重，跑同一批种子做对照。不要同时改太多，否则结果很难解释。
