# UI 区域命名表

这个文档用于后续沟通 UI 调整。你可以直接说这里的区域名，例如“把 `battle-center-table` 往左移一点”或“把 `lobby-room-code-panel` 的按钮改蓝色”。

## 通用区域

| 区域名 | 页面 | 对应代码 | 说明 |
| --- | --- | --- | --- |
| `app-shell` | 全局 | `render()` / `.shell` | 整个网页客户端外壳。 |
| `app-topbar` | 大厅 | `render()` / `.topbar` | 大厅顶部标题和连接状态。 |
| `app-toast` | 全局 | `renderToastPanel()` / `.ui-toast` | 顶部临时提示条。 |
| `rule-modal` | 全局 | `renderRuleModal()` / `.rule-modal` | 规则讲解弹窗。 |
| `rule-entry-buttons` | 全局 | `renderRuleEntryButtons()` / `.rule-entry-grid` | 基础玩法、特色玩法、质疑规则、卡牌介绍四个入口。 |
| `rule-image-viewer` | 全局 | `renderRuleImageViewer()` / `.rule-image-viewer` | 规则图片翻页窗口。 |

## 大厅界面

| 区域名 | 对应代码 | 说明 |
| --- | --- | --- |
| `lobby-root` | `renderLobbyPanel()` / `.lobby-layout` | 大厅主布局，包含左侧创建加入、右侧房间状态、下方规则讲解。 |
| `lobby-connection-panel` | `renderConnectionPanel()` / `.connection-panel` | 服务端地址、昵称、改名、连接状态按钮。 |
| `lobby-create-join-panel` | `renderLobbyPanel()` / `.lobby-control` | 组局大厅面板。 |
| `lobby-mode-select` | `renderLobbyPanel()` / `#mode` | 无质疑/有质疑模式选择。 |
| `lobby-room-code-panel` | `renderRoomCodeInputs()` / `.room-code-inputs` | 6 位房间号输入框。 |
| `lobby-room-actions` | `renderLobbyPanel()` / `.lobby-actions` | 生成房间号、复制房间号、加入房间、离开按钮。 |
| `lobby-hints` | `renderLobbyPanel()` / `.lobby-hints` | 3 人开局、8 人上限等提示。 |
| `lobby-room-status-panel` | `renderLobbyPanel()` / `.lobby-status` | 等待席/房间状态主面板。 |
| `lobby-empty-state` | `renderEmptyLobbyState()` / `.empty-lobby` | 未进入房间时的空状态。 |
| `lobby-room-meta` | `renderRoomState()` / `.room-meta` | 房间号、模式、状态、房主信息。 |
| `lobby-player-list` | `renderRoomState()` / `.players` | 大厅玩家/机器人/空座位列表。 |
| `lobby-player-pill` | `renderRoomState()` / `.player-pill` | 大厅中的单个玩家条目。 |
| `lobby-host-actions` | `renderRoomState()` / `.host-room-actions` | 房主的添加机器人、开始游戏按钮。 |
| `lobby-ready-button` | `renderRoomState()` / `#ready-button` | 非房主准备按钮。 |
| `lobby-rules-guide` | `renderRulesGuidePanel()` / `.rules-guide` | 大厅底部规则讲解框架。 |

## 对战界面

| 区域名 | 对应代码 | 说明 |
| --- | --- | --- |
| `battle-root` | `renderBattlePanel()` / `.battle-immersive` | 对战页面根容器。 |
| `battle-stage` | `renderBattlePanel()` / `.battle-stage` | 对战舞台背景区域。 |
| `battle-debug-grid` | `renderBattleDebugGrid()` / `.battle-debug-grid` | 临时调试网格线。 |
| `battle-turn-orbit` | `renderTurnDirectionOrbit()` / `.turn-direction-orbit` | 顺/逆时针旋转方向底图。 |
| `battle-top-hud` | `renderBattleHud()` / `.battle-hud` | 顶部状态栏：当前玩家、颜色、方向、牌堆数量、设置/规则/退出按钮。 |
| `battle-error-line` | `renderBattlePanel()` / `.battle-error-line` | 对战页错误提示。 |
| `battle-normal-draw-offer` | `renderNormalDrawOfferPrompt()` / `.normal-draw-offer` | 普通摸牌后“立即打出/保留”的弹窗。 |
| `battle-initial-direction-modal` | `renderInitialDirectionChoiceModal()` / `.initial-direction-modal` | 开局选择顺/逆时针弹窗。 |
| `battle-event-modal` | `renderEventModal()` / `.event-modal` | 胜利、淘汰、重开/继续等事件弹窗。 |
| `battle-table` | `renderBattlePanel()` / `.battle-table` | 对战区域主体，承载玩家卡片、中心牌区和特效。 |
| `battle-opponents-area` | `renderBattlePanel()` / `.opponents` | 其他玩家卡片容器。 |
| `battle-opponent-seat` | `renderOpponent()` / `.opponent.seat` | 其他玩家卡片。 |
| `battle-self-seat` | `renderSelfSeat()` / `.self-seat` | 自己的玩家卡片；当前不单独渲染，自己的信息由手牌区承载。 |
| `battle-seat-name` | `renderOpponent()` / `renderSelfSeat()` / `.seat strong` | 玩家卡片姓名 label。 |
| `battle-seat-count` | `renderOpponent()` / `renderSelfSeat()` / `.hand-count-badge` | 玩家卡片手牌数量 label。 |
| `battle-seat-status` | `renderSeatStatusBadge()` / `.seat-badge` | 玩家卡片状态 label。 |
| `battle-catch-uno-button` | `renderOpponent()` / `.opponent-actions button` | 抓 UNO 按钮。 |
| `battle-center-table` | `renderBattlePanel()` / `.center-table` | 摸牌区、牌堆区、状态提示区的总容器。 |
| `battle-draw-pile` | `renderBattlePanel()` / `.draw-pile` | 摸牌区：牌背图片和摸牌按钮。 |
| `battle-discard-pile` | `renderDiscardPile()` / `.discard-pile` | 牌堆区：顶牌、底牌堆、加牌链展示。 |
| `battle-discard-history` | `renderDiscardPile()` / `.discard-stack` | 底牌堆散乱历史牌。 |
| `battle-active-draw-chain` | `renderActiveDrawChain()` / `.active-draw-chain` | 加牌链平铺展示。 |
| `battle-table-facts` | `renderBattlePanel()` / `.table-facts` | 状态提示区：轮到谁、颜色、方向、加牌量。 |
| `battle-effects-layer` | `renderFlyingCard()` 等 / `.flying-card`、`.draw-stack-explosion`、`.penalty-question-burst` | 出牌飞行动画、罚抽爆炸、问号喷泉等特效。 |
| `battle-action-dock` | `renderBattlePanel()` / `.battle-action-dock` | 底部操作和手牌区域总容器。 |
| `battle-actions-panel` | `renderBattlePanel()` / `.actions` | UNO、出牌、顺子、连对等操作按钮面板。 |
| `battle-selection-panel` | `renderSelectionPanel()` / `.selection-panel` | 选中手牌后的操作区。 |
| `battle-hand-panel` | `renderBattlePanel()` / `.hand` | 手牌区域外框。 |
| `battle-hand-header` | `renderBattlePanel()` / `.hand-header` | 手牌区标题和数量。 |
| `battle-action-guide` | `renderActionGuide()` / `.action-guide` | 当前可操作提示文字。 |
| `battle-hand-cards` | `renderBattlePanel()` / `.cards` | 手牌按钮列表。 |
| `battle-card-button` | `renderCardButtonV2()` / `.card-button` | 单张手牌按钮。 |
| `battle-color-picker` | `renderColorPickerPanel()` / `.color-picker-panel` | 黑牌选择颜色面板。 |

## 说明

- 后续如果你说“顶部状态栏”，我会默认对应 `battle-top-hud`。
- 如果你说“牌堆旁边那个状态栏”，我会默认对应 `battle-table-facts`。
- 如果你说“摸牌区、牌堆区、状态提示区一起动”，我会默认调整 `battle-center-table` 或它的 CSS 变量。
- 如果你说“玩家卡片位置”，我会默认调整 `battle-opponent-seat` / `battle-self-seat`，其中其他玩家的相对位置由 `getOpponentSeatPlacement()` 计算。
