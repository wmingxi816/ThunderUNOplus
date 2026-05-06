# Problem 7：规则细节修正、退出房间流程和手牌区体验优化

## 问题背景

当前对局已经可以完成多人试玩闭环，但仍有一些细节会影响真实试玩体验：

1. 加牌链叠加规则仍不够严格，部分不应该允许的叠加被允许或在前端误高亮。
2. 反转牌和交换手牌牌面资源疑似对应反了，导致玩家看到的牌面和实际效果不一致。
3. 游戏中缺少明确的退出房间入口，退出后 reconnect 仍可能回到对战页面。
4. 普通 `+4`、`禁` 等技能牌存在点击出牌后没有成功打出的情况，需要确认规则层与前端判断是否一致。
5. 普通摸牌摸到可打出牌时，提示面板位置不够像弹窗，容易被牌桌内容淹没。
6. 手牌高亮逻辑过宽：只要存在对子或顺子就高亮，但实际颜色不符合时不能打出。
7. 顺子出牌后的弃牌堆叠放顺序不符合直觉，需要让第一张在最下面，最后一张在最上方。
8. 手牌区卡牌偏小且横向滚动体验不好，需要扩大卡牌并支持自动换行。

本问题对应原问题：

- 加牌链规则修正。
- 反转和交换手牌 UI 资源对应关系修正。
- 游戏界面退出房间，并避免退出后自动重连回对战。
- 普通 `+4`、`禁` 等技能牌出牌失败排查。
- 普通摸牌可打出牌提示改成居中弹窗。
- 对子、顺子候选高亮逻辑收窄。
- 顺子弃牌堆叠放顺序优化。
- 手牌区放大、换行和选中动效优化。

## 本阶段目标

本阶段要同时处理规则正确性和基础交互体验：

1. 明确并修复加牌链叠加规则。
2. 保证前端高亮、按钮可用状态和服务端规则一致。
3. 修正卡牌图片和卡牌代码之间的对应关系。
4. 在对战界面提供明确的退出房间入口。
5. 退出房间后清理本地重连状态，避免点击重新连接又回到旧对战。
6. 普通摸牌后的“立即打出 / 保留”提示改成牌桌中央弹窗。
7. 手牌候选高亮只提示真正可能组成合法出牌的牌。
8. 优化手牌区尺寸、换行和选中动画。

## 不要做什么

本阶段不要做：

- 不新增玩法规则。
- 不改牌库数量和卡牌种类。
- 不做房内重新开局。
- 不做账号系统、数据库、商城、支付、排行榜。
- 不重写 WebSocket 协议整体结构。
- 不大规模重构前端架构。
- 不破坏已有 `data-testid`，除非同步更新测试。

## 需要检查的文件

请优先审计：

1. `GAME-RULES.md`
2. `CARD-CONFIG.md`
3. `packages/uno-core/src/rules/canStackDrawCard.ts`
4. `packages/uno-core/src/rules/canStackDrawCard.test.ts`
5. `packages/uno-core/src/rules/canPlayCard.ts`
6. `packages/uno-core/src/reducer/applyPlayCard.ts`
7. `packages/uno-core/src/reducer/applyCommand.turn.test.ts`
8. `packages/uno-core/src/reducer/applyCommand.draw.test.ts`
9. `apps/client-web/src/main.ts`
10. `apps/client-web/src/battle/selection.ts`
11. `apps/client-web/src/battle/selection.test.ts`
12. `apps/client-web/src/cards/cardAssets.ts`
13. `apps/client-web/src/cards/cardAssets.test.ts`
14. `apps/client-web/src/styles.css`
15. `apps/game-server/src/room/roomManager.ts`
16. `apps/game-server/src/gateway/messageHandler.ts`
17. `packages/protocol/src/messages.ts`
18. `packages/shared-types/src/player.ts`
19. `packages/shared-types/src/snapshot.ts`

## 任务 1：加牌链叠加规则修正

当前问题：

```txt
普通带颜色的 +4 不能接在黑色 +4 后面。
黑色 +6 不能接在黑色 +10 后面。
黑色 +4 不能接在黑色 +10 +6 后面。
当前加牌链判断疑似只比较 drawValue，导致部分非法叠加被允许或被前端误提示。
```

规则要求：

1. 普通带颜色 `+4` 只能按规则接在允许的加牌链后面，不能接在黑色 `+4` 后面。
2. 黑色 `+6` 不能接在黑色 `+10` 后面。
3. 黑色 `+10` 应该是更高等级的加牌压力，不能被低等级黑色加牌覆盖。
4. 加牌链中允许叠加的卡牌种类必须由 `uno-core` 统一判断。
5. 前端只能根据快照做展示和提示，不能复制一套独立规则。

建议修改方案：

1. 在 `packages/uno-core/src/rules/canStackDrawCard.ts` 中明确叠加矩阵。
2. 将判断从“只看 drawValue”改成“同时看上一张加牌类型 / 上一张加牌值 / 下一张牌类型”。
3. 如果当前 `drawStack` 只保存 `previousDrawValue` 不够表达规则，优先评估是否需要在核心状态中补充上一张加牌 kind，例如 `previousDrawKind` 或 `lastStackCardKind`。
4. 如果需要扩展状态，必须同步更新：
   - `packages/shared-types/src/game.ts`
   - `packages/shared-types/src/snapshot.ts`
   - `packages/uno-core/src/view/createPlayerGameSnapshot.ts`
   - `packages/protocol/src/messages.test.ts`
5. 补充规则测试，至少覆盖：
   - 普通 `+4` 不能接黑色 `wild-reverse-draw-four`。
   - 黑色 `wild-draw-six` 不能接黑色 `wild-draw-ten`。
   - 合法的同类或更高优先级叠加仍可正常出。
   - 非加牌牌不能在加牌链中打出。

验收标准：

1. 服务端拒绝非法加牌叠加。
2. 前端不再把非法加牌牌标成可出。
3. 非法点击时页面能显示明确错误。
4. 原有合法加牌链流程不回退。

## 任务 2：修正反转和交换手牌卡牌图片对应关系

当前问题：

```txt
反转和交换手牌对应的卡牌 UI 疑似弄反。
玩家看到的图片可能是反转，但实际代码执行交换手牌；或看到交换手牌，实际执行反转。
```

要求：

1. `reverse` 必须显示反转牌图片。
2. `swap-hands` 必须显示交换手牌图片。
3. 四种颜色都要检查：红、黄、蓝、绿。
4. 黑色反转变色 `+4` 不要误改成普通交换手牌。

建议修改方案：

1. 检查 `apps/client-web/src/cards/cardAssets.ts` 中 `actionIndexes` 和 `getCardAssetName`。
2. 对照 `public/cards` 下实际 PNG 文件名和图片内容，确认编号是否正确。
3. 如果只是编号反了，交换 `reverse` 和 `swap-hands` 的编号。
4. 如果只是文件名映射反了，修正 `getCardAssetName`。
5. 更新 `apps/client-web/src/cards/cardAssets.test.ts`，明确断言：
   - `reverse` 指向 `*_reverse.png`
   - `swap-hands` 指向 `*_swap.png`
6. 必要时补一张人工检查清单，避免只看文件名但图片内容仍错。

验收标准：

1. 所有颜色的反转牌显示反转图片。
2. 所有颜色的交换手牌牌显示交换手牌图片。
3. 点击对应牌后实际效果和图片一致。

## 任务 3：游戏界面退出房间流程

当前问题：

```txt
等待房间里有离开按钮，但对战界面缺少明显退出房间入口。
玩家在游戏中想退出时，只能关闭页面或刷新。
关闭后 reconnect 可能又进入旧对战。
其他玩家也看不出该玩家是主动退出还是暂时断线。
```

要求：

1. 对战界面也要有“退出房间”按钮。
2. 点击后发送 `leave-room`，而不是只清空前端状态。
3. 成功退出后清理本地 roomId / reconnect 缓存。
4. 退出后点击“重新连接”不能自动回到旧对战页面。
5. 其他玩家能看到该玩家状态变为“已退出房间”。
6. 如果最后一名玩家退出，仍按现有房间关闭逻辑处理。

建议修改方案：

1. 在 `apps/client-web/src/main.ts` 的对战 HUD 或结束页附近加入退出按钮，保留现有 `data-testid`，新增按钮建议使用 `data-testid="battle-leave-room-button"`。
2. 复用现有 `buildLeaveRoomMessage` 和 `leave-room` 协议。
3. 点击退出成功后清理：
   - `state.roomId`
   - `state.room`
   - `state.snapshot`
   - `LAST_ROOM_STORAGE_KEY`
   - 必要的 snapshot recovery 标记
4. 检查 `apps/game-server/src/room/roomManager.ts` 当前 leave 行为：
   - 如果是 lobby，可直接移除玩家。
   - 如果是 playing，需要决定是“移除玩家”还是“保留座位并标记 left”。
5. 为了让其他玩家看到“已退出房间”，建议在共享玩家状态中增加或复用明确状态：
   - 如果已有 `connectionStatus`，可扩展为 `left`。
   - 如果不希望改通用连接状态，可新增 `hasLeftRoom` / `leftAtMs`。
6. 同步更新玩家视角快照，确保 playing 中其他玩家能看到退出状态，但不能泄露手牌。
7. 更新前端座位徽标：退出玩家显示“已退出”，操作按钮禁用。
8. 更新 reconnect 流程：主动退出的用户不应自动发起旧房间 reconnect。

验收标准：

1. 游戏中可以点击退出房间。
2. 退出后自己回到大厅。
3. 退出后重新连接不会回到刚退出的对局。
4. 其他玩家看到该玩家“已退出房间”。
5. 断线重连和主动退出是两个不同状态。

## 任务 4：普通 `+4`、`禁` 等技能牌出牌失败排查

当前问题：

```txt
普通 +4、禁 等技能牌有时点击出牌后没有成功打出。
需要确认是前端误判可出、选牌 payload 错误、颜色选择流程缺失，还是 uno-core 规则拒绝。
```

要求：

1. 客户端展示“可出”的牌，服务端也应该接受。
2. 服务端拒绝时，前端必须显示明确错误原因。
3. 黑牌、带颜色技能牌、同色技能牌、同类型跨色技能牌都要区分测试。

建议修改方案：

1. 审计 `packages/uno-core/src/rules/canPlayCard.ts`，确认普通技能牌连接规则：
   - 同色可接。
   - 同类型是否可跨色接，以 `GAME-RULES.md` 为准。
   - `skip`、`reverse`、`swap-hands`、`draw-four` 的规则不要互相串。
2. 审计 `apps/client-web/src/main.ts` 中单牌出牌 payload：
   - 普通带颜色技能牌不应该要求选色。
   - 黑牌必须走颜色选择。
   - 当前处于 `drawStack` / `drawUntilColor` / `normalDrawOffer` 时，按钮状态要符合当前流程。
3. 审计 `getPlaySelectionPreview`、`getCardPlayDisabledReason` 等前端判断，避免前端显示可出但 core 拒绝。
4. 在 core 测试中补充普通 `+4`、`skip` 的合法和非法出牌用例。
5. 在 client smoke 测试中补充点击普通技能牌后发出的 command 结构。

验收标准：

1. 普通 `+4` 在合法条件下能成功打出。
2. `禁` 在合法条件下能成功打出并跳过目标玩家。
3. 非法条件下不会被高亮成可出。
4. 如果服务端拒绝，页面有清楚错误提示。

## 任务 5：普通摸牌可打出提示改成居中弹窗

当前问题：

```txt
普通摸牌阶段摸到可打出的牌后，当前提示位置不够明显。
它应该像选色弹窗一样覆盖在对战页面最上层，居中显示。
```

要求：

1. 弹窗覆盖在对战页面之上。
2. 弹窗居中显示。
3. 背景有轻微遮罩，但不要完全遮住牌桌信息。
4. 显示刚摸到的牌名或牌面。
5. 按钮包含：
   - 立即打出
   - 保留
6. 弹窗期间不要误触其他对战按钮。

建议修改方案：

1. 将 `renderNormalDrawOfferPrompt` 从普通 panel 改成 modal/backdrop 结构。
2. 样式可复用或参考 `color-picker-backdrop`、`color-picker-panel`。
3. 新增 class，例如：
   - `normal-draw-offer-backdrop`
   - `normal-draw-offer-modal`
4. 保留 `data-testid="normal-draw-offer"`，避免测试失效。
5. 如果摸到的牌无法找到，`立即打出` 按钮禁用，并显示“牌数据同步中”之类的提示。
6. 点击“立即打出”仍必须走服务端命令，不在前端裁定结果。

验收标准：

1. 摸到可出牌时弹窗出现在屏幕中心。
2. 弹窗视觉层级和选色弹窗一致。
3. 立即打出和保留功能保持可用。
4. 移动端竖屏不撑爆。

## 任务 6：对子和顺子候选高亮逻辑收窄

当前问题：

```txt
现在只要手里存在对子或顺子，相关牌就可能被高亮。
但颜色不符合当前出牌颜色时，这些牌实际不能出。
这会误导玩家。
```

明确规则：

1. 对子候选高亮：
   - 必须存在同数字、同颜色、可组成合法多牌出牌的对子。
   - 对子的颜色必须符合当前出牌颜色，或符合当前顶牌允许的连接规则。
   - 不符合当前颜色的对子不要高亮。
2. 顺子候选高亮：
   - 顺子至少满足项目现有规则要求的张数。
   - 顺子的第一张牌必须能连接当前牌。
   - 判断第一张牌时要考虑当前颜色。
   - 只有属于合法顺子路径的牌才高亮。

例子：

```txt
玩家手牌：红1、红2、绿3、蓝4、蓝5、蓝6、蓝7

当前颜色是绿色：
只有 3、4、5、6、7 这条顺子候选高亮。

当前颜色是红色：
1、2、3、4、5、6、7 可以作为顺子候选高亮。

当前颜色是蓝色：
只高亮蓝色牌本身并不代表顺子成立。
如果蓝4、蓝5、蓝6、蓝7 只有 4 张，达不到顺子最低要求，则不应该按顺子候选高亮。
```

建议修改方案：

1. 修改 `apps/client-web/src/battle/selection.ts` 中候选计算函数。
2. 不要只返回“所有可能参与顺子的数字牌”，而要返回“从当前牌面出发能合法打出的候选组合中的牌”。
3. 对顺子：
   - 先按数字连续性找所有长度达标的序列。
   - 再检查序列第一张是否能连接当前 `topCard/currentColor`。
   - 只有通过连接检查的序列才用于高亮。
4. 对对子：
   - 找同数字同颜色或项目规则允许的对子组。
   - 检查该组第一张或主牌是否能连接当前 `topCard/currentColor`。
   - 不能连接则不高亮。
5. 如果前端缺少当前牌面信息，应调整函数签名，让候选计算接收 `snapshot`，而不是只接收 `hand`。
6. 补充 `selection.test.ts`：
   - 当前颜色绿色时只高亮从绿3开始的顺子。
   - 当前颜色红色时高亮从红1开始的完整顺子。
   - 当前颜色蓝色但长度不足时不按顺子高亮。
   - 颜色不匹配的对子不高亮。

验收标准：

1. 高亮只提示真实可能合法打出的组合。
2. 不符合当前颜色的对子不会高亮。
3. 第一张不能连接当前牌的顺子不会高亮。
4. 单牌可出高亮和组合候选高亮不互相覆盖错乱。

## 任务 7：顺子出牌后的弃牌堆叠放顺序

当前问题：

```txt
顺子出牌后，弃牌堆 UI 的多张牌叠放顺序不符合直觉。
需要第一张牌在最下面，最后一张牌显示在最上方。
```

要求：

1. 顺子按出牌顺序展示。
2. 第一张牌层级最低。
3. 最后一张牌层级最高。
4. 不影响同点多牌、同色丢弃、加牌链展示。

建议修改方案：

1. 审计 `apps/client-web/src/main.ts` 中 `renderLatestPlayedGroup`、`orderLatestPlayedCards`、`classifyPlayedGroup`。
2. 对 `sequence` 模式单独设置 z-index：
   - index 越小层级越低。
   - index 越大层级越高。
3. 如果 CSS 里使用 `--fan-index`，确保顺子最后一张的 `--fan-index` 最大。
4. 检查弃牌堆历史牌和最新牌组是否会互相遮挡。
5. 补充 smoke 测试：
   - 打出 `1-2-3-4-5` 后，最后一张牌 DOM 或样式层级最高。

验收标准：

1. 顺子第一张在视觉最下层。
2. 顺子最后一张在视觉最上层。
3. 其他多牌展示不回退。

## 任务 8：手牌区放大、换行和选中动画

当前问题：

```txt
手牌区卡牌偏小。
当手牌很多时主要依赖横向拖动条，不够适合试玩。
选中卡牌的反馈不够明显。
```

要求：

1. 手牌卡牌 UI 整体放大约 50%。
2. 手牌超出一行时自动换到下一行。
3. 不使用明显的横向滚动条作为主要浏览方式。
4. 选中卡牌后向上移动约 1/4 张卡牌高度。
5. 选中态要有清楚边框或阴影。
6. 移动端不能撑爆页面。

建议修改方案：

1. 修改 `apps/client-web/src/styles.css` 中 `.cards` 和 `.card-button` 布局。
2. 将当前横向 grid / overflow 模式改成可换行布局，例如：
   - `display: flex`
   - `flex-wrap: wrap`
   - 固定或响应式 `flex-basis`
3. 桌面端卡牌宽度增加约 50%，但设置 `max-width`，避免超大屏过度放大。
4. 移动端单独设置较小尺寸，避免 320px 宽度撑爆。
5. 选中态使用 `transform: translateY(-25%)` 或按卡牌高度折算的稳定值。
6. 选中态需要保留当前已有 selected class，不改变选牌逻辑。
7. 检查 hover、disabled、recent-drawn、combo-candidate 多状态叠加时是否抖动。
8. 如果布局换行导致 Playwright 移动端截图变化，更新或补充移动端断言。

验收标准：

1. 桌面端手牌明显变大。
2. 手牌很多时能自动换行。
3. 页面不出现难用的横向拖动条作为主要浏览方式。
4. 选中牌明显上移约 1/4 张牌。
5. 选中、可出、不可出、刚摸到、组合候选状态都能同时看清。
6. 移动端竖屏和横屏不撑爆。

## 验收标准

完成后至少满足：

1. 加牌链非法叠加被服务端拒绝，前端也不误高亮。
2. 普通带颜色 `+4` 不能接黑色 `+4`。
3. 黑色 `+6` 不能接黑色 `+10`。
4. 反转和交换手牌图片与实际效果一致。
5. 对战界面可以退出房间。
6. 主动退出后不会自动重连回旧对战。
7. 其他玩家能看到“已退出房间”状态。
8. 普通 `+4`、`禁` 等技能牌合法时能成功打出。
9. 普通摸牌可出提示为居中弹窗。
10. 对子和顺子候选高亮符合当前颜色和合法出牌规则。
11. 顺子弃牌堆中最后一张显示在最上方。
12. 手牌区更大、可换行，选中动画更明显。
13. 原有核心测试、前端单测、E2E 不回退。

## 测试命令

至少运行：

```bash
corepack pnpm --filter @thunder-uno/uno-core test
corepack pnpm --filter @thunder-uno/client-web typecheck
corepack pnpm --filter @thunder-uno/client-web test
corepack pnpm --filter @thunder-uno/client-web build
corepack pnpm --filter @thunder-uno/client-web test:e2e
corepack pnpm --filter @thunder-uno/game-server test
corepack pnpm typecheck
corepack pnpm test
```

如果修改了协议或共享类型，还需要重点确认：

```bash
corepack pnpm --filter @thunder-uno/protocol test
corepack pnpm --filter @thunder-uno/shared-types build
```
