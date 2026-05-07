# Problem 8：加牌链规则收紧、手牌重叠、UNO 时机、房内续局和自定义房间号

## 问题背景

当前版本已经完成了大厅、准备、对战、摸牌、出牌、UNO、淘汰、胜负弹窗和沉浸式 UI 的基础闭环，但真实试玩中又暴露出一批规则与交互细节问题：

1. `+6` 后面不应该继续出黑色变色、黑色 `+4`、普通 `+2`、普通 `+4`。
2. 黑色 `+4` 和普通 `+4` 后面不应该能叠普通 `+2`。
3. 当前代码看起来让普通 `+2` 可以叠在很多不该叠的加牌链后面。
4. 手牌区超过显示上限时出现横向滚动条，体验不符合预期。
5. 手牌高亮仍有误导：上一张是 `+6` 时，下家不该高亮黑色 `+4` / 普通 `+4` / 普通 `+2`。
6. 同色丢弃候选高亮过宽：当前颜色不对应时，相关主牌和附带牌不应该高亮。
7. 玩家打出倒数第二张牌后，系统推进回合，导致该玩家此时不是当前回合，不能点击 UNO。
8. 淘汰或胜利后，房主需要可以选择直接重开一把，或者继续游戏。
9. 自定义房间号需要更清楚的输入 UI 和服务端校验。

本 Problem 只以当前代码实现为分析依据，尤其是 `packages/uno-core/src/rules/canStackDrawCard.ts`、`packages/uno-core/src/reducer/applyPlayCard.ts` 和 `apps/client-web/src/main.ts`，不以规则文档做推断。

## 本阶段目标

1. 收紧 `uno-core` 中的加牌链判定规则。
2. 让服务端规则、前端手牌高亮、按钮可用状态保持一致。
3. 手牌区改成固定宽度下的自动重叠展示，不再出现横向滚动条。
4. 打出倒数第二张牌后，玩家可以立即点击 UNO。
5. 淘汰和胜利状态支持房主选择“重开一局”或“继续游戏”。
6. 支持自定义 6 位数字房间号，并把大厅输入改成 6 个固定输入框。

## 不要做什么

本阶段不要做：

1. 不改牌库种类和数量。
2. 不把规则判断复制到客户端作为权威逻辑。
3. 不绕过 `packages/protocol` 增加临时 WebSocket 消息。
4. 不引入数据库，仍然使用当前内存房间。
5. 不做账号系统、排行榜、商城、支付。
6. 不破坏现有 `data-testid`，除非同步更新测试。
7. 不把淘汰玩家从座位上删除，除非玩家主动退出房间。

## 当前代码里的加牌链规则

当前核心函数是：

```txt
packages/uno-core/src/rules/canStackDrawCard.ts
```

该函数接收：

```ts
nextCard
currentColor
previousDrawValue
previousDrawKind
```

它只判断“下一张牌能不能继续当前加牌链”。真正调用位置在：

```txt
packages/uno-core/src/reducer/applyPlayCard.ts
```

当 `state.drawStack.active === true` 时，单牌出牌必须通过 `canStackDrawCard()`，否则会返回 `CARD_NOT_PLAYABLE`。

### 1. 非加牌牌一律不能接加牌链

代码：

```ts
if (!isDrawCard(nextCard)) {
  return false;
}
```

含义：

1. 数字牌不能接加牌链。
2. 禁止牌、反转牌、换手牌、同色丢弃、普通变色都不能接加牌链。
3. 只有有 `drawValue` 语义的加牌牌能进入后续判断。

例子：

1. 前一张是红 `+2`，下一张出红 `5`：不允许。
2. 前一张是普通 `+4`，下一张出普通变色：不允许。
3. 前一张是黑色 `+6`，下一张出同色丢弃：不允许。

### 2. 有色加牌牌：同加牌值可以接

当前代码：

```ts
const sameDrawValue = nextCard.drawValue === previousDrawValue;
const sameColor = currentColor !== undefined && nextCard.color === currentColor;

return sameDrawValue || sameColor;
```

其中有色加牌牌包括：

1. 普通 `+2`
2. 普通 `+4`

当前规则允许“同加牌值跨颜色接链”。

例子：

1. 红 `+2` 后，蓝 `+2` 可以接。
2. 红 `+4` 后，蓝 `+4` 可以接。
3. 蓝 `+2` 后，黄 `+2` 可以接。

对应测试：

```txt
packages/uno-core/src/rules/canStackDrawCard.test.ts
allows red +2 to be followed by blue +2
allows red +4 to be followed by blue +4
```

### 3. 有色加牌牌：当前颜色相同也可以接

还是这一段：

```ts
return sameDrawValue || sameColor;
```

这意味着即使加牌值不同，只要颜色等于 `currentColor`，就能接。

例子：

1. 红 `+2` 后，如果 `currentColor` 是红色，红 `+4` 可以接。
2. 蓝 `+4` 后，如果 `currentColor` 是蓝色，蓝 `+2` 可以接。
3. 黑色 `+6` 声明蓝色后，如果当前颜色是蓝色，蓝 `+2` 当前代码会允许接。

这正是问题来源之一：`+6` 后不应该被普通 `+2` / `+4` 接住，但当前代码只要颜色相同就可能放行。

### 4. 当前代码禁止“有色加牌牌接在黑色加牌之后且数值大于等于上一张”

当前代码：

```ts
if (
  previousDrawKind !== null &&
  isBlackDrawKind(previousDrawKind) &&
  nextCard.drawValue !== undefined &&
  nextCard.drawValue >= previousDrawValue
) {
  return false;
}
```

黑色加牌种类由 `isBlackDrawKind()` 定义：

```ts
wild-reverse-draw-four
wild-draw-six
wild-draw-ten
```

当前效果：

1. 黑色 `+4` 后，普通 `+4` 不允许。
2. 黑色 `+6` 后，普通 `+6` 不存在；普通 `+4` 因为 `4 >= 6` 为 false，不会在这里被禁止，还会继续进入 `sameColor` 判断。
3. 黑色 `+6` 声明蓝色后，蓝 `+2` / 蓝 `+4` 会因为 `sameColor` 被允许。
4. 黑色 `+10` 后，普通 `+2` / 普通 `+4` 也可能因为 `sameColor` 被允许。

这条规则的本意像是在禁止“有色高等级牌压黑色加牌”，但实际没有禁止“低数值有色加牌接黑色加牌”，所以和本 Problem 的目标冲突。

### 5. 黑色加牌牌：只要数值大于等于上一张就可以接

当前代码：

```ts
if (!isBlackDrawCard(nextCard)) {
  return false;
}

if (nextCard.drawValue === undefined) {
  return false;
}

return nextCard.drawValue >= previousDrawValue;
```

黑色加牌牌包括：

1. 黑色反转 `+4`
2. 黑色 `+6`
3. 黑色 `+10`

当前效果：

1. 普通 `+2` 后，黑色反转 `+4` 可以接。
2. 普通 `+2` 后，黑色 `+6` 可以接。
3. 普通 `+4` 后，黑色反转 `+4` 可以接。
4. 普通 `+4` 后，黑色 `+6` 可以接。
5. 黑色 `+6` 后，黑色 `+10` 可以接。
6. 黑色 `+10` 后，黑色 `+6` 不可以接。
7. 黑色 `+10` 后，黑色反转 `+4` 不可以接。

当前问题：

1. `+6` 后黑色 `+4` 因为 `4 >= 6` 已经不允许，这一点与需求一致。
2. `+6` 后黑色变色不是 draw card，本身也不允许，这一点与需求一致。
3. 但 `+6` 后普通 `+2` / 普通 `+4` 仍可能因为 `sameColor` 被允许，需要修复。
4. 普通 `+4` / 黑色 `+4` 后普通 `+2` 也可能因为颜色匹配被允许，需要修复。

### 6. 当前加牌链累计值更新方式

当前代码在：

```txt
packages/uno-core/src/reducer/applyPlayCard.ts
resolveDrawCardEffect()
```

关键逻辑：

```ts
const baseAmount = state.drawStack.active ? state.drawStack.amount : 0;
const nextAmount = baseAmount + drawValue;

state.drawStack = {
  active: true,
  amount: nextAmount,
  previousDrawValue: drawValue,
  previousDrawKind: card.kind,
  targetPlayerId
};
```

含义：

1. 每接一张加牌牌，会把新牌的 `drawValue` 累加到 `drawStack.amount`。
2. `previousDrawValue` 永远变成最后一张加牌牌的数值。
3. `previousDrawKind` 永远变成最后一张加牌牌的种类。
4. 下一次能不能继续接，只看“上一张加牌牌”，不是看整条链里所有牌。

例子：

1. 红 `+2` -> 蓝 `+2` 后，累计变成 `4`，上一张值仍是 `2`。
2. 红 `+2` -> 黑色 `+6` 后，累计变成 `8`，上一张值变成 `6`。
3. 黑色 `+6` -> 黑色 `+10` 后，累计变成 `16`，上一张值变成 `10`。

## 目标加牌链规则

本阶段建议把规则明确成“有色牌按同等级叠，黑色牌只能升级，不能降级，且 `+6` 之后只能用更高黑色加牌继续”。

### 目标规则 1：普通 `+2`

普通 `+2` 只能接在上一张普通 `+2` 后面。

允许：

1. 红 `+2` -> 蓝 `+2`
2. 红 `+2` -> 红 `+2`

禁止：

1. 普通 `+4` -> 普通 `+2`
2. 黑色反转 `+4` -> 普通 `+2`
3. 黑色 `+6` -> 普通 `+2`
4. 黑色 `+10` -> 普通 `+2`

### 目标规则 2：普通 `+4`

普通 `+4` 只能接在上一张普通 `+4` 后面，或者作为普通 `+2` 链的升级牌是否允许需要产品确认。

根据本次问题描述，至少必须禁止：

1. 黑色 `+6` -> 普通 `+4`
2. 黑色反转 `+4` -> 普通 `+4`
3. 黑色 `+10` -> 普通 `+4`

建议本阶段直接收紧为：

1. 普通 `+4` 只接普通 `+4`。
2. 普通 `+2` 不再通过颜色接普通 `+4`。

这样可以避免“颜色匹配导致跨等级乱接”的问题。

### 目标规则 3：黑色反转 `+4`

黑色反转 `+4` 可以接普通 `+2` 或普通 `+4`，但不能接在黑色 `+6` 或黑色 `+10` 后面。

允许：

1. 普通 `+2` -> 黑色反转 `+4`
2. 普通 `+4` -> 黑色反转 `+4`
3. 黑色反转 `+4` -> 黑色反转 `+4`

禁止：

1. 黑色 `+6` -> 黑色反转 `+4`
2. 黑色 `+10` -> 黑色反转 `+4`

### 目标规则 4：黑色 `+6`

黑色 `+6` 可以接普通 `+2`、普通 `+4`、黑色反转 `+4`，但 `+6` 后不能被低级牌继续接。

允许：

1. 普通 `+2` -> 黑色 `+6`
2. 普通 `+4` -> 黑色 `+6`
3. 黑色反转 `+4` -> 黑色 `+6`
4. 黑色 `+6` -> 黑色 `+6`
5. 黑色 `+6` -> 黑色 `+10`

禁止：

1. 黑色 `+6` -> 普通 `+2`
2. 黑色 `+6` -> 普通 `+4`
3. 黑色 `+6` -> 黑色反转 `+4`
4. 黑色 `+6` -> 普通变色

### 目标规则 5：黑色 `+10`

黑色 `+10` 是最高等级。

允许：

1. 普通 `+2` -> 黑色 `+10`
2. 普通 `+4` -> 黑色 `+10`
3. 黑色 `+6` -> 黑色 `+10`
4. 黑色 `+10` -> 黑色 `+10`

禁止：

1. 黑色 `+10` -> 普通 `+2`
2. 黑色 `+10` -> 普通 `+4`
3. 黑色 `+10` -> 黑色反转 `+4`
4. 黑色 `+10` -> 黑色 `+6`

## 需要修改的文件

优先修改：

1. `packages/uno-core/src/rules/canStackDrawCard.ts`
2. `packages/uno-core/src/rules/canStackDrawCard.test.ts`
3. `packages/uno-core/src/reducer/applyCommand.turn.test.ts`
4. `apps/client-web/src/main.ts`
5. `apps/client-web/src/battle/selection.ts`
6. `apps/client-web/src/battle/selection.test.ts`
7. `apps/client-web/src/styles.css`
8. `packages/uno-core/src/reducer/applyUno.ts`
9. `packages/uno-core/src/reducer/effects.ts`
10. `packages/uno-core/src/view/createPlayerGameSnapshot.ts`
11. `packages/shared-types/src/snapshot.ts`
12. `packages/protocol/src/messages.ts`
13. `apps/game-server/src/room/roomManager.ts`
14. `apps/game-server/src/gateway/messageHandler.ts`
15. `apps/game-server/src/gateway/parseMessage.ts`
16. `apps/game-server/src/broadcast/createRoomSnapshot.ts`
17. `apps/client-web/src/protocol/clientMessages.ts`
18. `apps/client-web/src/smoke/appBoot.test.ts`

## 任务 1：收紧加牌链规则

### 当前问题

当前 `canStackDrawCard()` 对有色加牌牌使用：

```ts
sameDrawValue || sameColor
```

这导致“颜色相同”可以绕过加牌等级限制。例如：

1. 黑色 `+6` 声明蓝色后，蓝 `+2` 可能被允许。
2. 黑色 `+6` 声明蓝色后，蓝 `+4` 可能被允许。
3. 普通 `+4` 后，如果当前颜色匹配，普通 `+2` 可能被允许。
4. 黑色反转 `+4` 后，如果当前颜色匹配，普通 `+2` 可能被允许。

### 修改方案

重写 `canStackDrawCard()` 的判断，不再用 `sameColor` 放行跨等级有色加牌。

建议实现辅助函数：

```ts
function getDrawStackRank(kind: DrawCardKind): number
```

建议等级：

```txt
draw-two: 2
draw-four: 4
wild-reverse-draw-four: 4
wild-draw-six: 6
wild-draw-ten: 10
```

然后按种类做判断：

1. `draw-two`：只允许接 `previousDrawKind === "draw-two"`。
2. `draw-four`：只允许接 `previousDrawKind === "draw-four"`。
3. `wild-reverse-draw-four`：允许接 `draw-two`、`draw-four`、`wild-reverse-draw-four`；不允许接 `wild-draw-six`、`wild-draw-ten`。
4. `wild-draw-six`：允许接 rank <= 6 的加牌链。
5. `wild-draw-ten`：允许接 rank <= 10 的加牌链。

如果产品希望保留“普通 `+2` 可接普通 `+4` 同色”这种旧规则，需要单独写成明确条件，而不是继续让 `sameColor` 全面放行。

### 必补测试

新增或修改：

```txt
packages/uno-core/src/rules/canStackDrawCard.test.ts
```

至少覆盖：

1. 黑色 `+6` 后普通 `+2` 不可接，即使当前颜色匹配。
2. 黑色 `+6` 后普通 `+4` 不可接，即使当前颜色匹配。
3. 黑色 `+6` 后黑色反转 `+4` 不可接。
4. 黑色 `+6` 后普通变色不可接。
5. 普通 `+4` 后普通 `+2` 不可接。
6. 黑色反转 `+4` 后普通 `+2` 不可接。
7. 普通 `+2` 后普通 `+2` 仍可接。
8. 普通 `+4` 后普通 `+4` 仍可接。
9. 普通 `+4` 后黑色 `+6` 仍可接。
10. 黑色 `+6` 后黑色 `+10` 仍可接。
11. 黑色 `+10` 后黑色 `+6` 不可接。

同步修改：

```txt
packages/uno-core/src/reducer/applyCommand.turn.test.ts
```

确保 reducer 层真实 `play-card` 命令也拒绝这些非法加牌链，而不是只有纯规则函数正确。

## 任务 2：修复前端手牌高亮与服务端规则不一致

### 当前问题 1：加牌链高亮跟随旧规则

前端 `apps/client-web/src/main.ts` 中：

```txt
getBaseHandCardPresentation()
canContinueDrawStack()
getPlaySelectionPreview()
```

会根据当前 snapshot 决定手牌是否高亮、可选、按钮是否可出。

如果前端仍然使用旧的 `sameColor` 或类似判断，即使服务端修复了 `canStackDrawCard()`，玩家也会看到不能出的牌被高亮。

### 修改方案

1. 前端不要手写一套与 `uno-core` 不一致的加牌链规则。
2. 如果当前前端已经复制了 `canContinueDrawStack()` 逻辑，要同步改成与 `canStackDrawCard()` 相同的规则。
3. 更推荐把 `canStackDrawCard()` 从 `@thunder-uno/uno-core` 暴露给客户端使用，前端只传 `snapshot.drawStack.previousDrawValue`、`snapshot.drawStack.previousDrawKind` 和 `snapshot.currentColor`。
4. 如果前端不能直接依赖 `uno-core` 运行时代码，也要在 `apps/client-web/src/battle/selection.ts` 建一个同名纯函数，并用测试锁住和 core 一致的结果。

### 必补前端测试

新增或修改：

```txt
apps/client-web/src/battle/selection.test.ts
apps/client-web/src/smoke/appBoot.test.ts
```

至少覆盖：

1. 上一张是黑色 `+6`，手牌里的黑色反转 `+4` 不高亮。
2. 上一张是黑色 `+6`，手牌里的普通 `+4` 不高亮。
3. 上一张是黑色 `+6`，手牌里的普通 `+2` 不高亮。
4. 上一张是普通 `+4`，手牌里的普通 `+2` 不高亮。
5. 上一张是黑色反转 `+4`，手牌里的普通 `+2` 不高亮。

### 当前问题 2：同色丢弃候选高亮过宽

当前 `canSelectionPotentiallyBeDiscardSameColor()` 只检查：

1. 已选牌非空。
2. 都不是黑牌。
3. 都同色。
4. 手牌里存在同色 `discard-same-color` 主牌。
5. 同色牌数量足够。

但它没有检查“同色丢弃主牌是否能接当前顶牌 / 当前颜色”。

因此会出现：

```txt
当前颜色：绿色
我的手牌：红色同色丢弃、红色禁、红4
```

这些红色牌可能被标记为组合候选，但红色同色丢弃主牌不能接绿色当前颜色，所以不应该高亮。

### 修改方案

1. `canSelectionPotentiallyBeDiscardSameColor()` 增加当前牌桌上下文参数。
2. 只有存在至少一张“同色丢弃主牌”能通过 `canPlaySingleCardLike(mainCard, snapshot)` 时，才允许该颜色的同色丢弃候选高亮。
3. `canCardJoinAnyCombo()` 不应只因为手牌里存在同色丢弃主牌就高亮，必须确认这个主牌能接当前颜色 / 顶牌。
4. `describeSelectionMismatch()` 中同色丢弃的错误提示也要跟随这个逻辑，提示“同色丢弃主牌不能接当前颜色”。

必补测试：

1. 当前颜色绿色，红色同色丢弃、红禁、红4 不高亮。
2. 当前颜色红色，红色同色丢弃、红禁、红4 可以作为同色丢弃候选。
3. 顶牌同类型允许接时，也要按 `canPlayCard()` 结果判断。

## 任务 3：手牌区固定长度下的自动重叠

### 当前问题

当前手牌区使用横向滚动：

```css
.battle-action-dock .cards {
  flex-wrap: nowrap;
  overflow-x: auto;
}
```

当手牌很多时，会出现可拖动滚动条。用户希望：

1. 手牌区长度固定。
2. 不出现横向滚动条。
3. 超出显示范围后，所有手牌向左移动并均匀重叠。
4. 每增加一张牌，重叠程度增加一点。
5. 打出牌后，如果剩余空间足够，则恢复普通不重叠状态。

### 修改方案

前端渲染手牌时计算布局变量。

位置：

```txt
apps/client-web/src/main.ts
renderBattlePanel()
renderCardButtonV2()
```

建议做法：

1. 给 `.cards` 增加 `data-hand-count` 或 CSS 变量 `--hand-count`。
2. 每张牌按钮增加序号变量 `--card-index`。
3. 用 CSS 计算卡牌基础宽度和可用宽度。
4. 当 `hand.length <= 普通可容纳数量` 时：
   - `gap` 正常。
   - `transform` 只保留选中上移动效。
   - 不重叠。
5. 当 `hand.length > 普通可容纳数量` 时：
   - `.cards` 改为 `position: relative`。
   - 每张 `.card-button` 使用 `position: absolute` 或 CSS transform。
   - 根据 `--card-index` 计算 `left`。
   - `left` 间距 = `(容器宽度 - 单张牌宽度) / (handCount - 1)`。
   - 每多一张牌，间距变小，也就是重叠更多。

实现上 CSS 很难直接拿到容器真实宽度参与计算，建议使用前端测量：

1. 在 `render()` 后用 `requestAnimationFrame(syncHandOverlapLayout)`。
2. 读取 `.cards` 容器宽度和第一张牌宽度。
3. 如果 `handCount * cardWidth + gap * (handCount - 1) <= containerWidth`：
   - 移除重叠 class。
   - 清理每张牌 inline style。
4. 否则：
   - 添加 `cards-overlap` class。
   - 计算 `step = (containerWidth - cardWidth) / (handCount - 1)`。
   - 每张牌设置 `style.left = index * step + "px"`。
   - 容器高度固定为卡牌高度加选中上移空间。

### 样式要求

1. `.battle-action-dock .cards` 不显示横向滚动条。
2. 重叠时，后面的牌盖在前面的牌上，`z-index` 随 index 增加。
3. hover / selected 时该牌临时抬高，并提升 `z-index`。
4. 最近摸到的红圈、可出牌高亮、选中上移动效必须保留。
5. 移动端也不能出现横向滚动条。

### 必补测试

因为 jsdom 对真实布局测量有限，建议至少补：

1. `renderCardButtonV2()` 输出 `data-card-index` 或 CSS 变量。
2. smoke 测试确认大量手牌时 `.cards` 存在重叠模式 class。
3. Playwright 移动端截图 / layout test 检查无横向 overflow。

## 任务 4：打出倒数第二张牌后 UNO 按钮立即可点

### 当前问题

前端 `renderBattlePanel()` 当前计算 `canSayUno` 时要求：

```ts
isConnected &&
isMyTurn &&
!isGameFinished &&
snapshot.self.handCount === 1 &&
!snapshot.self.hasCalledUno &&
snapshot.self.unoPendingSinceMs !== null &&
!snapshot.self.isEliminated
```

问题是：玩家打出倒数第二张牌后，`applyPlayCard.ts` 会调用 `resolveAdvance()` 或 `resolveDrawCardEffect()`，当前回合通常已经推进到下家。此时 `isMyTurn` 变成 false，导致 UNO 按钮不亮。

而 `applySayUnoCommand()` 服务端并不要求玩家必须是当前回合，只要求：

1. 对局未结束。
2. 玩家存在。
3. 玩家未淘汰。
4. 手牌数为 1。
5. `unoPendingSinceMs !== null`。

所以前端多加的 `isMyTurn` 限制是不合理的。

### 修改方案

1. 前端 `canSayUno` 去掉 `isMyTurn` 限制。
2. `getSayUnoDisabledReason()` 同步调整，不要因为“不是你的回合”禁用 UNO。
3. 只要满足：
   - 已连接
   - 对局未结束
   - 自己未淘汰
   - `handCount === 1`
   - `hasCalledUno === false`
   - `unoPendingSinceMs !== null`
   
   就让 UNO 按钮亮起。

### 必补测试

1. 前端 snapshot 中 `currentPlayerId !== self.playerId`，但 self 只剩 1 张且 `unoPendingSinceMs !== null`，UNO 按钮可点。
2. 点击 UNO 后发送 `say-uno` command。
3. 服务端已有 `applySayUnoCommand()` 不要求当前回合，补充测试明确这一点，避免未来误改。

## 任务 5：淘汰 / 胜利后房主可重开或继续

### 当前问题

当前代码里：

1. 手牌超过上限会 `markPlayerEliminatedIfNeeded()`。
2. 只剩 1 名未淘汰玩家时，`finishGame()` 结束对局。
3. 玩家出完最后一张牌会立即 `finishGame()`。
4. 前端结束后显示“返回大厅”，当前版本没有房内重开。

用户期望：

1. 有人被淘汰时，房主可以选择“重开一把”或“继续游戏”。
2. 如果继续游戏，被淘汰玩家不能出牌，但他的手牌区保持不动。
3. 别人看到被淘汰玩家头像框红色高亮。
4. 有人胜利时，房主也可以选择“重开一把”或“继续游戏”。
5. 如果继续游戏，胜利玩家头像框绿色高亮。

### 需要先明确的规则问题

这里有一个产品规则需要落实到代码：

1. “有人胜利”在当前代码中意味着 `GameState.status = "finished"`。
2. 如果选择“继续游戏”，需要把 finished 状态恢复为 in-progress，还是把胜利者标记为已完成但保留座位？
3. 胜利玩家继续留在房间但不能出牌，那么他应该被 `getNextActivePlayerId()` 跳过，类似淘汰玩家。
4. 如果胜利玩家不再参与，剩余玩家继续打，最终可能产生多个赢家，需要支持 `winnerPlayerIds` 追加。

建议新增概念：

```ts
player.roundOutcome: "active" | "eliminated" | "winner"
```

或者复用现有字段并新增：

```ts
player.isRoundWinner: boolean
```

### 修改方案 A：服务端权威继续 / 重开

新增协议消息：

```ts
type ClientRoomDecisionMessage =
  | {
      type: "restart-game";
      roomId: RoomId;
      playerId: PlayerId;
      seed?: ShuffleSeed;
    }
  | {
      type: "continue-game";
      roomId: RoomId;
      playerId: PlayerId;
    };
```

服务端 `RoomManager` 增加：

1. `restartGame(params)`
2. `continueGame(params)`

要求：

1. 只有房主可以操作。
2. 房间必须处于 playing / finished，且存在淘汰或胜利状态。
3. `restartGame` 重新调用 `createInitialGame()`，保留房间号、玩家、头像、座位、房主。
4. `continueGame` 不清空手牌，不重置弃牌堆，只调整状态让未结束玩家继续行动。

### 修改方案 B：继续游戏的状态处理

被淘汰玩家：

1. 继续保留 `isEliminated = true`。
2. `assertPlayableCurrentPlayer()` 已经禁止其出牌。
3. `getNextActivePlayerId()` 应继续跳过他。
4. 前端继续显示其手牌数 / 状态，头像框红色高亮。

胜利玩家：

1. 新增 `isRoundWinner` 或类似字段。
2. 继续游戏时，将该玩家从 active turn order 中跳过。
3. 前端头像框绿色高亮。
4. 他的手牌保持不动，可以是 0 张，也可以保留胜利时状态。
5. `winnerPlayerIds` 保留历史赢家。

### 前端 UI

1. 事件弹窗中，如果当前玩家是房主：
   - 显示“重开一把”
   - 显示“继续游戏”
2. 如果当前玩家不是房主：
   - 显示“等待房主选择”
3. 对战 HUD 或弹窗展示当前状态：
   - `玩家 X 已淘汰`
   - `玩家 Y 已获胜`
4. 座位样式：
   - 淘汰：红色高亮
   - 胜利：绿色高亮
5. 继续游戏后：
   - 被淘汰 / 胜利玩家不能操作
   - 其他玩家继续正常出牌

### 必补测试

1. 淘汰玩家不能出牌。
2. 淘汰后房主可以 `continue-game`。
3. 淘汰后房主可以 `restart-game`。
4. 非房主不能 `continue-game` / `restart-game`。
5. 胜利后房主可以选择重开。
6. 胜利后继续游戏时，胜利玩家被跳过。
7. 前端弹窗房主显示两个按钮，非房主显示等待文案。

## 任务 6：自定义房间号和 6 位固定输入框

### 当前问题

当前房间号：

1. 创建时由 `apps/game-server/src/ids/createRoomId.ts` 自动生成 6 位数字。
2. 前端大厅只有一个普通输入框 `#room-id-input`。
3. 创建房间按钮只有一个“创建房间”。

用户期望：

1. 房间号输入框改成 6 个固定数字框。
2. 一眼能看出必须输入 6 位数字。
3. 输入非数字时直接弹窗提示“请输入数字”。
4. 创建房间按钮拆成两个：
   - “自定义房间号”
   - “生成房间号”

### 协议修改

当前：

```ts
ClientCreateRoomMessage {
  type: "create-room";
  mode: GameMode;
}
```

建议新增可选字段：

```ts
customRoomId?: RoomId;
```

或更明确：

```ts
roomCode?: string;
```

要求：

1. 不传时，服务端继续自动生成。
2. 传入时，服务端必须校验：
   - 正好 6 位
   - 全部是数字
   - 当前内存房间里未占用
3. 占用时返回错误：
   - `room-id-taken`
4. 格式错误返回：
   - `invalid-room-id`

### 服务端修改

修改：

```txt
apps/game-server/src/room/roomTypes.ts
apps/game-server/src/room/roomManager.ts
apps/game-server/src/gateway/parseMessage.ts
apps/game-server/src/gateway/messageHandler.ts
packages/protocol/src/messages.ts
packages/protocol/src/errors.ts
```

`RoomManager.createRoom()`：

1. 如果 `params.roomId` 存在，走校验和占用判断。
2. 如果不存在，调用现有 `createRoomId()`。
3. 自定义房间号和自动生成房间号都必须走同一套去重逻辑。

### 前端 UI 修改

修改：

```txt
apps/client-web/src/main.ts
apps/client-web/src/styles.css
apps/client-web/src/protocol/clientMessages.ts
```

大厅中：

1. 把单个 `#room-id-input` 改成 6 个输入框。
2. 每个输入框只允许一位数字。
3. 输入数字后自动跳到下一格。
4. Backspace 时可回到上一格。
5. 粘贴 `123456` 时自动填满 6 格。
6. 如果输入非数字：
   - 阻止输入。
   - 显示 toast / 弹窗：“请输入数字”。
7. `加入房间` 从 6 格读取房间号。
8. “生成房间号”创建房间时不带自定义号。
9. “自定义房间号”创建房间时必须读取 6 格。
10. 如果不足 6 位，提示“请输入 6 位房间号”。

按钮：

```txt
自定义房间号
生成房间号
加入房间
离开
```

注意：

1. 保留旧的 `data-testid="join-room-input"` 可以改成 wrapper，或者同步更新测试。
2. 新增测试用 id：
   - `room-code-digit-0` 到 `room-code-digit-5`
   - `create-custom-room-button`
   - `create-random-room-button`

### 必补测试

1. 创建随机房间不传 `customRoomId`。
2. 创建自定义房间传 6 位数字。
3. 自定义房间号非数字前端拦截。
4. 自定义房间号不足 6 位前端拦截。
5. 服务端拒绝非 6 位数字。
6. 服务端拒绝已占用房间号。
7. 加入房间从 6 格读取完整 roomId。

## 任务 7：文档和测试同步

需要同步：

1. `README.md`
   - 更新房间号输入方式。
   - 更新创建房间方式。
   - 更新房主重开 / 继续游戏说明。
2. `docs/项目开发文档.md`
   - 加入 Problem8 索引。
   - 更新当前客户端能力。
3. `UI-DESIGN.md`
   - 补充手牌重叠设计。
   - 补充房间号 6 格输入设计。
4. 如本 Problem 完成后，加入：
   - `docs/Problem8.md`

## 完成标准

完成后至少满足：

1. `+6` 后不能出黑色变色、黑色反转 `+4`、普通 `+2`、普通 `+4`。
2. 黑色反转 `+4` 后不能叠普通 `+2`。
3. 普通 `+4` 后不能叠普通 `+2`。
4. 前端不再高亮这些非法加牌牌。
5. 同色丢弃主牌不能接当前颜色时，同色丢弃主牌和附带牌不高亮。
6. 手牌很多时不出现横向滚动条。
7. 手牌超出时自动均匀重叠，减少后自动恢复正常间距。
8. 打出倒数第二张牌后，即使回合已推进，UNO 按钮也会亮起。
9. 淘汰玩家头像红色高亮，不能出牌，手牌显示保持。
10. 胜利玩家头像绿色高亮。
11. 房主可以在淘汰 / 胜利后选择重开或继续。
12. 非房主不能重开或继续，只能等待房主。
13. 房间号输入为 6 个固定数字框。
14. 非数字输入会提示“请输入数字”。
15. 创建房间拆成“自定义房间号”和“生成房间号”。
16. 自定义房间号必须是未占用的 6 位数字。

## 至少运行

```bash
corepack pnpm --filter @thunder-uno/uno-core test
corepack pnpm --filter @thunder-uno/client-web typecheck
corepack pnpm --filter @thunder-uno/client-web test
corepack pnpm --filter @thunder-uno/game-server test
corepack pnpm typecheck
corepack pnpm test
```

如果修改了房间号输入和对战 UI，还需要运行：

```bash
corepack pnpm --filter @thunder-uno/client-web build
corepack pnpm --filter @thunder-uno/client-web test:e2e
```
