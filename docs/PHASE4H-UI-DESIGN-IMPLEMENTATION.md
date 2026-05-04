# Phase 4H：UI-DESIGN 对战界面落地

## 阶段目标

根据 `UI-DESIGN.md` 把网页端大厅、房间和对战界面的视觉与交互继续收口，重点补齐信息层级、操作反馈和规则提示，让当前版本更接近可持续试玩的桌面卡牌对战界面。

## 本次完成内容

### 1. 对战舞台与背景

对战页接入了新的舞台背景图 `apps/client-web/public/battle-stage.png`，让桌面从纯色面板切换成更完整的对战场景。

同时，界面增加了回合聚焦效果：

- 当前玩家回合时舞台更明亮
- 非当前回合时整体压暗
- 让轮到谁操作一眼可见

### 2. 大厅与房间信息层

大厅和房间里的玩家展示继续强化，增加了头像、昵称、房主标记和座位状态的表达。

这部分的目标是让玩家在加入房间后能直接看清：

- 房主是谁
- 房间里已经有几个人
- 自己处于什么状态

### 3. 出牌与摸牌交互统一

把对局中的多个出牌入口收拢成更统一的操作区，主要包括：

- 将顺子、同数字、同色弃牌等操作归并到统一的 `出牌` 按钮
- 摸牌按钮改成上下文感知状态
- 需要结算罚抽时直接显示对应动作
- 让玩家更容易判断当前到底该出牌还是摸牌

### 4. 颜色与规则反馈

颜色选择和规则提示做了更直接的表达：

- 颜色选择器使用真实色块
- 当前颜色用色块而不是英文文本
- 没有可用规则时，对应操作会被禁用
- 错误提示统一转成中文
- 关键操作增加了提示和 toast 反馈

### 5. 规则快照桥接

为了让前端能正确判断罚抽类状态，补充了快照字段 `drawStack.previousDrawValue` 的传递链路。

对应修改落在：

- `packages/shared-types/src/snapshot.ts`
- `packages/uno-core/src/view/createPlayerGameSnapshot.ts`
- `packages/protocol/src/messages.test.ts`

这一步的作用是把规则层需要的状态稳定带到客户端，不让前端只能靠猜。

### 6. 视觉细化

这轮还顺手做了几处 UI 细化：

- 选择区和主按钮层级重新整理
- 卡牌可操作状态更清楚
- 日志和提示区的可读性更高
- 对战区整体更像一个桌面式卡牌战场

## 修改文件

### 客户端

- `apps/client-web/src/main.ts`
- `apps/client-web/src/styles.css`
- `apps/client-web/public/battle-stage.png`

### 规则与快照

- `packages/shared-types/src/snapshot.ts`
- `packages/uno-core/src/view/createPlayerGameSnapshot.ts`
- `packages/protocol/src/messages.test.ts`

## 验证结果

已通过：

```bash
corepack pnpm --filter @thunder-uno/client-web typecheck
corepack pnpm --filter @thunder-uno/client-web test
corepack pnpm --filter @thunder-uno/client-web build
corepack pnpm --filter @thunder-uno/client-web test:e2e
corepack pnpm typecheck
corepack pnpm test
```

## 还未做的内容

- 更复杂的牌堆动画
- 公开试玩部署与 HTTPS / WSS 收口
- 头像选择 UI
- 房间内重新开局
- 更后续的正式发布准备

## 下一阶段建议

进入 `Phase 4I`：首版公开试玩部署准备。

