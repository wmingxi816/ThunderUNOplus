# problem2.md

```md
# Problem 2：手牌可选状态与非法出牌提示系统

## 问题背景

当前手牌 UI 中，不可出的牌仍然可以被选中，或者只是高亮不明确。玩家不知道为什么某些牌不能出，也不知道当前选中的牌还能和哪些牌组合。

本问题对应原问题：

- 1. 不可出的牌应禁止选中，而不是可选但不高亮
- 2. 选中可出牌后，该牌上移，不可搭配牌变暗，点击非法牌弹窗提示
- 5. +10 存在时错误高亮绿色普通牌
- 14. 不可出的牌太黑，只需要稍微暗一点
- 18. 手牌第一张和第二张有重叠

## 本阶段目标

重构手牌选择体验：

1. 不可出的牌不能被选中。
2. 点击不可出的牌时，显示明确原因。
3. 选中一张牌后，能搭配的牌保持亮，不可搭配的牌轻微变暗。
4. 再次点击已选牌时取消选中。
5. 顺子候选牌用紫色框提示。
6. 不可出牌只轻微变暗，不要黑成看不清。
7. 修复手牌第一张和第二张重叠问题。

## 不要做什么

本阶段不要做：

- 不改核心规则结果，规则 bug 已在 Problem 1 处理。
- 不做出牌飞行动画。
- 不做弃牌堆散落。
- 不做摸牌动画。
- 不做大规模 UI 重构。
- 不做移动端整体重写。

## 需要检查的文件

请优先审计：

1. `apps/client-web/src/main.ts`
2. `apps/client-web/src/battle/selection.ts`
3. `apps/client-web/src/styles.css`
4. `apps/client-web/src/cards/cardAssets.ts`
5. `packages/uno-core/src/rules/canPlayCard.ts`
6. `packages/uno-core/src/rules/sequence.ts`
7. `packages/uno-core/src/rules/multiple.ts`
8. `packages/uno-core/src/rules/discardSameColor.ts`
9. `packages/uno-core/src/rules/canStackDrawCard.ts`

## 任务 1：手牌状态分类

每张手牌在 UI 中应被分成以下状态：

```txt
playable
可以直接出，正常亮度，可点击，可选中

combo-candidate
可以作为组合候选，例如顺子候选，显示紫色边框

selected
当前已选中，上移约 1/4 张牌高度

compatible
与当前已选牌可搭配，保持正常亮度

incompatible
与当前已选牌不可搭配，轻微变暗

disabled
当前局势下不能出，例如不是当前回合、drawStack 阶段普通牌，不能选中

要求：

disabled 和 incompatible 不能被选中。
但点击它们时，要弹窗提示原因。
不要只通过颜色区分所有状态，要有边框、上移、透明度组合。
任务 2：不可出牌点击提示

当前不可出的牌不能被选中，但玩家点击时需要提示原因。

示例提示：

还没轮到你出牌
当前有加牌链，只能叠加加牌牌或结算罚摸
这张牌不能接当前颜色
这张牌不能和已选牌组成顺子
连对必须是相同颜色和相同数字
同色丢弃不能包含黑牌

建议实现结构：

type InvalidSelectionReason = {
  code: string;
  message: string;
  priority: number;
  category:
    | "state"
    | "forced-action"
    | "selection-shape"
    | "card-match"
    | "combo"
    | "missing-parameter";
};

提醒优先级：

1. 当前不能操作
2. 当前局势强约束，例如 drawStack / drawUntilColor
3. 当前选择形状错误
4. 牌面颜色 / 数字 / 类型不匹配
5. 缺少参数，例如未选颜色

页面只展示一条最高优先级提示。

任务 3：选中牌上移与取消

要求：

玩家点击一张可出的牌，该牌上移约 1/4 张牌高度。
该牌进入 selected 状态。
与它可搭配的牌保持亮。
与它不可搭配的牌轻微变暗。
玩家再次点击这张牌时，该牌缩回。
缩回后恢复初始可出牌提示。

CSS 建议：

.selected-card {
  transform: translateY(-25%);
}

注意：

上移不能导致手牌区高度剧烈抖动。
任务 4：顺子候选紫色框

你需要判断玩家手牌是否存在组成顺子的可能。

要求：

当玩家手牌中存在可组成顺子的数字链时，
这些顺子候选牌显示紫色边框。

例如手牌：

1 2 3 4 4 5 5 6 6 6

即使有重复数字，所有可能参与顺子的牌都显示紫色框。

注意：

紫色框只表示“有顺子潜力”，不表示当前选择一定合法。
最终出牌仍要校验是否满足顺子规则。

需要支持：

顺子至少 5 张
只能包含数字牌
数字必须连续
重复数字不能同时组成同一条顺子
任务 5：不可出牌不要太黑

当前不可出牌 UI 太黑。

要求：

不可出牌 opacity 建议 0.55 到 0.7
不要低于 0.45
牌面仍然可读

同时可以增加：

轻微灰色蒙层
cursor: not-allowed
点击后提示原因
任务 6：修复第一张和第二张手牌重叠

当前问题：

手牌第一张牌和第二张牌有一点重叠。

检查并修复：

hand-area padding-left
card margin
scroll snap 起点
selected 状态 transform 后的位置
移动端横向滚动起点

要求：

第一张牌不能被第二张盖住
选中第一张牌时不能被裁切
手机横向滚动时第一张牌完整可见
验收标准

完成后至少满足：

1. 不可出的牌不能被选中。
2. 点击不可出的牌会显示具体原因。
3. 可出的牌可以选中并上移。
4. 再次点击已选牌会取消选中。
5. 选中一张牌后，不可搭配牌轻微变暗。
6. 顺子候选牌有紫色边框。
7. 不可出牌仍然能看清牌面。
8. 手牌第一张和第二张不重叠。
9. drawStack 阶段不会错误高亮普通绿色牌。
10. 原有 E2E 不被破坏。
测试命令

至少运行：

corepack pnpm --filter @thunder-uno/client-web typecheck
corepack pnpm --filter @thunder-uno/client-web test
corepack pnpm --filter @thunder-uno/client-web test:e2e
corepack pnpm --filter @thunder-uno/client-web build
corepack pnpm typecheck
corepack pnpm test