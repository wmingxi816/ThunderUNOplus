problem1.md
# Problem 1：卡牌资源与核心规则纠错

## 问题背景

当前《雷霆UNOplus》已经可以进行网页端对局，但有一些核心规则和卡牌资源映射存在错误。这一轮优先修复规则层和资源层问题，不要先做动画和复杂 UI。

本问题对应原问题：

- 5. 反转+4 叠加规则、+10 高亮错误
- 8. 同类型技能牌可以互接，但当前逻辑错误
- 9. 加牌链叠加规则不完整
- 10. 交换手牌规则没有实现
- 12. 反转牌和交换手牌牌的 UI 弄反了

## 本阶段目标

修复会直接影响游戏正确性的规则 bug：

1. 修正反转牌和交换手牌牌的 UI 资源映射。
2. 修正“相同类型技能牌可以互接”的规则。
3. 修正完整加牌链叠加规则。
4. 修正 +10 场景下普通绿色牌错误高亮的问题。
5. 实现交换手牌牌的实际手牌交换效果。

## 不要做什么

本阶段不要做：

- 不做出牌动画。
- 不做弃牌堆散落效果。
- 不做移动端视觉重构。
- 不做数据库、登录、商城、支付。
- 不新增新玩法规则。
- 不修改 CARD-CONFIG 的牌库数量。
- 不改变服务端权威规则架构。

## 需要检查的文件

请优先审计：

1. `apps/client-web/src/cards/cardAssets.ts`
2. `packages/uno-core/src/rules/canPlayCard.ts`
3. `packages/uno-core/src/rules/canStackDrawCard.ts`
4. `packages/uno-core/src/rules/discardSameColor.ts`
5. `packages/uno-core/src/reducer/applyPlayCard.ts`
6. `packages/uno-core/src/reducer/effects.ts`
7. `packages/uno-core/src/reducer/applyCommand.ts`
8. `apps/client-web/src/main.ts`
9. `apps/client-web/src/battle/selection.ts`
10. `packages/shared-types/src/card.ts`

## 任务 1：修正反转牌和交换手牌牌 UI 映射

当前问题：

```txt
反转牌和交换手牌牌的 UI 图片弄反了。

要求：

检查所有颜色版本的反转牌图片映射。
检查所有颜色版本的交换手牌图片映射。
确保 reverse 类型渲染的是反转牌图片。
确保 swap-hand 类型渲染的是交换手牌图片。
增加测试，防止未来再次映射反。

建议新增或修改测试：

apps/client-web/src/cards/cardAssets.test.ts

测试内容：

red reverse -> red reverse image
yellow reverse -> yellow reverse image
blue reverse -> blue reverse image
green reverse -> green reverse image

red swap-hand -> red swap-hand image
yellow swap-hand -> yellow swap-hand image
blue swap-hand -> blue swap-hand image
green swap-hand -> green swap-hand image
任务 2：修正相同类型技能牌可以互接

当前问题：

同色丢弃之后不能接其他颜色的同色丢弃，这是错误的。

正确规则：

红“同色丢弃”
可以接
绿“同色丢弃” + 绿2 + 绿禁

同理：

黄“反转” 可以接 红“反转”
绿“交换手牌” 可以接 黄“交换手牌”
蓝“禁” 可以接 红“禁”

要求：

普通接牌规则支持“相同技能类型可以互接”。
不同颜色但相同技能类型的功能牌可以打出。
这个规则要覆盖：
禁
反转
交换手牌
同色丢弃
普通 +2
普通 +4
罚抽
黑牌仍按黑牌自身规则处理。

建议规则结构：

可以接牌 =
颜色相同
OR 数字相同
OR 技能类型相同
OR 黑牌特殊规则允许

注意：

同类型技能牌可互接，不等于所有技能牌都可以互接。
任务 3：修正完整加牌链叠加规则

当前问题：

加牌叠加链没有完整实现。
+10 存在时，普通绿色牌错误高亮。
反转+4 不能正确叠反转+4。

正确规则：

普通 +2 后面，可以按照颜色叠普通 +4。

黑色反转 +4 可以叠在：
- 普通 +2
- 普通 +4
- 黑色反转 +4

黑色 +6 可以叠在：
- 普通 +2
- 普通 +4
- 黑色反转 +4
- 黑色 +6

黑色 +10 可以叠在所有加牌牌后面。

+10 可以叠 +10。

罚抽可以叠罚抽。

要求：

canStackDrawCard() 必须严格实现这些规则。
drawStack 激活时，只允许合法加牌牌高亮。
drawStack 激活时，普通数字牌、普通非加牌技能牌不应该高亮。
当前颜色不能让普通绿色牌错误变成可出。
服务端 reducer 和前端高亮逻辑必须一致。

需要补测试：

普通 +2 后可以叠同色普通 +4
普通 +2 后可以叠反转+4
普通 +4 后可以叠反转+4
反转+4 后可以叠反转+4
反转+4 后可以叠 +6
+6 后可以叠 +6
+6 后可以叠 +10
+10 后可以叠 +10
罚抽后可以叠罚抽
drawStack 激活时普通绿色牌不能出
任务 4：实现交换手牌效果

当前问题：

交换手牌牌打出后，玩家手牌并没有真正交换。

要求：

打出交换手牌后，必须根据规则执行手牌交换。
交换完成后更新双方 hand。
所有玩家收到新的 snapshot。
事件里应能体现交换手牌发生过。
如果交换对象有规则限制，必须按 rule 文档实现。
如果规则是“按出牌顺序交换”，则严格按出牌顺序处理。

需要补测试：

玩家 A 打出交换手牌后，A 和目标玩家手牌互换
交换后 handCount 正确
交换后 snapshot 不泄露其他玩家完整手牌
交换手牌事件被生成
验收标准

完成后至少满足：

1. 反转牌和交换手牌牌 UI 映射正确。
2. 同类型技能牌可以跨颜色互接。
3. 加牌链叠加规则符合 rule 文档。
4. drawStack 激活时不会错误高亮普通绿色牌。
5. 交换手牌牌会真实交换玩家手牌。
6. uno-core 相关测试通过。
7. client-web cardAssets 测试通过。
8. 全仓 typecheck / test 通过。
测试命令

至少运行：

corepack pnpm --filter @thunder-uno/uno-core test
corepack pnpm --filter @thunder-uno/client-web test
corepack pnpm --filter @thunder-uno/client-web typecheck
corepack pnpm --filter @thunder-uno/game-server test
corepack pnpm typecheck
corepack pnpm test