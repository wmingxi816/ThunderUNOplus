import type { ServerMessage } from "@thunder-uno/protocol";
import type {
  Card,
  CardColor,
  ErrorCode,
  GameEvent,
  GameMode,
  PlayerGameSnapshot,
  PlayerId,
  PlayerRoomSnapshot,
  RoomId
} from "@thunder-uno/shared-types";
import { readInitialConfig } from "./app/config";
import {
  buildDiscardSameColorPayload,
  canPlayMultipleNumberSelection,
  getSequenceCandidateCardIds,
  getSelectedCards,
  isValidSequenceSelection
} from "./battle/selection";
import { getCardAssetPath, getCardBackAssetPath } from "./cards/cardAssets";
import { WsClient, type ConnectionStatus } from "./network/wsClient";
import {
  buildCommandMessage,
  buildAddBotMessage,
  buildContinueGameMessage,
  buildCreateRoomMessage,
  buildJoinRoomMessage,
  buildKickPlayerMessage,
  buildLeaveRoomMessage,
  buildPingMessage,
  buildReconnectMessage,
  buildRestartGameMessage,
  buildSetReadyMessage,
  buildStartGameMessage,
  type ClientCommandInput,
  createUserId
} from "./protocol/clientMessages";
import "./styles.css";

interface AppState {
  wsUrl: string;
  userId: string;
  nickname: string;
  connectionStatus: ConnectionStatus;
  roomId: RoomId | null;
  playerId: PlayerId | null;
  room: PlayerRoomSnapshot | null;
  snapshot: PlayerGameSnapshot | null;
  lastError: string | null;
  log: string[];
  selectedCardIds: string[];
  handCardMotion: Record<string, "select" | "deselect">;
  recentDrawnCardIds: string[];
  colorPickerCardId: string | null;
  latestCardsPlayedEvent: CardsPlayedAnimationEvent | null;
  latestPlayGroupEvent: CardsPlayedAnimationEvent | null;
  latestPlayGroupAnimationKey: string | null;
  flyingCard: FlyingCardAnimation | null;
  drawFlyingCard: DrawFlyingCardAnimation | null;
  drawStackBurst: DrawStackBurstAnimation | null;
  challengePrompt: ChallengePromptState | null;
  eventModal: EventModalState | null;
  ruleModal: RuleModalView | null;
  uiToast: UiToastState | null;
  dismissedFinishedNoticeKey: string | null;
  snapshotRecoveryRoomId: RoomId | null;
  roomCodeDigits: string[];
}

interface CardsPlayedAnimationEvent {
  playerId: PlayerId;
  cardIds: string[];
  topCardId: string;
  receivedAt: number;
  animationKey: string;
}

interface FlyingCardAnimation {
  key: string;
  card: Card;
  playerId: PlayerId;
  seatClass: string;
}

interface DrawFlyingCardAnimation {
  key: string;
  playerId: PlayerId;
  seatClass: string;
  count: number;
}

interface DrawStackBurstAnimation {
  key: string;
  cards: Card[];
}

interface ChallengePromptState {
  targetPlayerId: PlayerId;
  openedAt: number;
  dismissed: boolean;
}

interface EventModalState {
  key: string;
  title: string;
  message: string;
  tone: "warning" | "success";
  dismissible: boolean;
}

interface UiToastState {
  key: string;
  message: string;
  tone: "info" | "success" | "warning";
}

interface CardHint {
  className: "playable" | "unplayable" | "neutral";
  label: string;
}

type HandCardBaseState = "playable" | "combo-candidate" | "disabled";

type HandCardRelationState = "selected" | "compatible" | "incompatible" | null;

interface HandCardPresentation {
  baseState: HandCardBaseState;
  relationState: HandCardRelationState;
  reason: string;
  canSelect: boolean;
  sequenceCandidate: boolean;
}

type RuleEntryId = "basic" | "special" | "challenge" | "cards";
type RuleImageGroupId = Exclude<RuleEntryId, "cards">;

type RuleModalView =
  | { type: "home" }
  | { type: "image-group"; groupId: RuleImageGroupId; pageIndex: number }
  | { type: "card-list" }
  | { type: "card-rule"; cardId: string; pageIndex: number };

interface RuleEntryButton {
  id: RuleEntryId;
  label: string;
  tone: "red" | "yellow" | "green" | "blue";
}

interface RuleImageGroup {
  id: RuleImageGroupId;
  title: string;
  images: string[];
  requiresChallengeMode?: boolean;
}

interface RuleCardIntro {
  id: string;
  index: number;
  title: string;
  cardImage: string;
  ruleImages: string[];
}

interface RuleGuideSection {
  kicker: string;
  title: string;
  items: string[];
  open?: boolean;
}

const LAST_ROOM_STORAGE_KEY = "thunder-uno.lastRoomId";
const USER_ID_STORAGE_KEY = "thunder-uno.userId";
const USER_NICKNAME_STORAGE_KEY = "thunder-uno.nickname";
const CHALLENGE_PROMPT_MS = 5_000;
const FALLBACK_AVATAR_COUNT = 8;
const LOBBY_MAX_PLAYER_SLOTS = 8;
const RULE_GUIDE_SECTIONS: RuleGuideSection[] = [
  {
    kicker: "开局",
    title: "房间与基础流程",
    open: true,
    items: [
      "3 到 8 人进入同一房间后，非房主需要先准备，房主才能开始。",
      "每位玩家开局 7 张手牌，第一张桌面牌不会是黑色牌。",
      "当前颜色、当前方向和当前玩家都由服务端快照决定。"
    ]
  },
  {
    kicker: "接牌",
    title: "单牌接牌",
    items: [
      "数字牌可按同色或同数字接牌。",
      "带颜色技能牌可按同色或同技能类型接牌。",
      "黑色牌需要选择后续颜色，下一家按指定颜色继续。"
    ]
  },
  {
    kicker: "加牌",
    title: "加牌链",
    items: [
      "只有普通 +2、普通 +4、反转变色 +4、变色 +6、变色 +10 能响应加牌链。",
      "普通 +2 只能接普通 +2，普通 +4 只能接普通 +4。",
      "黑色加牌可以升级叠加；+6 后不能再接普通 +2、普通 +4 或黑色反转 +4。",
      "选择结算加牌链后，目标玩家摸累计张数并结束本轮。"
    ]
  },
  {
    kicker: "组合",
    title: "顺子、连对与同色丢弃",
    items: [
      "顺子至少 5 张数字牌，数字必须连续，下一家接顺子中最大的牌。",
      "连对由同色同数字的多张数字牌组成。",
      "同色丢弃必须先选主牌，附带牌只丢弃不触发技能。"
    ]
  },
  {
    kicker: "UNO",
    title: "UNO 与抓 UNO",
    items: [
      "手牌变成 1 张时会进入待喊 UNO 状态。",
      "即使回合已经推进，只要仍处于待喊状态，也可以立即点击 UNO。",
      "未喊 UNO 且保护期结束后，其他玩家可以抓 UNO，目标罚摸 6 张。"
    ]
  },
  {
    kicker: "结算",
    title: "淘汰、胜利与续局",
    items: [
      "手牌超过 25 张会被淘汰，淘汰玩家不再参与回合。",
      "玩家打出最后一张牌会成为本局胜利玩家。",
      "出现淘汰或胜利后，房主可以选择继续游戏或重开一把。"
    ]
  }
];

const RULE_ENTRY_BUTTONS: RuleEntryButton[] = [
  { id: "basic", label: "基础玩法", tone: "red" },
  { id: "special", label: "特色玩法", tone: "yellow" },
  { id: "challenge", label: "质疑规则", tone: "green" },
  { id: "cards", label: "卡牌介绍", tone: "blue" }
];
const RULE_IMAGE_GROUPS: RuleImageGroup[] = [
  {
    id: "basic",
    title: "基础玩法",
    images: ["/rules/基础规则1.png", "/rules/基础规则2.png"]
  },
  {
    id: "special",
    title: "特色玩法",
    images: ["/rules/特色玩法（顺子）.png"]
  },
  {
    id: "challenge",
    title: "质疑规则",
    images: ["/rules/质疑玩法.png"],
    requiresChallengeMode: true
  }
];
const RULE_CARD_INTROS: RuleCardIntro[] = [
  {
    id: "number",
    index: 1,
    title: "普通牌",
    cardImage: "/cards/21_blue_1.png",
    ruleImages: ["/rules/卡牌规则1.png"]
  },
  {
    id: "draw-two",
    index: 2,
    title: "普通 +2",
    cardImage: "/cards/52_blue_plus2.png",
    ruleImages: ["/rules/卡牌规则23.png"]
  },
  {
    id: "draw-four",
    index: 3,
    title: "普通 +4",
    cardImage: "/cards/53_blue_plus4.png",
    ruleImages: ["/rules/卡牌规则23.png"]
  },
  {
    id: "skip",
    index: 4,
    title: "禁",
    cardImage: "/cards/54_blue_skip.png",
    ruleImages: ["/rules/卡牌规则4.png"]
  },
  {
    id: "reverse",
    index: 5,
    title: "反转",
    cardImage: "/cards/57_blue_reverse.png",
    ruleImages: ["/rules/卡牌规则5.png"]
  },
  {
    id: "discard-same-color",
    index: 6,
    title: "同色丢弃",
    cardImage: "/cards/56_blue_discard.png",
    ruleImages: ["/rules/卡牌规则6.png"]
  },
  {
    id: "swap-hands",
    index: 7,
    title: "交换手牌",
    cardImage: "/cards/55_blue_swap.png",
    ruleImages: ["/rules/卡牌规则7.png"]
  },
  {
    id: "wild",
    index: 8,
    title: "变色",
    cardImage: "/cards/68_black_wild.png",
    ruleImages: ["/rules/卡牌规则8.png"]
  },
  {
    id: "penalty-draw",
    index: 9,
    title: "罚抽",
    cardImage: "/cards/64_black_faces.png",
    ruleImages: ["/rules/卡牌规则9.png"]
  },
  {
    id: "wild-reverse-draw-four",
    index: 10,
    title: "反转变色 +4",
    cardImage: "/cards/66_black_plus4_swap.png",
    ruleImages: ["/rules/卡牌规则10.png"]
  },
  {
    id: "wild-draw-six",
    index: 11,
    title: "变色 +6",
    cardImage: "/cards/65_black_plus6.png",
    ruleImages: ["/rules/卡牌规则11.png"]
  },
  {
    id: "wild-draw-ten",
    index: 12,
    title: "变色 +10",
    cardImage: "/cards/67_black_plus10.png",
    ruleImages: ["/rules/卡牌规则12.png"]
  }
];

const root = document.querySelector<HTMLDivElement>("#app");
let unoProtectionRenderTimer: number | null = null;

if (root === null) {
  throw new Error("App root was not found.");
}

const appRoot = root;

const config = readInitialConfig(window.location.search);
const shouldReuseStoredSession = shouldReuseStoredSessionIdentity();

if (!shouldReuseStoredSession) {
  resetClonedSessionIdentity();
}

const state: AppState = {
  wsUrl: config.wsUrl,
  userId: getOrCreateUserId(),
  nickname: getOrCreateNickname(),
  connectionStatus: "idle",
  roomId: readStoredRoomId(),
  playerId: null,
  room: null,
  snapshot: null,
  lastError: null,
  log: [],
  selectedCardIds: [],
  handCardMotion: {},
  recentDrawnCardIds: [],
  colorPickerCardId: null,
  latestCardsPlayedEvent: null,
  latestPlayGroupEvent: null,
  latestPlayGroupAnimationKey: null,
  flyingCard: null,
  drawFlyingCard: null,
  drawStackBurst: null,
  challengePrompt: null,
  eventModal: null,
  ruleModal: null,
  uiToast: null,
  dismissedFinishedNoticeKey: null,
  snapshotRecoveryRoomId: null,
  roomCodeDigits: ["", "", "", "", "", ""]
};

const wsClient = new WsClient({
  onStatusChange(status) {
    state.connectionStatus = status;
    if (status === "open") {
      state.lastError = null;
      pushLog("连接已建立");
      render();
      maybeReconnect();
      return;
    }

    if (status === "closed") {
      state.lastError =
        state.roomId === null ? "连接已断开" : "连接已断开，可点击重连回到当前房间";
      pushLog("连接已关闭");
      render();
      return;
    }

    pushLog(`连接状态：${status}`);
    render();
  },
  onMessage(message) {
    handleServerMessage(message);
    render();
  },
  onError(error) {
    state.lastError = error instanceof Error ? error.message : "WebSocket error";
    pushLog(state.lastError);
    render();
  }
});

render();
connectUsingCurrentInputs();
window.addEventListener("resize", () => {
  window.requestAnimationFrame(syncHandOverlapLayout);
});

function handleServerMessage(message: ServerMessage): void {
  switch (message.type) {
    case "room-state":
      state.roomId = message.roomId;
      state.playerId = message.playerId;
      state.room = message.room;
      state.lastError = null;
      setRoomCodeFromText(message.roomId);
      clearSelectedCards();
      setSessionStoredValue(LAST_ROOM_STORAGE_KEY, message.roomId);

      pushLog(`收到房间快照：${message.room.players.length} 人`);
      recoverMissingPlayingSnapshot(message.room);
      return;
    case "snapshot":
      const previousSnapshot = state.snapshot;
      const snapshot = normalizePlayerGameSnapshot(message.snapshot);
      if (snapshot.status !== "finished") {
        state.dismissedFinishedNoticeKey = null;
      }
      syncRecentDrawnCards(previousSnapshot, snapshot);
      syncFlyingCardAnimation(snapshot);
      state.roomId = message.roomId;
      state.playerId = message.playerId;
      state.snapshot = snapshot;
      state.snapshotRecoveryRoomId = null;
      state.lastError = null;
      setRoomCodeFromText(message.roomId);
      clearSelectedCards();
      setSessionStoredValue(LAST_ROOM_STORAGE_KEY, message.roomId);
      syncChallengePrompt(state.snapshot);
      scheduleUnoProtectionRender(state.snapshot);
      pushLog(`收到对局快照：版本 ${message.snapshotVersion}`);
      return;
    case "events":
      handleGameEvents(message.events);
      pushLog(`收到事件：${String(message.events.length)} 条`);
      return;
    case "error":
      state.lastError = message.message;
      pushLog(`错误：${message.message}`);
      if (
        message.code === "room-not-found" ||
        message.code === "player-not-in-room" ||
        message.code === "room-not-playing"
      ) {
        resetRoomContext();
      }
      return;
    case "pong":
      pushLog("pong");
      return;
    case "room-closed":
      resetRoomContext();
      pushLog("房间已关闭");
      return;
    default: {
      const exhaustiveCheck: never = message;
      pushLog(`未知消息：${String(exhaustiveCheck)}`);
    }
  }
}

function render(): void {
  const snapshot = state.snapshot;
  const isBattleView = snapshot !== null;
  document.body.classList.toggle("battle-active", isBattleView);

  appRoot.innerHTML = `
    <main class="shell ${isBattleView ? "shell-battle" : ""}">
      ${
        isBattleView
          ? renderBattlePanel(snapshot)
          : `
            <section class="topbar">
              <div>
                <p class="eyebrow">HTML Web Client</p>
                <h1>雷霆UNOplus</h1>
              </div>
              <span
                class="status status-${state.connectionStatus}"
                data-testid="connection-status"
              >${state.connectionStatus}</span>
            </section>

            ${renderConnectionPanel()}
            ${renderToastPanel()}
            ${renderLobbyPanel()}
            ${renderLogPanel()}
          `
      }
      ${renderRuleModal()}
    </main>
  `;

  bindConnectionPanel();
  bindLobbyPanel();
  bindBattlePanel();
  bindRuleControls();

  if (isBattleView) {
    window.requestAnimationFrame(syncHandOverlapLayout);
  }
}

function renderConnectionPanel(): string {
  const connectLabel = state.connectionStatus === "open" ? "已连接" : "重新连接";
  const connectButtonClass =
    state.connectionStatus === "open"
      ? "connection-action connection-action-open"
      : "connection-action connection-action-retry";

  return `
    <section class="panel connection-panel">
      <label>
        <span>服务端</span>
        <input
          id="ws-url"
          data-testid="ws-url-input"
          value="${escapeHtml(state.wsUrl)}"
          autocomplete="off"
        />
      </label>
      <label>
        <span>昵称</span>
        <input
          id="nickname"
          data-testid="nickname-input"
          value="${escapeHtml(state.nickname)}"
          autocomplete="off"
        />
      </label>
      <div class="button-row">
        <button id="connect-button" data-testid="connect-button" class="${connectButtonClass}">${connectLabel}</button>
        <button id="disconnect-button" class="secondary">断开</button>
        <button id="ping-button" class="secondary">Ping</button>
      </div>
      <p id="error-line" data-testid="error-line" class="error-line" aria-live="polite">${state.lastError === null ? "" : escapeHtml(state.lastError)}</p>
    </section>
  `;
}

function renderToastPanel(): string {
  const toast = state.uiToast;

  if (toast === null) {
    return "";
  }

  return `
    <div class="ui-toast toast-${toast.tone}" role="status" aria-live="polite">
      ${escapeHtml(toast.message)}
    </div>
  `;
}

function renderLobbyPanel(): string {
  const room = state.room;
  const isConnected = state.connectionStatus === "open";
  const canCreateRoom = isConnected && state.roomId === null;
  const canJoinRoom = isConnected && state.roomId === null;
  const canCopyRoomId = state.roomId !== null || getRoomCodeValue().length === 6;
  const lobbySummary =
    room === null
      ? "等待连接"
      : `${String(room.players.length)}/${String(LOBBY_MAX_PLAYER_SLOTS)} 人`;

  return `
    <section class="layout lobby-layout" data-testid="lobby-view">
      <div class="panel lobby-control" data-testid="lobby-control-panel">
        <div class="lobby-panel-heading">
          <p class="eyebrow">Matchmaking</p>
          <h2>组局大厅</h2>
          <span>${escapeHtml(lobbySummary)}</span>
        </div>
        <div class="form-grid">
          <label>
            <span>模式</span>
            <select id="mode">
              <option value="no-challenge">无质疑</option>
              <option value="with-challenge">有质疑</option>
            </select>
          </label>
          <label>
            <span>房间号</span>
            ${renderRoomCodeInputs()}
          </label>
        </div>
        <div class="button-row lobby-actions">
          <button id="create-room-button" data-testid="create-room-button" ${canCreateRoom ? "" : `disabled title="${escapeHtml(getLobbyDisabledReason(isConnected))}"`}>生成房间号</button>
          <button id="copy-room-button" data-testid="copy-room-button" class="copy-room-button" ${canCopyRoomId ? "" : `disabled title="暂无可复制的房间号"`}>复制房间号</button>
          <button id="join-room-button" data-testid="join-room-button" class="secondary" ${canJoinRoom ? "" : `disabled title="${escapeHtml(getLobbyDisabledReason(isConnected))}"`}>加入房间</button>
          <button id="leave-room-button" data-testid="leave-room-button" class="secondary" ${isConnected && state.roomId !== null ? "" : `disabled title="${escapeHtml(isConnected ? "当前不在房间中。" : "未连接服务端。")}"`}>离开</button>
        </div>
        <div class="lobby-hints" aria-hidden="true">
          <span>3 人开局</span>
          <span>8 人上限</span>
          <span>服务端裁定</span>
        </div>
      </div>
      <div class="panel lobby-status" data-testid="lobby-status-panel">
        <div class="lobby-panel-heading">
          <p class="eyebrow">Room</p>
          <h2>等待席</h2>
          <span>${escapeHtml(state.connectionStatus)}</span>
        </div>
        ${
          room === null
            ? renderEmptyLobbyState()
            : renderRoomState(room)
        }
      </div>
      ${renderRulesGuidePanel()}
    </section>
  `;
}

function renderRulesGuidePanel(): string {
  return `
    <section class="panel rules-guide" data-testid="rules-guide">
      <div class="lobby-panel-heading">
        <p class="eyebrow">Rules</p>
        <h2>规则讲解</h2>
        <span>图片讲解</span>
      </div>
      ${renderRuleEntryButtons("lobby")}
    </section>
  `;
}

function renderRuleEntryButtons(context: "lobby" | "modal"): string {
  return `
    <div class="rule-entry-grid rule-entry-grid-${context}">
      ${RULE_ENTRY_BUTTONS.map((entry) => {
        const disabledReason = getRuleEntryDisabledReason(entry.id, context);
        const disabled = disabledReason === null ? "" : `disabled title="${escapeHtml(disabledReason)}"`;
        return `
          <button
            class="rule-entry-button rule-entry-${entry.tone}"
            data-rule-entry="${escapeHtml(entry.id)}"
            data-testid="rule-entry-${escapeHtml(entry.id)}"
            ${disabled}
          >
            ${escapeHtml(entry.label)}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function getRuleEntryDisabledReason(
  entryId: RuleEntryId,
  context: "lobby" | "modal"
): string | null {
  if (context === "lobby" || entryId !== "challenge") {
    return null;
  }

  const mode = getCurrentRuleMode();
  if (mode === "with-challenge") {
    return null;
  }

  return "仅质疑模式可查看";
}

function getCurrentRuleMode(): GameMode | null {
  return state.snapshot?.mode ?? state.room?.mode ?? null;
}

function getRuleImageGroup(groupId: RuleImageGroupId): RuleImageGroup | undefined {
  return RULE_IMAGE_GROUPS.find((group) => group.id === groupId);
}

function getRuleCardIntro(cardId: string): RuleCardIntro | undefined {
  return RULE_CARD_INTROS.find((card) => card.id === cardId);
}

function getAdjacentRuleCardId(cardId: string, direction: -1 | 1): string | null {
  const index = RULE_CARD_INTROS.findIndex((card) => card.id === cardId);
  if (index < 0) {
    return null;
  }

  return RULE_CARD_INTROS[index + direction]?.id ?? null;
}

function renderRuleModal(): string {
  const view = state.ruleModal;

  if (view === null) {
    return "";
  }

  return `
    <div class="rule-modal-backdrop" data-testid="rule-modal">
      <section class="rule-modal" role="dialog" aria-modal="true" aria-label="规则讲解">
        ${renderRuleModalContent(view)}
      </section>
    </div>
  `;
}

function renderRuleModalContent(view: RuleModalView): string {
  switch (view.type) {
    case "home":
      return `
        <div class="rule-modal-header">
          <div>
            <p class="eyebrow">Rules</p>
            <h2>规则讲解</h2>
          </div>
          <button id="close-rule-modal-button" class="secondary">关闭</button>
        </div>
        ${renderRuleEntryButtons("modal")}
      `;
    case "image-group": {
      const group = getRuleImageGroup(view.groupId);
      if (group === undefined) {
        return renderRuleModalMissingContent("规则图片未找到");
      }

      return renderRuleImageViewer({
        title: group.title,
        images: group.images,
        pageIndex: view.pageIndex,
        backTarget: "home"
      });
    }
    case "card-list":
      return `
        <div class="rule-modal-header">
          <div>
            <p class="eyebrow">Cards</p>
            <h2>卡牌介绍</h2>
          </div>
          <div class="rule-modal-header-actions">
            <button id="rule-back-button" class="secondary">返回</button>
            <button id="close-rule-modal-button" class="secondary">关闭</button>
          </div>
        </div>
        <div class="rule-card-grid" data-testid="rule-card-grid">
          ${RULE_CARD_INTROS.map((card) => `
            <button
              class="rule-card-button"
              data-rule-card="${escapeHtml(card.id)}"
              data-testid="rule-card-${escapeHtml(card.id)}"
              title="${escapeHtml(card.title)}"
            >
              <span class="rule-card-index">${String(card.index)}</span>
              <img src="${escapeHtml(card.cardImage)}" alt="${escapeHtml(card.title)}" />
              <span>${escapeHtml(card.title)}</span>
            </button>
          `).join("")}
        </div>
      `;
    case "card-rule": {
      const card = getRuleCardIntro(view.cardId);
      if (card === undefined) {
        return renderRuleModalMissingContent("卡牌规则未找到");
      }

      return renderRuleImageViewer({
        title: `${String(card.index)}. ${card.title}`,
        images: card.ruleImages,
        pageIndex: view.pageIndex,
        backTarget: "card-list",
        cardId: card.id
      });
    }
    default: {
      const exhaustiveCheck: never = view;
      return renderRuleModalMissingContent(String(exhaustiveCheck));
    }
  }
}

function renderRuleImageViewer(params: {
  title: string;
  images: string[];
  pageIndex: number;
  backTarget: "home" | "card-list";
  cardId?: string;
}): string {
  const maxIndex = Math.max(0, params.images.length - 1);
  const pageIndex = Math.min(Math.max(params.pageIndex, 0), maxIndex);
  const image = params.images[pageIndex] ?? "";
  const previousDisabled = pageIndex <= 0 ? "disabled" : "";
  const nextDisabled = pageIndex >= maxIndex ? "disabled" : "";
  const previousCardId =
    params.cardId === undefined ? null : getAdjacentRuleCardId(params.cardId, -1);
  const nextCardId =
    params.cardId === undefined ? null : getAdjacentRuleCardId(params.cardId, 1);
  const cardNavClass = params.cardId === undefined ? "" : " rule-image-viewer-card-nav";

  return `
    <div class="rule-modal-header">
      <div>
        <p class="eyebrow">Rules</p>
        <h2>${escapeHtml(params.title)}</h2>
      </div>
      <div class="rule-modal-header-actions">
        <button id="rule-back-button" class="secondary" data-rule-back="${params.backTarget}">返回</button>
        <button id="close-rule-modal-button" class="secondary">关闭</button>
      </div>
    </div>
    <div class="rule-image-viewer${cardNavClass}">
      ${
        params.cardId === undefined
          ? ""
          : `<button id="rule-prev-card-button" class="secondary rule-card-nav-button" title="上一种卡牌" aria-label="上一种卡牌" ${previousCardId === null ? "disabled" : ""}>‹</button>`
      }
      <img src="${escapeHtml(image)}" alt="${escapeHtml(params.title)} 第 ${String(pageIndex + 1)} 页" />
      ${
        params.cardId === undefined
          ? ""
          : `<button id="rule-next-card-button" class="secondary rule-card-nav-button" title="下一种卡牌" aria-label="下一种卡牌" ${nextCardId === null ? "disabled" : ""}>›</button>`
      }
    </div>
    ${
      params.images.length > 1
        ? `<div class="rule-page-controls">
            <button id="rule-prev-button" class="secondary rule-page-button" title="上一页" aria-label="上一页" ${previousDisabled}>‹</button>
            <span class="rule-page-indicator">${String(pageIndex + 1)} / ${String(params.images.length)}</span>
            <button id="rule-next-button" class="secondary rule-page-button" title="下一页" aria-label="下一页" ${nextDisabled}>›</button>
          </div>`
        : ""
    }
  `;
}

function renderRuleModalMissingContent(message: string): string {
  return `
    <div class="rule-modal-header">
      <div>
        <p class="eyebrow">Rules</p>
        <h2>规则讲解</h2>
      </div>
      <button id="close-rule-modal-button" class="secondary">关闭</button>
    </div>
    <p class="muted">${escapeHtml(message)}</p>
  `;
}

function renderRoomCodeInputs(): string {
  return `
    <div class="room-code-inputs" data-testid="join-room-input" aria-label="6 位房间号">
      ${state.roomCodeDigits
        .map((digit, index) => {
          return `
            <input
              class="room-code-digit"
              data-testid="room-code-digit-${String(index)}"
              data-room-code-index="${String(index)}"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="1"
              value="${escapeHtml(digit)}"
              autocomplete="off"
              aria-label="房间号第 ${String(index + 1)} 位"
            />
          `;
        })
        .join("")}
    </div>
    <input id="room-id-input" type="hidden" value="${escapeHtml(getRoomCodeValue())}" />
  `;
}

function getLobbyDisabledReason(isConnected: boolean): string {
  if (!isConnected) {
    return "未连接服务端。";
  }

  if (state.roomId !== null) {
    return "已在房间中。";
  }

  return "当前不可操作。";
}

function getRoomCodeValue(): string {
  return state.roomCodeDigits.join("");
}

function setRoomCodeFromText(text: string): void {
  const digits = text.replace(/\D/g, "").slice(0, 6).split("");
  state.roomCodeDigits = Array.from({ length: 6 }, (_, index) => digits[index] ?? "");
}

function showRoomCodeInputError(message: string): void {
  state.lastError = message;
  showToast(message, "warning");
}

function renderEmptyLobbyState(): string {
  return `
    <div class="empty-lobby">
      <strong>未进入房间</strong>
      <p class="muted">连接服务端后创建或加入房间。</p>
      <div class="empty-seat-grid" aria-hidden="true">
        ${Array.from({ length: 6 }, (_, index) => `<span>${String(index + 1)}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderRoomState(room: PlayerRoomSnapshot): string {
  const readyStatus = getLobbyReadyStatus(room);
  const isHost = room.hostPlayerId === state.playerId;
  const selfPlayer = room.players.find((player) => player.playerId === state.playerId);
  const canStart =
    state.connectionStatus === "open" &&
    isHost &&
    readyStatus.canStart;
  const canToggleReady =
    state.connectionStatus === "open" &&
    !isHost &&
    state.playerId !== null &&
    selfPlayer !== undefined;
  const hostPlayer = room.players.find((player) => player.isHost);
  const openSlotCount = Math.max(LOBBY_MAX_PLAYER_SLOTS - room.players.length, 0);
  const canAddBot =
    state.connectionStatus === "open" &&
    isHost &&
    room.status === "lobby" &&
    room.mode === "no-challenge" &&
    room.players.length < LOBBY_MAX_PLAYER_SLOTS;

  return `
    <div class="room-meta">
      <div>
        <span class="room-code-label">房间号</span>
        <strong data-testid="room-id">${escapeHtml(room.roomCode)}</strong>
      </div>
      <div class="room-chip-row">
        <span>${escapeHtml(getModeLabel(room.mode))}</span>
        <span>${escapeHtml(getRoomStatusLabel(room.status))}</span>
        <span>${escapeHtml(readyStatus.label)}</span>
      </div>
      <p>房主：${escapeHtml(hostPlayer?.displayName ?? hostPlayer?.playerId ?? "未知")}</p>
    </div>
    <div class="players">
      ${room.players
        .map((player) => {
          return `
            <div
              class="player-pill ${player.playerId === state.playerId ? "self" : ""}"
              data-testid="room-player"
              data-room-host="${player.isHost ? "true" : "false"}"
            >
              <img
                class="avatar"
                src="${escapeHtml(resolvePlayerAvatar(player.playerId, player.avatarUrl))}"
                alt="${escapeHtml(player.displayName ?? player.playerId)}"
              />
              <span>${escapeHtml(player.displayName ?? player.playerId)}</span>
              ${player.isBot === true ? `<span class="bot-tag">BOT</span>` : ""}
              <small>${escapeHtml(getRoomPlayerReadyLabel(player))}</small>
              ${
                isHost && !player.isHost && room.status === "lobby"
                  ? `<button
                      class="mini-kick-button"
                      data-kick-player="${escapeHtml(player.playerId)}"
                      data-testid="kick-player-button"
                      title="踢出 ${escapeHtml(player.displayName ?? player.playerId)}"
                    >踢出</button>`
                  : ""
              }
            </div>
          `;
        })
        .join("")}
      ${Array.from({ length: openSlotCount }, (_, index) => {
        const seatNumber = room.players.length + index + 1;

        return `
          <div class="player-pill player-pill-empty" aria-hidden="true">
            <span class="avatar avatar-empty">${String(seatNumber)}</span>
            <span>空位</span>
            <small>座位 ${String(seatNumber)}</small>
          </div>
        `;
      }).join("")}
    </div>
    <label class="seed-line">
      <span>可选种子</span>
      <input id="seed-input" autocomplete="off" />
    </label>
    ${
      isHost
        ? `<div class="host-room-actions">
            <button id="add-bot-button" data-testid="add-bot-button" class="secondary" ${canAddBot ? "" : `disabled title="${escapeHtml(getAddBotDisabledReason(room))}"`}>添加机器人</button>
            <button id="start-game-button" data-testid="start-game-button" ${canStart ? "" : `disabled title="${escapeHtml(getStartGameDisabledReason(room))}"`}>开始游戏</button>
          </div>`
        : `<button id="ready-button" data-testid="ready-button" ${canToggleReady ? "" : `disabled title="${escapeHtml(getReadyDisabledReason(room))}"`}>${escapeHtml(selfPlayer?.isReady === true ? "取消准备" : "准备")}</button>`
    }
  `;
}

function getRoomPlayerReadyLabel(player: PlayerRoomSnapshot["players"][number]): string {
  if (player.isBot === true) {
    return "机器人 · 已准备";
  }

  if (player.isHost) {
    return "房主";
  }

  return player.isReady ? "已准备" : "未准备";
}

function getLobbyReadyStatus(room: PlayerRoomSnapshot): {
  canStart: boolean;
  label: string;
  unreadyPlayers: PlayerRoomSnapshot["players"];
} {
  const nonHostPlayers = room.players.filter((player) => !player.isHost);
  const unreadyPlayers = nonHostPlayers.filter((player) => !player.isReady);

  if (room.players.length < 3) {
    return {
      canStart: false,
      label: "等待玩家",
      unreadyPlayers
    };
  }

  if (unreadyPlayers.length === 0) {
    return {
      canStart: true,
      label: "所有玩家已准备",
      unreadyPlayers
    };
  }

  return {
    canStart: false,
    label: `${unreadyPlayers
      .map((player) => player.displayName ?? player.playerId)
      .join("、")}未准备`,
    unreadyPlayers
  };
}

function getModeLabel(mode: GameMode): string {
  return mode === "with-challenge" ? "有质疑" : "无质疑";
}

function getRoomStatusLabel(status: PlayerRoomSnapshot["status"]): string {
  if (status === "lobby") {
    return "等待中";
  }

  if (status === "playing") {
    return "对局中";
  }

  return "已结束";
}

function getStartGameDisabledReason(room: PlayerRoomSnapshot): string {
  if (state.connectionStatus !== "open") {
    return "未连接服务端。";
  }

  if (room.hostPlayerId !== state.playerId) {
    return "只有房主可以开始游戏。";
  }

  if (room.players.length < 3) {
    return "至少 3 人才能开始。";
  }

  const readyStatus = getLobbyReadyStatus(room);

  if (readyStatus.unreadyPlayers.length > 0) {
    return `${readyStatus.unreadyPlayers
      .map((player) => player.displayName ?? player.playerId)
      .join("、")}未准备。`;
  }

  return "当前不能开始。";
}

function getAddBotDisabledReason(room: PlayerRoomSnapshot): string {
  if (state.connectionStatus !== "open") {
    return "未连接服务端。";
  }

  if (room.hostPlayerId !== state.playerId) {
    return "只有房主可以添加机器人。";
  }

  if (room.status !== "lobby") {
    return "只有等待房间可以添加机器人。";
  }

  if (room.mode !== "no-challenge") {
    return "暂时只有无质疑模式可以添加机器人。";
  }

  if (room.players.length >= LOBBY_MAX_PLAYER_SLOTS) {
    return "房间已满。";
  }

  return "当前不能添加机器人。";
}

function getReadyDisabledReason(room: PlayerRoomSnapshot): string {
  if (state.connectionStatus !== "open") {
    return "未连接服务端。";
  }

  if (room.hostPlayerId === state.playerId) {
    return "房主无需准备。";
  }

  return "当前不能准备。";
}

function renderBattlePanel(snapshot: PlayerGameSnapshot): string {
  const isMyTurn = snapshot.currentPlayerId === state.playerId;
  const isGameFinished = snapshot.status === "finished";
  const isConnected = state.connectionStatus === "open";
  const canTakeTurnAction =
    isConnected &&
    isMyTurn &&
    !isGameFinished &&
    !snapshot.self.isEliminated &&
    !snapshot.self.isRoundWinner;
  const canUseOpponentAction = isConnected && !isGameFinished;
  const canSayUno =
    isConnected &&
    !isGameFinished &&
    snapshot.self.handCount === 1 &&
    !snapshot.self.hasCalledUno &&
    snapshot.self.unoPendingSinceMs !== null &&
    !snapshot.self.isEliminated &&
    !snapshot.self.isRoundWinner;
  const hand = snapshot.self.hand;
  const selectedCards = getSelectedCards(hand, state.selectedCardIds);
  const sequenceCandidateCardIds = getSequenceCandidateCardIds(hand, {
    currentColor: snapshot.currentColor,
    topCard: snapshot.topCard
  });
  const challengePrompt = getVisibleChallengePrompt(snapshot, isConnected, isGameFinished);

  return `
    <section class="battle battle-immersive ${isMyTurn ? "my-turn" : "other-turn"}" data-testid="battle-view">
      <div class="table-zone battle-stage">
        ${renderBattleHud(snapshot, isMyTurn)}
        <p
          id="battle-error-line"
          data-testid="error-line"
          class="battle-error-line"
          aria-live="polite"
        >${state.lastError === null ? "" : escapeHtml(state.lastError)}</p>
        ${renderToastPanel()}
        ${renderNormalDrawOfferPrompt(snapshot, canTakeTurnAction)}
        ${renderEventModal(snapshot)}
        <div class="battle-table">
          <div class="opponents" data-testid="opponents-area">
            ${snapshot.opponents
              .map((player, index) =>
                renderOpponent(
                  snapshot,
                  player,
                  canUseOpponentAction,
                  getOpponentSeatClass(index, snapshot.opponents.length)
                )
              )
              .join("")}
          </div>
          ${renderFlyingCard(snapshot)}
          ${renderDrawFlyingCard()}
          ${renderDrawStackBurst()}
          <div class="center-table">
            <div class="draw-pile">
              <img src="${getCardBackAssetPath()}" alt="牌堆" />
              ${renderDrawButton(snapshot, canTakeTurnAction)}
            </div>
            ${renderDiscardPile(snapshot)}
            <div class="table-facts">
              <span class="table-fact table-fact-primary">${isMyTurn ? "轮到你行动" : `当前：${escapeHtml(lookupPlayerName(snapshot, snapshot.currentPlayerId))}`}</span>
              <span class="table-fact">颜色 ${renderCurrentColorBadge(snapshot.currentColor)}</span>
              <span class="table-fact">方向 ${renderDirectionIndicator(snapshot.direction)}</span>
              ${renderDrawAmountFact(snapshot)}
            </div>
          </div>
          ${challengePrompt === null ? "" : renderChallengePrompt(snapshot, challengePrompt)}
          ${renderSelfSeat(snapshot)}
        </div>
        <div class="battle-action-dock">
          <div class="actions ${canTakeTurnAction ? "is-active" : ""}">
            <button
              id="say-uno-button"
              data-testid="say-uno-button"
              class="secondary"
              ${canSayUno ? `title="喊 UNO"` : `disabled title="${escapeHtml(getSayUnoDisabledReason(snapshot, isConnected, isGameFinished))}"`}
            >UNO</button>
            ${renderSelectionPanel(snapshot, canTakeTurnAction, isGameFinished, isMyTurn, isConnected)}
          </div>
          <div class="hand">
            <div class="hand-header">
              <h2>${escapeHtml(snapshot.self.displayName ?? "我")} 的手牌</h2>
              <span>${String(snapshot.self.hand.length)} 张</span>
            </div>
            ${renderActionGuide(snapshot, canTakeTurnAction, isGameFinished, isConnected)}
            <div class="cards" data-testid="hand-area">
              ${hand
                .map((card, index) =>
                  renderCardButtonV2(
                    card,
                    index,
                    snapshot,
                    canTakeTurnAction,
                    selectedCards,
                    sequenceCandidateCardIds
                  )
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    </section>
    ${renderColorPickerPanel(snapshot.self.hand, canTakeTurnAction)}
  `;
}

function renderNormalDrawOfferPrompt(
  snapshot: PlayerGameSnapshot,
  enabled: boolean
): string {
  if (
    !enabled ||
    !snapshot.normalDrawOffer.active ||
    snapshot.normalDrawOffer.playerId !== state.playerId ||
    snapshot.normalDrawOffer.cardId === null
  ) {
    return "";
  }

  const drawnCard = snapshot.self.hand.find(
    (card) => card.id === snapshot.normalDrawOffer.cardId
  );

  return `
    <div class="normal-draw-offer-backdrop">
      <div class="panel normal-draw-offer normal-draw-offer-modal" data-testid="normal-draw-offer">
        <strong>刚摸到的牌</strong>
        <p>${escapeHtml(drawnCard?.displayName ?? "牌数据同步中")}</p>
        <div class="challenge-actions">
          <button id="play-drawn-card-button" ${drawnCard === undefined ? `disabled title="牌数据同步中。"` : ""}>立即打出</button>
          <button id="keep-drawn-card-button" class="secondary">保留</button>
        </div>
      </div>
    </div>
  `;
}

function renderEventModal(snapshot: PlayerGameSnapshot): string {
  const finishedNotice = buildFinishedNotice(snapshot);
  const visibleFinishedNotice =
    finishedNotice !== null && finishedNotice.key !== state.dismissedFinishedNoticeKey
      ? finishedNotice
      : null;
  const notice = visibleFinishedNotice ?? state.eventModal;

  if (notice === null) {
    return "";
  }

  return `
    <div class="event-modal-backdrop" data-testid="event-modal">
      <section class="event-modal ${escapeHtml(notice.tone)}">
        <h2>${escapeHtml(notice.title)}</h2>
        <p>${escapeHtml(notice.message)}</p>
        ${
          visibleFinishedNotice !== null
            ? renderRoundDecisionControls(snapshot)
            : hasRoundDecisionReason(snapshot)
              ? renderRoundDecisionControls(snapshot)
            : notice.dismissible
              ? `<button id="close-event-modal-button" class="secondary">知道了</button>`
              : ""
        }
      </section>
    </div>
  `;
}

function renderRoundDecisionControls(snapshot: PlayerGameSnapshot): string {
  if (!canCurrentPlayerMakeRoundDecision(snapshot)) {
    if (snapshot.status === "finished") {
      return `
        <div class="challenge-actions">
          <button id="stay-in-room-button" data-testid="stay-in-room-button">留在房间</button>
          <button id="finish-leave-room-button" data-testid="finish-leave-room-button" class="secondary">离开房间</button>
        </div>
      `;
    }

    return `<p class="muted">等待房主选择继续游戏或重开一把。</p>`;
  }

  return `
    <div class="challenge-actions">
      <button id="restart-game-button" data-testid="restart-game-button">重开一把</button>
      <button id="continue-game-button" data-testid="continue-game-button" class="secondary">继续游戏</button>
    </div>
  `;
}

function hasRoundDecisionReason(snapshot: PlayerGameSnapshot): boolean {
  return (
    snapshot.status === "finished" ||
    snapshot.self.isEliminated ||
    snapshot.self.isRoundWinner ||
    snapshot.opponents.some((player) => player.isEliminated || player.isRoundWinner)
  );
}

function canCurrentPlayerMakeRoundDecision(snapshot: PlayerGameSnapshot): boolean {
  return (
    state.room?.hostPlayerId === state.playerId &&
    state.playerId !== null &&
    hasRoundDecisionReason(snapshot)
  );
}

function buildFinishedNotice(snapshot: PlayerGameSnapshot): EventModalState | null {
  if (snapshot.status !== "finished") {
    return null;
  }

  const winners = snapshot.winnerPlayerIds
    .map((playerId) => lookupPlayerName(snapshot, playerId))
    .join(" · ") || "未知";

  return {
    key: `game-finished-${snapshot.winnerPlayerIds.join("-")}`,
    title: "对局结束",
    message: `玩家 ${winners} 获胜！`,
    tone: "success",
    dismissible: false
  };
}

function renderOpponent(
  snapshot: PlayerGameSnapshot,
  player: PlayerGameSnapshot["opponents"][number],
  enabled: boolean,
  seatClass: string
): string {
  const status = getPlayerSeatStatus(snapshot, player, false);
  const canReportUno = enabled && canReportUnoTarget(player);
  const reportUnoTitle = canReportUno
    ? getReportUnoEnabledTitle(player)
    : getReportUnoDisabledReason(player, enabled);

  return `
    <div class="opponent seat ${seatClass} ${player.isCurrentPlayer ? "current" : ""} ${getSeatOutcomeClass(player)}">
      <span class="seat-badge ${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>
      <img
        class="avatar"
        src="${escapeHtml(resolvePlayerAvatar(player.playerId, player.avatarUrl))}"
        alt="${escapeHtml(player.displayName ?? player.playerId)}"
      />
      <strong>${escapeHtml(player.displayName ?? player.playerId)}</strong>
      ${player.isBot === true ? `<span class="seat-bot-tag">BOT</span>` : ""}
      <span class="hand-count-badge">${String(player.handCount)}</span>
      <small>${escapeHtml(status.detail)}</small>
      <div class="opponent-actions">
        <button
          data-report-uno="${escapeHtml(player.playerId)}"
          title="${escapeHtml(reportUnoTitle)}"
          ${canReportUno ? "" : "disabled"}
        >${escapeHtml(getReportUnoLabel(player))}</button>
      </div>
    </div>
  `;
}

function renderSelfSeat(snapshot: PlayerGameSnapshot): string {
  const status = getPlayerSeatStatus(snapshot, snapshot.self, true);

  return `
    <div class="self-seat seat ${snapshot.self.isCurrentPlayer ? "current" : ""} ${getSeatOutcomeClass(snapshot.self)}">
      <span class="seat-badge ${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>
      <img
        class="avatar"
        src="${escapeHtml(resolvePlayerAvatar(snapshot.self.playerId, snapshot.self.avatarUrl))}"
        alt="${escapeHtml(snapshot.self.displayName ?? "我")}"
      />
      <strong>${escapeHtml(snapshot.self.displayName ?? "我")}</strong>
      ${snapshot.self.isBot === true ? `<span class="seat-bot-tag">BOT</span>` : ""}
      <span class="hand-count-badge">${String(snapshot.self.hand.length)}</span>
      <small>${escapeHtml(status.detail)}</small>
    </div>
  `;
}

type SnapshotSeatPlayer =
  | PlayerGameSnapshot["self"]
  | PlayerGameSnapshot["opponents"][number];

function getPlayerSeatStatus(
  snapshot: PlayerGameSnapshot,
  player: SnapshotSeatPlayer,
  isSelf: boolean
): { label: string; detail: string; tone: string } {
  if (player.isRoundWinner || snapshot.winnerPlayerIds.includes(player.playerId)) {
    return { label: "赢家", detail: "本局获胜", tone: "success" };
  }

  if (player.hasLeftRoom) {
    return { label: "已退出", detail: "已退出房间", tone: "neutral" };
  }

  if (player.isEliminated) {
    return { label: "出局", detail: "已出局", tone: "danger" };
  }

  if (snapshot.drawStack.active && snapshot.drawStack.targetPlayerId === player.playerId) {
    return {
      label: `+${String(snapshot.drawStack.amount)}`,
      detail: "加牌目标",
      tone: "danger"
    };
  }

  if (snapshot.drawUntilColor.active && snapshot.drawUntilColor.targetPlayerId === player.playerId) {
    return {
      label: "罚摸",
      detail:
        snapshot.drawUntilColor.color === null
          ? "罚抽目标"
          : `罚抽到${getColorDisplayName(snapshot.drawUntilColor.color)}`,
      tone: "danger"
    };
  }

  if (player.hasCalledUno) {
    return { label: "UNO", detail: "已喊 UNO", tone: "success" };
  }

  if (player.handCount === 1 && player.unoPendingSinceMs !== null) {
    if (player.unoProtectionEndsAtMs === null) {
      return {
        label: "待喊 UNO",
        detail: "UNO 保护未开始",
        tone: "warning"
      };
    }

    const remainingMs = getUnoProtectionRemainingMs(player);

    if (remainingMs > 0) {
      return {
        label: "保护中",
        detail: `UNO 保护 ${String(Math.ceil(remainingMs / 1000))}s`,
        tone: "warning"
      };
    }

    return {
      label: isSelf ? "待喊 UNO" : "可抓 UNO",
      detail: isSelf ? "请喊 UNO" : "可抓 UNO",
      tone: "warning"
    };
  }

  if (player.isCurrentPlayer) {
    if (player.isBot === true) {
      return { label: "机器人", detail: "思考中...", tone: "active" };
    }

    return { label: isSelf ? "轮到你" : "当前回合", detail: "当前行动", tone: "active" };
  }

  return { label: "等待", detail: "等待", tone: "neutral" };
}

function getUnoProtectionRemainingMs(player: SnapshotSeatPlayer): number {
  if (player.unoProtectionEndsAtMs === null) {
    return 0;
  }

  return Math.max(0, player.unoProtectionEndsAtMs - Date.now());
}

function canReportUnoTarget(player: PlayerGameSnapshot["opponents"][number]): boolean {
  return (
    !player.isEliminated &&
    !player.isRoundWinner &&
    !player.hasLeftRoom &&
    player.handCount === 1 &&
    !player.hasCalledUno &&
    player.unoPendingSinceMs !== null
  );
}

function getSeatOutcomeClass(player: SnapshotSeatPlayer): string {
  if (player.isRoundWinner) {
    return "round-winner";
  }

  if (player.isEliminated) {
    return "round-eliminated";
  }

  return "";
}

function getReportUnoLabel(player: PlayerGameSnapshot["opponents"][number]): string {
  if (!canReportUnoTarget(player)) {
    return "报 UNO";
  }

  const remainingMs = getUnoProtectionRemainingMs(player);

  return player.unoProtectionEndsAtMs !== null && remainingMs > 0
    ? `保护 ${String(Math.ceil(remainingMs / 1000))}s`
    : "抓 UNO";
}

function getReportUnoEnabledTitle(player: PlayerGameSnapshot["opponents"][number]): string {
  const remainingMs = getUnoProtectionRemainingMs(player);

  if (player.unoProtectionEndsAtMs !== null && remainingMs > 0) {
    return "仍在 UNO 保护期，点击会得到保护提示。";
  }

  return "抓对方未喊 UNO。";
}

function getReportUnoDisabledReason(
  player: PlayerGameSnapshot["opponents"][number],
  enabled: boolean
): string {
  if (!enabled) {
    return state.connectionStatus === "open" ? "对局已结束。" : "未连接服务端。";
  }

  if (player.isEliminated) {
    return "该玩家已出局。";
  }

  if (player.hasLeftRoom) {
    return "该玩家已退出房间。";
  }

  if (player.handCount !== 1) {
    return "对方不是 1 张手牌。";
  }

  if (player.hasCalledUno) {
    return "对方已经喊过 UNO。";
  }

  return "当前不能抓 UNO。";
}

function renderDiscardPile(snapshot: PlayerGameSnapshot): string {
  const discardPile = Array.isArray((snapshot as { discardPile?: Card[] }).discardPile)
    ? (snapshot as { discardPile: Card[] }).discardPile
    : [];
  const pileCards = discardPile.length === 0 ? [snapshot.topCard] : discardPile;
  const latestGroup = getLatestPlayedGroup(pileCards);
  const activeChain = getActiveDrawChainCards(snapshot, pileCards, latestGroup);
  const hiddenLatestIds = new Set<string>([
    ...latestGroup.cards.map((card) => card.id),
    ...activeChain.map((card) => card.id)
  ]);
  const historyCards = pileCards
    .filter((card) => !hiddenLatestIds.has(card.id))
    .slice(-8);

  return `
    <div class="discard-pile top-card" data-testid="top-card">
      <div class="discard-stack" aria-label="弃牌堆">
        ${historyCards
          .map((card, index) => {
            const offset = getPileOffset(index, historyCards.length);

            return `
              <img
                class="discard-card history-discard-card"
                src="${getCardAssetPath(card)}"
                alt="${escapeHtml(card.displayName)}"
                style="--pile-x: ${String(offset.x)}px; --pile-y: ${String(offset.y)}px; --pile-rotate: ${String(offset.rotate)}deg; --pile-index: ${String(index)};"
              />
            `;
          })
          .join("")}
        ${activeChain.length === 0 ? renderLatestPlayedGroup(latestGroup) : ""}
        ${renderActiveDrawChain(activeChain)}
      </div>
      <strong>${escapeHtml(snapshot.topCard.displayName)}</strong>
    </div>
  `;
}

function getLatestPlayedGroup(
  pileCards: readonly Card[]
): { cards: Card[]; mode: "single" | "sequence" | "multiple" | "discard-same-color" } {
  const event = state.latestPlayGroupEvent;

  if (event === null || event.cardIds.length === 0) {
    const topCard = pileCards[pileCards.length - 1];
    return {
      cards: topCard === undefined ? [] : [topCard],
      mode: "single"
    };
  }

  const latestCards = event.cardIds
    .map((cardId) => pileCards.find((card) => card.id === cardId))
    .filter((card): card is Card => card !== undefined);

  if (latestCards.length !== event.cardIds.length) {
    const topCard = pileCards[pileCards.length - 1];
    return {
      cards: topCard === undefined ? [] : [topCard],
      mode: "single"
    };
  }

  return {
    cards: orderLatestPlayedCards(latestCards),
    mode: classifyPlayedGroup(latestCards)
  };
}

function orderLatestPlayedCards(cards: readonly Card[]): Card[] {
  const sameColorMainCard = cards.find((card) => card.kind === "discard-same-color");

  if (sameColorMainCard !== undefined) {
    return [
      ...cards.filter((card) => card.id !== sameColorMainCard.id),
      sameColorMainCard
    ];
  }

  return [...cards];
}

function classifyPlayedGroup(
  cards: readonly Card[]
): "single" | "sequence" | "multiple" | "discard-same-color" {
  if (cards.length <= 1) {
    return "single";
  }

  if (cards.some((card) => card.kind === "discard-same-color")) {
    return "discard-same-color";
  }

  const numberCards = cards.filter((card) => card.kind === "number");

  if (numberCards.length === cards.length) {
    const first = numberCards[0];
    const isMultiple =
      first !== undefined &&
      numberCards.every(
        (card) => card.color === first.color && card.number === first.number
      );

    if (isMultiple) {
      return "multiple";
    }

    return "sequence";
  }

  return "single";
}

function renderLatestPlayedGroup(group: ReturnType<typeof getLatestPlayedGroup>): string {
  if (group.cards.length === 0) {
    return "";
  }

  const groupClass =
    group.cards.length > 1 ? `latest-play-group ${group.mode}` : "latest-play-group single";
  const event = state.latestPlayGroupEvent;
  const shouldAnimate =
    event !== null && state.latestPlayGroupAnimationKey === event.animationKey;

  if (shouldAnimate) {
    state.latestPlayGroupAnimationKey = null;
  }

  return `
    <div class="${escapeHtml(groupClass)}" data-testid="latest-play-group">
      ${group.cards
        .map((card, index) => {
          const fan = getFanOffset(index, group.cards.length);

          return `
            <img
              class="discard-card top-discard-card latest-play-card${shouldAnimate ? " play-card-landing" : ""}"
              src="${getCardAssetPath(card)}"
              alt="${escapeHtml(card.displayName)}"
              style="--fan-x: ${String(fan.x)}px; --fan-y: ${String(fan.y)}px; --fan-rotate: ${String(fan.rotate)}deg; --fan-index: ${String(index)};"
            />
          `;
        })
        .join("")}
    </div>
  `;
}

function getActiveDrawChainCards(
  snapshot: PlayerGameSnapshot,
  pileCards: readonly Card[],
  latestGroup: ReturnType<typeof getLatestPlayedGroup>
): Card[] {
  const shouldShowDrawStack =
    snapshot.drawStack.active || snapshot.drawUntilColor.active;

  if (!shouldShowDrawStack) {
    return [];
  }

  const chainCards: Card[] = [];

  for (let index = pileCards.length - 1; index >= 0; index -= 1) {
    const card = pileCards[index];

    if (card === undefined || !isDrawChainDisplayCard(card)) {
      break;
    }

    chainCards.unshift(card);
  }

  if (chainCards.length <= 1) {
    return [];
  }

  return chainCards;
}

function isDrawChainDisplayCard(card: Card): boolean {
  return (
    card.kind === "draw-two" ||
    card.kind === "draw-four" ||
    card.kind === "wild-reverse-draw-four" ||
    card.kind === "wild-draw-six" ||
    card.kind === "wild-draw-ten" ||
    card.kind === "penalty-draw"
  );
}

function renderActiveDrawChain(cards: readonly Card[]): string {
  if (cards.length === 0) {
    return "";
  }

  return `
    <div class="active-draw-chain" data-testid="active-draw-chain">
      ${cards
        .map((card, index) => `
          <img
            class="draw-chain-card"
            src="${getCardAssetPath(card)}"
            alt="${escapeHtml(card.displayName)}"
            style="--chain-index: ${String(index)};"
          />
        `)
        .join("")}
    </div>
  `;
}

function renderFlyingCard(snapshot: PlayerGameSnapshot): string {
  const animation = state.flyingCard;

  if (animation === null || animation.card.id !== snapshot.topCard.id) {
    return "";
  }

  return `
    <img
      class="flying-card ${animation.seatClass}"
      key="${escapeHtml(animation.key)}"
      src="${getCardAssetPath(animation.card)}"
      alt="${escapeHtml(animation.card.displayName)}"
    />
  `;
}

function renderDrawFlyingCard(): string {
  const animation = state.drawFlyingCard;

  if (animation === null) {
    return "";
  }

  return `
    <img
      class="draw-flying-card ${animation.seatClass}"
      key="${escapeHtml(animation.key)}"
      src="${getCardBackAssetPath()}"
      alt="摸牌动画"
      data-draw-count="${String(animation.count)}"
    />
  `;
}

function renderDrawStackBurst(): string {
  const burst = state.drawStackBurst;

  if (burst === null || burst.cards.length === 0) {
    return "";
  }

  return `
    <div class="draw-stack-burst" data-testid="draw-stack-burst">
      ${burst.cards
        .map((card, index) => {
          const offset = getPileOffset(index, burst.cards.length);

          return `
            <img
              class="burst-card"
              src="${getCardAssetPath(card)}"
              alt="${escapeHtml(card.displayName)}"
              style="--burst-x: ${String(offset.x * 1.5)}px; --burst-y: ${String(offset.y * 1.5)}px; --burst-rotate: ${String(offset.rotate)}deg; --burst-index: ${String(index)};"
            />
          `;
        })
        .join("")}
    </div>
  `;
}

function renderChallengePrompt(
  snapshot: PlayerGameSnapshot,
  prompt: ChallengePromptState
): string {
  const targetName = lookupPlayerName(snapshot, prompt.targetPlayerId);

  return `
    <div class="challenge-prompt" data-testid="challenge-prompt">
      <strong>是否质疑</strong>
      <span>${escapeHtml(targetName)} 刚摸牌</span>
      <small>成功：对方摸 2 张 · 失败：自己摸 6 张</small>
      <div class="challenge-countdown"><span></span></div>
      <div class="challenge-actions">
        <button id="challenge-yes-button" data-challenge="${escapeHtml(prompt.targetPlayerId)}">是</button>
        <button id="challenge-no-button" class="secondary">否</button>
      </div>
    </div>
  `;
}

function renderBattleHud(snapshot: PlayerGameSnapshot, isMyTurn: boolean): string {
  return `
    <div class="battle-hud">
      <span class="hud-primary">当前：${escapeHtml(isMyTurn ? "轮到你" : lookupPlayerName(snapshot, snapshot.currentPlayerId))}</span>
      <span class="hud-item">颜色：${renderCurrentColorBadge(snapshot.currentColor)}</span>
      <span class="hud-item">方向：${renderDirectionIndicator(snapshot.direction)}</span>
      <span class="hud-item">牌堆 ${String(snapshot.drawPileCount)} 张</span>
      <span
        class="hud-item battle-connection-status status-${state.connectionStatus}"
        data-testid="connection-status"
      >${state.connectionStatus}</span>
      ${renderBattleStatusChips(snapshot)}
      <button
        id="battle-rule-button"
        data-testid="battle-rule-button"
        class="secondary hud-rule-button"
      >规则</button>
      <button
        id="battle-leave-room-button"
        data-testid="battle-leave-room-button"
        class="secondary hud-leave-button"
        ${state.connectionStatus === "open" ? "" : `disabled title="未连接服务端。"`}
      >退出房间</button>
    </div>
  `;
}

interface DrawActionState {
  actionType: "draw-card" | "resolve-draw-stack" | "resolve-draw-until-color";
  label: string;
  enabled: boolean;
  reason: string;
}

function renderDrawButton(snapshot: PlayerGameSnapshot, enabled: boolean): string {
  const state = getDrawActionState(snapshot, enabled);

  return `
    <button
      id="draw-card-button"
      data-testid="draw-card-button"
      data-draw-action="${state.actionType}"
      title="${escapeHtml(state.enabled ? state.label : state.reason)}"
      ${state.enabled ? "" : "disabled"}
    >${escapeHtml(state.label)}</button>
  `;
}

function getDrawActionState(snapshot: PlayerGameSnapshot, enabled: boolean): DrawActionState {
  if (!enabled) {
    return {
      actionType: "draw-card",
      label: "摸牌",
      enabled: false,
      reason: getTurnActionDisabledReason(snapshot)
    };
  }

  if (
    snapshot.normalDrawOffer.active &&
    snapshot.normalDrawOffer.playerId === state.playerId
  ) {
    return {
      actionType: "draw-card",
      label: "先处理刚摸到的牌",
      enabled: false,
      reason: "请先决定打出或保留刚摸到的牌。"
    };
  }

  if (snapshot.drawStack.active && snapshot.drawStack.targetPlayerId === state.playerId) {
    return {
      actionType: "resolve-draw-stack",
      label: `摸 ${String(snapshot.drawStack.amount)} 张`,
      enabled: true,
      reason: ""
    };
  }

  if (snapshot.drawUntilColor.active && snapshot.drawUntilColor.targetPlayerId === state.playerId) {
    const targetColor = snapshot.drawUntilColor.color;

    return {
      actionType: "resolve-draw-until-color",
      label: targetColor === null ? "继续罚摸" : `罚摸${getColorDisplayName(targetColor)}：摸 1 张`,
      enabled: true,
      reason: ""
    };
  }

  return {
    actionType: "draw-card",
    label: "摸牌",
    enabled: true,
    reason: ""
  };
}

function getTurnActionDisabledReason(snapshot: PlayerGameSnapshot): string {
  if (snapshot.status === "finished") {
    return "本局已结束。";
  }

  if (state.connectionStatus !== "open") {
    return "未连接服务端。";
  }

  if (snapshot.currentPlayerId !== state.playerId) {
    return `等待 ${lookupPlayerName(snapshot, snapshot.currentPlayerId)} 行动。`;
  }

  return "当前不能操作。";
}

function getSayUnoDisabledReason(
  snapshot: PlayerGameSnapshot,
  isConnected: boolean,
  isGameFinished: boolean
): string {
  if (isGameFinished) {
    return "本局已结束。";
  }

  if (!isConnected) {
    return "未连接服务端。";
  }

  if (snapshot.self.isEliminated) {
    return "你已出局。";
  }

  if (snapshot.self.isRoundWinner) {
    return "你已获胜。";
  }

  if (snapshot.self.handCount !== 1) {
    return "手牌剩 1 张时才能喊 UNO。";
  }

  if (snapshot.self.hasCalledUno) {
    return "你已经喊过 UNO。";
  }

  return "当前不能喊 UNO。";
}

function renderCurrentColorBadge(color: string): string {
  return `
    <span class="table-color">
      <span class="color-swatch color-${escapeHtml(color)}" aria-hidden="true"></span>
      <span>${escapeHtml(getColorDisplayName(color))}</span>
    </span>
  `;
}

function getColorDisplayName(color: string): string {
  switch (color) {
    case "red":
      return "红色";
    case "yellow":
      return "黄色";
    case "blue":
      return "蓝色";
    case "green":
      return "绿色";
    default:
      return color;
  }
}

function renderBattleStatusChips(snapshot: PlayerGameSnapshot): string {
  const chips: string[] = [];

  if (snapshot.drawStack.active) {
    chips.push(`<span class="hud-chip danger">加牌 +${String(snapshot.drawStack.amount)}</span>`);
  }

  if (snapshot.drawUntilColor.active) {
    chips.push(`<span class="hud-chip warning">罚抽 ${escapeHtml(snapshot.drawUntilColor.color ?? "")}</span>`);
  }

  if (snapshot.challengeWindow.active) {
    chips.push(`<span class="hud-chip warning">可质疑</span>`);
  }

  return chips.join("");
}

function renderActionGuide(
  snapshot: PlayerGameSnapshot,
  canTakeTurnAction: boolean,
  isGameFinished: boolean,
  isConnected: boolean
): string {
  let message = "等待对局状态更新。";
  let tone = "muted";

  if (isGameFinished) {
    message = "本局已结束，可以返回大厅重新开房。";
  } else if (!isConnected) {
    message = "连接已断开，请重连后继续。";
    tone = "warning";
  } else if (canTakeTurnAction && snapshot.drawStack.active) {
    message = `加牌链正在压到你：可以叠加加牌，或结算摸 ${String(snapshot.drawStack.amount)} 张。`;
    tone = "danger";
  } else if (canTakeTurnAction && snapshot.drawUntilColor.active) {
    message = "罚抽压力正在压到你：可以打罚抽牌回应，或结算罚抽。";
    tone = "danger";
  } else if (canTakeTurnAction) {
    message = "轮到你：选择一张高亮手牌出牌，或从牌堆摸牌。";
    tone = "active";
  } else {
    message = `等待 ${lookupPlayerName(snapshot, snapshot.currentPlayerId)} 操作。`;
  }

  return `<div class="action-guide guide-${tone}">${escapeHtml(message)}</div>`;
}

function renderCardButton(card: Card, snapshot: PlayerGameSnapshot, enabled: boolean): string {
  const isSelected = state.selectedCardIds.includes(card.id);
  const canSelect = isCardSelectable(card, snapshot, enabled);
  const hint = getCardHint(card, snapshot, enabled);
  const disabled = canSelect ? "" : "disabled";

  return `
    <button
      class="card-button ${hint.className} ${isSelected ? "selected" : ""}"
      data-card-id="${escapeHtml(card.id)}"
      aria-pressed="${isSelected ? "true" : "false"}"
      aria-label="${escapeHtml(`${card.displayName} \u00b7 ${hint.label}`)}"
      title="${escapeHtml(hint.label)}"
      ${disabled}
    >
      <img src="${getCardAssetPath(card)}" alt="${escapeHtml(card.displayName)}" />
    </button>
  `;
}

function isCardSelectable(card: Card, snapshot: PlayerGameSnapshot, canTakeTurnAction: boolean): boolean {
  if (!canTakeTurnAction) {
    return false;
  }

  if (
    snapshot.normalDrawOffer.active &&
    snapshot.normalDrawOffer.playerId === state.playerId
  ) {
    return card.id === snapshot.normalDrawOffer.cardId;
  }

  if (snapshot.drawUntilColor.active) {
    return card.kind === "penalty-draw";
  }

  if (snapshot.drawStack.active) {
    return canContinueDrawStack(card, snapshot);
  }

  return true;
}

function getCardHint(card: Card, snapshot: PlayerGameSnapshot, enabled: boolean): CardHint {
  if (!enabled) {
    return { className: "neutral", label: "当前不可操作" };
  }

  if (
    snapshot.normalDrawOffer.active &&
    snapshot.normalDrawOffer.playerId === state.playerId &&
    card.id !== snapshot.normalDrawOffer.cardId
  ) {
    return { className: "unplayable", label: "请先处理刚摸到的牌" };
  }

  if (snapshot.drawUntilColor.active) {
    if (card.kind === "penalty-draw") {
      return { className: "playable", label: "可回应罚抽" };
    }

    return { className: "unplayable", label: "罚抽状态下只能打罚抽牌或结算罚抽" };
  }

  if (snapshot.drawStack.active) {
    if (canContinueDrawStack(card, snapshot)) {
      return { className: "playable", label: "可尝试叠加加牌" };
    }

    return { className: "unplayable", label: "加牌链状态下只能叠加加牌牌或结算摸牌" };
  }

  if (card.isBlack) {
    return { className: "playable", label: "黑牌可选择颜色" };
  }

  if (canPlaySingleCardLike(card, snapshot)) {
    return { className: "playable", label: "当前可出牌" };
  }

  return { className: "unplayable", label: "当前颜色或牌型不匹配" };
}

function canContinueDrawStack(card: Card, snapshot: PlayerGameSnapshot): boolean {
  const previousDrawValue = (snapshot.drawStack as { previousDrawValue?: number | null }).previousDrawValue ?? null;
  const previousDrawKind = (snapshot.drawStack as { previousDrawKind?: string | null }).previousDrawKind ?? null;

  if (previousDrawValue === null || previousDrawKind === null) {
    return false;
  }

  if (!isDrawStackKindName(card.kind) || !isDrawStackKindName(previousDrawKind)) {
    return false;
  }

  if (card.kind === "draw-two") {
    return previousDrawKind === "draw-two";
  }

  if (card.kind === "draw-four") {
    return previousDrawKind === "draw-four";
  }

  return (
    card.drawValue !== undefined &&
    getDrawStackRankName(card.kind) >= getDrawStackRankName(previousDrawKind) &&
    card.drawValue >= previousDrawValue
  );
}

type DrawStackKindName =
  | "draw-two"
  | "draw-four"
  | "wild-reverse-draw-four"
  | "wild-draw-six"
  | "wild-draw-ten";

function isDrawStackKindName(kind: string): kind is DrawStackKindName {
  return (
    kind === "draw-two" ||
    kind === "draw-four" ||
    kind === "wild-reverse-draw-four" ||
    kind === "wild-draw-six" ||
    kind === "wild-draw-ten"
  );
}

function getDrawStackRankName(kind: DrawStackKindName): number {
  switch (kind) {
    case "draw-two":
      return 2;
    case "draw-four":
    case "wild-reverse-draw-four":
      return 4;
    case "wild-draw-six":
      return 6;
    case "wild-draw-ten":
      return 10;
  }
}

function canPlaySingleCardLike(card: Card, snapshot: PlayerGameSnapshot): boolean {
  if (card.isBlack) {
    return true;
  }

  if (card.kind === "number" && snapshot.topCard.kind === "number") {
    return card.color === snapshot.currentColor || card.number === snapshot.topCard.number;
  }

  if (card.kind !== "number" && snapshot.topCard.kind !== "number") {
    return card.kind === snapshot.topCard.kind || card.color === snapshot.currentColor;
  }

  return card.color === snapshot.currentColor;
}

function renderDirectionIndicator(direction: PlayerGameSnapshot["direction"]): string {
  const isClockwise = direction === "clockwise";
  const label = isClockwise ? "顺时针" : "逆时针";

  return `
    <span
      class="direction-indicator ${isClockwise ? "direction-clockwise" : "direction-counter-clockwise"}"
      title="${label}"
      aria-label="${label}"
    >
      <span class="direction-icon" aria-hidden="true">${isClockwise ? "↻" : "↺"}</span>
      <span class="direction-label">${isClockwise ? "顺" : "逆"}</span>
    </span>
  `;
}

function renderDrawAmountFact(snapshot: PlayerGameSnapshot): string {
  if (snapshot.drawStack.active) {
    return `<span class="table-fact table-fact-danger">加牌 +${String(snapshot.drawStack.amount)}</span>`;
  }

  if (snapshot.drawUntilColor.active) {
    const targetColor = snapshot.drawUntilColor.color;

    return `<span class="table-fact table-fact-danger">${targetColor === null ? "罚摸中" : `罚摸 ${getColorDisplayName(targetColor)}`}</span>`;
  }

  return `<span class="table-fact">牌堆 ${String(snapshot.drawPileCount)} 张</span>`;
}

function renderCardButtonV2(
  card: Card,
  index: number,
  snapshot: PlayerGameSnapshot,
  canTakeTurnAction: boolean,
  selectedCards: readonly Card[],
  sequenceCandidateCardIds: ReadonlySet<string>
): string {
  const info = getHandCardPresentation(
    card,
    snapshot,
    canTakeTurnAction,
    selectedCards,
    sequenceCandidateCardIds
  );
  const classes = ["card-button", info.baseState];

  if (info.sequenceCandidate) {
    classes.push("combo-candidate");
  }

  if (info.relationState !== null) {
    classes.push(info.relationState);
  }

  const motion = state.handCardMotion[card.id];
  if (motion !== undefined) {
    classes.push(`card-motion-${motion}`);
  }

  if (state.recentDrawnCardIds.includes(card.id)) {
    classes.push("recent-drawn");
  }

  return `
    <button
      class="${classes.join(" ")}"
      data-card-id="${escapeHtml(card.id)}"
      data-card-index="${String(index)}"
      style="--card-index: ${String(index)}"
      data-card-state="${escapeHtml(info.baseState)}"
      data-card-relation="${escapeHtml(info.relationState ?? "")}"
      aria-pressed="${info.relationState === "selected" ? "true" : "false"}"
      aria-disabled="${info.canSelect ? "false" : "true"}"
      aria-label="${escapeHtml(`${card.displayName} · ${info.reason}`)}"
      title="${escapeHtml(info.reason)}"
    >
      <img src="${getCardAssetPath(card)}" alt="${escapeHtml(card.displayName)}" />
    </button>
  `;
}

function getHandCardPresentation(
  card: Card,
  snapshot: PlayerGameSnapshot,
  canTakeTurnAction: boolean,
  selectedCards: readonly Card[],
  sequenceCandidateCardIds: ReadonlySet<string>
): HandCardPresentation {
  const isSelected = selectedCards.some((selectedCard) => selectedCard.id === card.id);
  const sequenceCandidate = sequenceCandidateCardIds.has(card.id);
  const base = getBaseHandCardPresentation(card, snapshot, sequenceCandidate, canTakeTurnAction);

  if (!canTakeTurnAction) {
    return {
      ...base,
      relationState: isSelected ? "selected" : null,
      reason: "当前不能操作",
      canSelect: false
    };
  }

  if (isSelected) {
    return {
      ...base,
      relationState: "selected",
      reason: "再次点击可取消选择",
      canSelect: true
    };
  }

  if (selectedCards.length === 0) {
    return {
      ...base,
      relationState: null
    };
  }

  const tentativeSelection = [...selectedCards, card];
  const compatibleKinds = getSelectionPotentialKinds(tentativeSelection, snapshot.self.hand, snapshot);

  if (compatibleKinds.length > 0) {
    return {
      ...base,
      relationState: "compatible",
      reason: getSelectionPotentialMessage(compatibleKinds),
      canSelect: true
    };
  }

  return {
    ...base,
    relationState: "incompatible",
    reason: describeSelectionMismatch(card, selectedCards, snapshot),
    canSelect: false
  };
}

function getBaseHandCardPresentation(
  card: Card,
  snapshot: PlayerGameSnapshot,
  sequenceCandidate: boolean,
  canTakeTurnAction: boolean
): Pick<HandCardPresentation, "baseState" | "reason" | "canSelect" | "sequenceCandidate"> {
  if (!canTakeTurnAction) {
    return {
      baseState: "disabled",
      reason: "当前不能操作",
      canSelect: false,
      sequenceCandidate
    };
  }

  if (
    snapshot.normalDrawOffer.active &&
    snapshot.normalDrawOffer.playerId === state.playerId &&
    card.id !== snapshot.normalDrawOffer.cardId
  ) {
    return {
      baseState: "disabled",
      reason: "请先处理刚摸到的牌",
      canSelect: false,
      sequenceCandidate
    };
  }

  if (snapshot.drawUntilColor.active) {
    if (card.kind === "penalty-draw") {
      return {
        baseState: "playable",
        reason: "可回应罚抽",
        canSelect: true,
        sequenceCandidate
      };
    }

    return {
      baseState: "disabled",
      reason: "当前处于罚抽状态，只能打罚抽牌或结算罚抽",
      canSelect: false,
      sequenceCandidate
    };
  }

  if (snapshot.drawStack.active) {
    if (canContinueDrawStack(card, snapshot)) {
      return {
        baseState: "playable",
        reason: "可继续叠加加牌",
        canSelect: true,
        sequenceCandidate
      };
    }

    return {
      baseState: "disabled",
      reason: "当前有加牌链，只能叠加加牌牌或结算摸牌",
      canSelect: false,
      sequenceCandidate
    };
  }

  if (canPlaySingleCardLike(card, snapshot)) {
    return {
      baseState: "playable",
      reason: card.isBlack ? "黑牌可先选颜色" : "可直接出牌",
      canSelect: true,
      sequenceCandidate
    };
  }

  if (canCardJoinAnyCombo(card, snapshot)) {
    return {
      baseState: "combo-candidate",
      reason: "可作为组合候选",
      canSelect: true,
      sequenceCandidate
    };
  }

  return {
    baseState: "disabled",
    reason: describeSingleCardMismatch(card, snapshot),
    canSelect: false,
    sequenceCandidate
  };
}

type ComboKind = "sequence" | "multiple-number" | "discard-same-color";

function getSelectionPotentialKinds(
  cards: readonly Card[],
  hand: readonly Card[],
  snapshot?: PlayerGameSnapshot
): ComboKind[] {
  const kinds: ComboKind[] = [];

  if (canSelectionPotentiallyBeSequence(cards, hand)) {
    kinds.push("sequence");
  }

  if (canSelectionPotentiallyBeMultipleNumber(cards, hand)) {
    kinds.push("multiple-number");
  }

  if (canSelectionPotentiallyBeDiscardSameColor(cards, hand, snapshot)) {
    kinds.push("discard-same-color");
  }

  return kinds;
}

function canCardJoinAnyCombo(card: Card, snapshot: PlayerGameSnapshot): boolean {
  if (canPlaySingleCardLike(card, snapshot)) {
    return true;
  }

  if (card.kind !== "number") {
    return getSelectionPotentialKinds([card], snapshot.self.hand, snapshot).includes("discard-same-color");
  }

  return (
    canNumberJoinLegalMultiple(card, snapshot) ||
    getSequenceCandidateCardIds(snapshot.self.hand, {
      currentColor: snapshot.currentColor,
      topCard: snapshot.topCard
    }).has(card.id)
  );
}

function canNumberJoinLegalMultiple(card: Card, snapshot: PlayerGameSnapshot): boolean {
  if (card.kind !== "number" || card.color === undefined || card.number === undefined) {
    return false;
  }

  if (!canPlaySingleCardLike(card, snapshot)) {
    return false;
  }

  const sameCards = snapshot.self.hand.filter((candidate) => {
    return (
      candidate.kind === "number" &&
      candidate.color === card.color &&
      candidate.number === card.number
    );
  });

  return sameCards.length >= 2;
}

function canSelectionPotentiallyBeSequence(
  cards: readonly Card[],
  hand: readonly Card[]
): boolean {
  if (
    cards.length === 0 ||
    !cards.every((card) => card.kind === "number" && card.number !== undefined)
  ) {
    return false;
  }

  const selectedNumbers = cards.map((card) => card.number as number);
  const uniqueNumbers = new Set(selectedNumbers);

  if (uniqueNumbers.size !== selectedNumbers.length) {
    return false;
  }

  const numberCounts = new Map<number, number>();

  for (const card of hand) {
    if (card.kind !== "number" || card.number === undefined) {
      continue;
    }

    numberCounts.set(card.number, (numberCounts.get(card.number) ?? 0) + 1);
  }

  for (let start = 0; start <= 5; start += 1) {
    for (let end = start + 4; end <= 9; end += 1) {
      if (!selectedNumbers.every((number) => number >= start && number <= end)) {
        continue;
      }

      let valid = true;

      for (let value = start; value <= end; value += 1) {
        if ((numberCounts.get(value) ?? 0) === 0) {
          valid = false;
          break;
        }
      }

      if (valid) {
        return true;
      }
    }
  }

  return false;
}

function canSelectionPotentiallyBeMultipleNumber(
  cards: readonly Card[],
  hand: readonly Card[]
): boolean {
  if (cards.length === 0 || !cards.every((card) => card.kind === "number")) {
    return false;
  }

  const referenceCard = cards[0];

  if (referenceCard === undefined) {
    return false;
  }

  if (
    !cards.every(
      (card) => card.color === referenceCard.color && card.number === referenceCard.number
    )
  ) {
    return false;
  }

  const sameCards = hand.filter((card) => {
    return (
      card.kind === "number" &&
      card.color === referenceCard.color &&
      card.number === referenceCard.number
    );
  });

  return sameCards.length >= Math.max(2, cards.length);
}

function canSelectionPotentiallyBeDiscardSameColor(
  cards: readonly Card[],
  hand: readonly Card[],
  snapshot?: PlayerGameSnapshot
): boolean {
  if (cards.length === 0) {
    return false;
  }

  const colors = new Set<Card["color"]>();

  for (const card of cards) {
    if (card.isBlack || card.color === undefined) {
      return false;
    }

    colors.add(card.color);
  }

  if (colors.size !== 1) {
    return false;
  }

  const [color] = colors;

  if (color === undefined) {
    return false;
  }

  const sameColorCards = hand.filter((card) => card.color === color && !card.isBlack);
  const sameColorMainCards = hand.filter(
    (card) => card.kind === "discard-same-color" && card.color === color
  );

  if (sameColorCards.length < Math.max(2, cards.length) || sameColorMainCards.length === 0) {
    return false;
  }

  if (snapshot === undefined) {
    return true;
  }

  return sameColorMainCards.some((mainCard) => canPlaySingleCardLike(mainCard, snapshot));
}

function getSelectionPotentialMessage(kinds: readonly ComboKind[]): string {
  if (kinds.includes("sequence")) {
    return "可继续选择组成顺子";
  }

  if (kinds.includes("multiple-number")) {
    return "可继续选择组成连对";
  }

  if (kinds.includes("discard-same-color")) {
    return "可继续选择组成同色丢弃";
  }

  return "可继续选择组成组合";
}

function describeSelectionMismatch(
  card: Card,
  selectedCards: readonly Card[],
  snapshot: PlayerGameSnapshot
): string {
  const potentialKinds = getSelectionPotentialKinds(selectedCards, snapshot.self.hand, snapshot);

  if (potentialKinds.includes("sequence")) {
    return "这张牌不能和已选牌组成顺子";
  }

  if (potentialKinds.includes("multiple-number")) {
    return "连对必须是相同颜色和相同数字";
  }

  if (potentialKinds.includes("discard-same-color")) {
    return card.isBlack
      ? "同色丢弃不能包含黑牌"
      : "这张牌不能和已选牌组成同色丢弃";
  }

  return selectedCards.length > 0
    ? "这张牌不能和当前已选牌组合"
    : describeSingleCardMismatch(card, snapshot);
}

interface PlaySelectionPreview {
  canPlay: boolean;
  label: string;
  message: string;
}

interface DiscardSameColorPlayPreview {
  canPlay: boolean;
  message: string;
  payload: {
    mainCardId: string;
    attachedCardIds: string[];
  } | null;
}

type PlayReasonCategory =
  | "state"
  | "forced-action"
  | "operation"
  | "selection-shape"
  | "card-match"
  | "missing-parameter"
  | "suggestion";

interface PlayReason {
  priority: number;
  category: PlayReasonCategory;
  message: string;
}

const PLAY_REASON_CATEGORY_WEIGHT: Record<PlayReasonCategory, number> = {
  state: 7,
  "forced-action": 6,
  operation: 5,
  "selection-shape": 4,
  "card-match": 3,
  "missing-parameter": 2,
  suggestion: 1
};

function getPlaySelectionPreview(
  snapshot: PlayerGameSnapshot,
  selectedCards: readonly Card[],
  canTakeTurnAction: boolean
): PlaySelectionPreview {
  if (!canTakeTurnAction) {
    return {
      canPlay: false,
      label: "出牌",
      message: "当前不能操作。"
    };
  }

  if (selectedCards.length === 0) {
    return {
      canPlay: false,
      label: "出牌",
      message: "先点选手牌，再点击出牌。"
    };
  }

  if (snapshot.drawUntilColor.active) {
    if (selectedCards.length === 1 && selectedCards[0]?.kind === "penalty-draw") {
      return {
        canPlay: true,
        label: "出牌",
        message: "当前处于罚抽状态，已选中可回应的罚抽牌。"
      };
    }

    return {
      canPlay: false,
      label: "出牌",
      message: "当前处于罚抽状态，只能打罚抽牌或结算罚抽。"
    };
  }

  if (snapshot.drawStack.active) {
    if (selectedCards.length === 1 && canContinueDrawStack(selectedCards[0]!, snapshot)) {
      return {
        canPlay: true,
        label: "出牌",
        message: "当前有加牌链，已选中可继续叠加的加牌。"
      };
    }

    return {
      canPlay: false,
      label: "出牌",
      message: "当前有加牌链，只能叠加加牌牌或结算摸牌。"
    };
  }

  const discardSameColorPreview = getDiscardSameColorPlayPreview(snapshot, selectedCards);

  if (discardSameColorPreview !== null) {
    return {
      canPlay: discardSameColorPreview.canPlay,
      label: "出牌",
      message: discardSameColorPreview.message
    };
  }

  if (selectedCards.length === 1) {
    const [card] = selectedCards;

    if (card === undefined) {
      return {
        canPlay: false,
        label: "出牌",
        message: "请先选择手牌。"
      };
    }

    if (card.isBlack) {
      return {
        canPlay: true,
        label: "出牌并选色",
        message: "黑牌会先弹出颜色选择。"
      };
    }

    if (canPlaySingleCardLike(card, snapshot)) {
      return {
        canPlay: true,
        label: "出牌",
        message: "已选中可直接出的单牌。"
      };
    }

    const potentialKinds = getSelectionPotentialKinds(selectedCards, snapshot.self.hand, snapshot);

    if (potentialKinds.length > 0) {
      return {
        canPlay: false,
        label: "出牌",
        message: getSelectionPotentialMessage(potentialKinds)
      };
    }

    return {
      canPlay: false,
      label: "出牌",
      message: describeSingleCardMismatch(card, snapshot)
    };
  }

  if (isValidSequenceSelection(selectedCards) && canSequenceConnectCurrentCard(selectedCards, snapshot)) {
    return {
      canPlay: true,
      label: "出牌",
      message: "已选中可出的顺子。"
    };
  }

  if (canPlayMultipleNumberSelection(selectedCards) && canMultipleConnectCurrentCard(selectedCards, snapshot)) {
    return {
      canPlay: true,
      label: "出牌",
      message: "已选中可出的连对。"
    };
  }

  const potentialKinds = getSelectionPotentialKinds(selectedCards, snapshot.self.hand, snapshot);

  if (potentialKinds.length > 0) {
    return {
      canPlay: false,
      label: "出牌",
      message: getSelectionPotentialMessage(potentialKinds)
    };
  }

  const reasons = collectPlayReasons(snapshot, selectedCards);
  const bestReason = pickBestPlayReason(reasons);

  return {
    canPlay: false,
    label: "出牌",
    message: bestReason?.message ?? "当前选牌不合法。"
  };
}

function getDiscardSameColorPlayPreview(
  snapshot: PlayerGameSnapshot,
  selectedCards: readonly Card[]
): DiscardSameColorPlayPreview | null {
  const payload = buildDiscardSameColorPayload(selectedCards);

  if (payload === null) {
    return null;
  }

  const mainCard = selectedCards.find((card) => card.id === payload.mainCardId);

  if (mainCard === undefined) {
    return {
      canPlay: false,
      message: "同色丢弃需要先选主牌，再选附加牌。",
      payload: null
    };
  }

  if (snapshot.drawUntilColor.active) {
    return {
      canPlay: false,
      message: "当前处于罚抽状态，不能进行同色丢弃。",
      payload: null
    };
  }

  if (snapshot.drawStack.active) {
    return {
      canPlay: false,
      message: "当前有加牌链，不能进行同色丢弃。",
      payload: null
    };
  }

  if (!canPlaySingleCardLike(mainCard, snapshot)) {
    return {
      canPlay: false,
      message: describeSingleCardMismatch(mainCard, snapshot),
      payload: null
    };
  }

  for (const attachedCard of selectedCards) {
    if (attachedCard.id === mainCard.id) {
      continue;
    }

    if (attachedCard.isBlack) {
      return {
        canPlay: false,
        message: "同色丢弃的附加牌不能包含黑牌。",
        payload: null
      };
    }

    if (attachedCard.color !== mainCard.color) {
      return {
        canPlay: false,
        message: "同色丢弃的附加牌颜色必须和主牌相同。",
        payload: null
      };
    }
  }

  return {
    canPlay: true,
    message: "已选中同色丢弃主牌和附加牌。",
    payload
  };
}

function collectPlayReasons(snapshot: PlayerGameSnapshot, selectedCards: readonly Card[]): PlayReason[] {
  const reasons: PlayReason[] = [];

  if (selectedCards.length === 0) {
    reasons.push({
      priority: 79,
      category: "operation",
      message: "请先选择手牌。"
    });
  }

  if (selectedCards.length >= 2 && selectedCards.some((card) => card.isBlack)) {
    reasons.push({
      priority: 39,
      category: "missing-parameter",
      message: "黑牌需要单独出牌并先选择颜色。"
    });
  }

  if (selectedCards.every((card) => card.kind === "number") && selectedCards.length > 0) {
    if (selectedCards.length < 5) {
      reasons.push({
        priority: 69,
        category: "selection-shape",
        message: "顺子至少需要 5 张数字牌。"
      });
    } else if (!areNumbersConsecutive(selectedCards)) {
      reasons.push({
        priority: 65,
        category: "selection-shape",
        message: "顺子数字必须连续。"
      });
    }
  }

  if (
    selectedCards.length >= 2 &&
    selectedCards.every((card) => card.kind === "number") &&
    !canPlayMultipleNumberSelection(selectedCards)
  ) {
    reasons.push({
      priority: 61,
      category: "selection-shape",
      message: "连对需要至少 2 张同色同数的数字牌。"
    });
  }

  const firstCard = selectedCards[0];

  if (firstCard !== undefined && !firstCard.isBlack && !canPlaySingleCardLike(firstCard, snapshot)) {
    reasons.push({
      priority: 54,
      category: "card-match",
      message: describeSingleCardMismatch(firstCard, snapshot)
    });
  }

  return reasons;
}

function pickBestPlayReason(reasons: readonly PlayReason[]): PlayReason | null {
  if (reasons.length === 0) {
    return null;
  }

  return [...reasons].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return PLAY_REASON_CATEGORY_WEIGHT[right.category] - PLAY_REASON_CATEGORY_WEIGHT[left.category];
  })[0] ?? null;
}

function areNumbersConsecutive(cards: readonly Card[]): boolean {
  const sorted = [...cards]
    .filter((card): card is Card & { number: number } => card.kind === "number" && card.number !== undefined)
    .sort((left, right) => left.number - right.number);

  for (let index = 1; index < sorted.length; index += 1) {
    const previousCard = sorted[index - 1];
    const currentCard = sorted[index];

    if (previousCard === undefined || currentCard === undefined) {
      return false;
    }

    if (currentCard.number !== previousCard.number + 1) {
      return false;
    }
  }

  return sorted.length >= 5;
}

function describeSingleCardMismatch(card: Card, snapshot: PlayerGameSnapshot): string {
  if (snapshot.drawStack.active) {
    return "当前有加牌链，只能叠加加牌牌或结算摸牌。";
  }

  if (snapshot.drawUntilColor.active) {
    return "当前处于罚抽状态，只能打罚抽牌或结算罚抽。";
  }

  if (card.kind === "number" && snapshot.topCard.kind === "number") {
    const colorMismatch = card.color !== snapshot.currentColor;
    const numberMismatch = card.number !== snapshot.topCard.number;

    if (colorMismatch && numberMismatch) {
      return "这张牌既不同色，也不同数。";
    }

    if (colorMismatch) {
      return `这张牌颜色不匹配，当前颜色是${getColorDisplayName(snapshot.currentColor)}。`;
    }

    return "这张牌数字不匹配。";
  }

  if (!card.isBlack && card.color !== snapshot.currentColor && card.kind !== snapshot.topCard.kind) {
    return "这张牌既不同色，也不同牌型。";
  }

  return "这张牌不能接当前牌。";
}

function renderSelectionPanel(
  snapshot: PlayerGameSnapshot,
  canTakeTurnAction: boolean,
  isGameFinished: boolean,
  isMyTurn: boolean,
  isConnected: boolean
): string {
  const hand = snapshot.self.hand;
  const selectedCards = getSelectedCards(hand, state.selectedCardIds);

  if (isGameFinished) {
    return `
      <div class="selection-panel">
        <p class="muted">本局已结束。</p>
      </div>
    `;
  }

  if (!isConnected) {
    return `
      <div class="selection-panel">
        <p class="muted">连接已断开，请重连后继续。</p>
      </div>
    `;
  }

  if (!isMyTurn) {
    return `
      <div class="selection-panel">
        <p class="muted">当前不是你的回合。</p>
      </div>
    `;
  }

  const preview = getPlaySelectionPreview(snapshot, selectedCards, canTakeTurnAction);

  return `
    <div class="selection-panel">
      <div class="selection-summary">
        <strong>已选 ${String(selectedCards.length)} 张</strong>
      </div>
      <div class="selection-actions">
        <button
          id="play-button"
          title="${escapeHtml(preview.message)}"
          ${preview.canPlay ? "" : "disabled"}
        >${escapeHtml(preview.label)}</button>
        <button id="clear-selection-button" class="secondary">清空</button>
      </div>
    </div>
  `;
}

function renderColorPickerPanel(hand: readonly Card[], canTakeTurnAction: boolean): string {
  if (state.colorPickerCardId === null || !canTakeTurnAction) {
    return "";
  }

  const selectedCard = hand.find((card) => card.id === state.colorPickerCardId);

  if (selectedCard === undefined) {
    return "";
  }

  return `
    <div class="color-picker-backdrop">
      <section class="panel color-picker-panel">
        <h2>选择颜色</h2>
        <p class="muted">${escapeHtml(selectedCard.displayName)}</p>
        <div class="color-choices">
          ${(["red", "yellow", "blue", "green"] as const)
            .map((color) => {
              return `
                <button data-color-choice="${color}" class="color-${color}">
                  <span class="color-swatch color-${color}" aria-hidden="true"></span>
                  <strong>${escapeHtml(getColorDisplayName(color))}</strong>
                </button>
              `;
            })
            .join("")}
        </div>
        <button id="cancel-color-picker-button" class="secondary">取消</button>
      </section>
    </div>
  `;
}

function lookupPlayerName(snapshot: PlayerGameSnapshot, playerId: PlayerId): string {
  if (snapshot.self.playerId === playerId) {
    return snapshot.self.displayName ?? playerId;
  }

  const opponent = snapshot.opponents.find((candidate) => candidate.playerId === playerId);
  return opponent?.displayName ?? playerId;
}

function resolvePlayerAvatar(playerId: PlayerId, avatarUrl: string | null | undefined): string {
  if (avatarUrl !== undefined && avatarUrl !== null && avatarUrl.trim() !== "") {
    return avatarUrl;
  }

  return `/avatars/avatar-${String((hashString(playerId) % FALLBACK_AVATAR_COUNT) + 1)}.png`;
}

function hashString(value: string): number {
  let hash = 0;

  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function getOpponentSeatClass(index: number, total: number): string {
  const layouts: Record<number, string[]> = {
    1: ["seat-top"],
    2: ["seat-left", "seat-right"],
    3: ["seat-left", "seat-top", "seat-right"],
    4: ["seat-left", "seat-top-left", "seat-top-right", "seat-right"],
    5: ["seat-left", "seat-top-left", "seat-top", "seat-top-right", "seat-right"],
    6: ["seat-left", "seat-top-left", "seat-top", "seat-top-right", "seat-right", "seat-mid-right"],
    7: [
      "seat-mid-left",
      "seat-left",
      "seat-top-left",
      "seat-top",
      "seat-top-right",
      "seat-right",
      "seat-mid-right"
    ]
  };

  return layouts[total]?.[index] ?? `seat-${String(index)}`;
}

function getPlayerSeatClass(snapshot: PlayerGameSnapshot, playerId: PlayerId): string {
  if (playerId === snapshot.self.playerId) {
    return "from-self";
  }

  const opponentIndex = snapshot.opponents.findIndex((player) => player.playerId === playerId);

  if (opponentIndex === -1) {
    return "from-top";
  }

  return `from-${getOpponentSeatClass(opponentIndex, snapshot.opponents.length).replace("seat-", "")}`;
}

function getPileOffset(index: number, total: number): { x: number; y: number; rotate: number } {
  const offsetSeed = index + total * 3;
  const x = ((offsetSeed * 7) % 17) - 8;
  const y = ((offsetSeed * 11) % 15) - 7;
  const rotate = ((offsetSeed * 13) % 21) - 10;

  return { x, y, rotate };
}

function canSequenceConnectCurrentCard(
  cards: readonly Card[],
  snapshot: PlayerGameSnapshot
): boolean {
  const firstCard = [...cards]
    .filter((card) => card.kind === "number")
    .sort((left, right) => (left.number ?? 0) - (right.number ?? 0))[0];

  return firstCard !== undefined && canPlaySingleCardLike(firstCard, snapshot);
}

function canMultipleConnectCurrentCard(
  cards: readonly Card[],
  snapshot: PlayerGameSnapshot
): boolean {
  const referenceCard = cards[0];

  return referenceCard !== undefined && canPlaySingleCardLike(referenceCard, snapshot);
}

function getFanOffset(index: number, total: number): { x: number; y: number; rotate: number } {
  if (total <= 1) {
    return { x: 0, y: 0, rotate: 0 };
  }

  const midpoint = (total - 1) / 2;
  const distance = index - midpoint;

  return {
    x: distance * 22,
    y: Math.abs(distance) * 2,
    rotate: distance * 7
  };
}

function syncRecentDrawnCards(
  previousSnapshot: PlayerGameSnapshot | null,
  nextSnapshot: PlayerGameSnapshot
): void {
  if (
    previousSnapshot === null ||
    previousSnapshot.self.playerId !== nextSnapshot.self.playerId
  ) {
    state.recentDrawnCardIds = [];
    return;
  }

  const previousCardIds = new Set(previousSnapshot.self.hand.map((card) => card.id));
  const addedCardIds = nextSnapshot.self.hand
    .filter((card) => !previousCardIds.has(card.id))
    .map((card) => card.id);
  const currentCardIds = new Set(nextSnapshot.self.hand.map((card) => card.id));

  state.recentDrawnCardIds = [...new Set([...state.recentDrawnCardIds, ...addedCardIds])].filter(
    (cardId) => currentCardIds.has(cardId)
  );
}

function syncFlyingCardAnimation(snapshot: PlayerGameSnapshot): void {
  const event = state.latestCardsPlayedEvent;

  if (event === null || event.topCardId !== snapshot.topCard.id) {
    return;
  }

  const key = `${event.playerId}-${event.topCardId}-${String(event.receivedAt)}`;

  state.flyingCard = {
    key,
    card: snapshot.topCard,
    playerId: event.playerId,
    seatClass: getPlayerSeatClass(snapshot, event.playerId)
  };
  state.latestCardsPlayedEvent = null;

  window.setTimeout(() => {
    if (state.flyingCard?.key === key) {
      state.flyingCard = null;
      render();
    }
  }, 700);
}

function startDrawCardAnimation(playerId: PlayerId, count: number): void {
  const key = `${playerId}-draw-${String(Date.now())}-${String(Math.random())}`;

  state.drawFlyingCard = {
    key,
    playerId,
    seatClass: state.snapshot === null ? "from-top" : getPlayerSeatClass(state.snapshot, playerId),
    count
  };

  window.setTimeout(() => {
    if (state.drawFlyingCard?.key === key) {
      state.drawFlyingCard = null;
      render();
    }
  }, 720);
}

function startDrawStackBurstAnimation(): void {
  if (state.snapshot === null) {
    return;
  }

  const pileCards = state.snapshot.discardPile;
  const chainCards: Card[] = [];

  for (let index = pileCards.length - 1; index >= 0; index -= 1) {
    const card = pileCards[index];

    if (card === undefined || !isDrawChainDisplayCard(card)) {
      break;
    }

    chainCards.unshift(card);
  }

  if (chainCards.length <= 1) {
    return;
  }

  const key = `draw-stack-burst-${String(Date.now())}-${String(Math.random())}`;
  state.drawStackBurst = {
    key,
    cards: chainCards
  };

  window.setTimeout(() => {
    if (state.drawStackBurst?.key === key) {
      state.drawStackBurst = null;
      render();
    }
  }, 680);
}

function syncChallengePrompt(snapshot: PlayerGameSnapshot): void {
  const targetPlayerId = snapshot.challengeWindow.targetPlayerId;
  const shouldShowPrompt =
    snapshot.mode === "with-challenge" &&
    snapshot.challengeWindow.active &&
    targetPlayerId !== null &&
    targetPlayerId !== snapshot.self.playerId;

  if (!shouldShowPrompt) {
    state.challengePrompt = null;
    return;
  }

  if (state.challengePrompt?.targetPlayerId !== targetPlayerId) {
    state.challengePrompt = {
      targetPlayerId,
      openedAt: Date.now(),
      dismissed: false
    };
  }
}

function getVisibleChallengePrompt(
  snapshot: PlayerGameSnapshot,
  isConnected: boolean,
  isGameFinished: boolean
): ChallengePromptState | null {
  const prompt = state.challengePrompt;

  if (
    prompt === null ||
    prompt.dismissed ||
    !isConnected ||
    isGameFinished ||
    !snapshot.challengeWindow.active ||
    snapshot.challengeWindow.targetPlayerId !== prompt.targetPlayerId
  ) {
    return null;
  }

  const remainingMs = CHALLENGE_PROMPT_MS - (Date.now() - prompt.openedAt);

  if (remainingMs <= 0) {
    prompt.dismissed = true;
    return null;
  }

  window.setTimeout(() => {
    if (state.challengePrompt === prompt) {
      prompt.dismissed = true;
      render();
    }
  }, remainingMs + 50);

  return prompt;
}

function scheduleUnoProtectionRender(snapshot: PlayerGameSnapshot): void {
  if (unoProtectionRenderTimer !== null) {
    window.clearTimeout(unoProtectionRenderTimer);
    unoProtectionRenderTimer = null;
  }

  const protectedPlayers = [snapshot.self, ...snapshot.opponents].filter(
    (player) =>
      player.handCount === 1 &&
      !player.hasCalledUno &&
      player.unoProtectionEndsAtMs !== null &&
      player.unoProtectionEndsAtMs > Date.now()
  );

  if (protectedPlayers.length === 0) {
    return;
  }

  const nextEndsAt = Math.min(
    ...protectedPlayers.map((player) => player.unoProtectionEndsAtMs ?? Date.now())
  );
  const nextTickMs = Math.min(1_000, Math.max(100, nextEndsAt - Date.now()));

  unoProtectionRenderTimer = window.setTimeout(() => {
    unoProtectionRenderTimer = null;
    render();

    if (state.snapshot !== null) {
      scheduleUnoProtectionRender(state.snapshot);
    }
  }, nextTickMs);
}

function renderLogPanel(): string {
  return `
    <details class="panel log-panel">
      <summary>消息记录</summary>
      <ol>
        ${state.log.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ol>
    </details>
  `;
}

function handleGameEvents(events: readonly GameEvent[]): void {
  const rejected = events.find((event) => event.type === "command-rejected");

  if (rejected !== undefined) {
    const translatedMessage = translateRejectedMessage(rejected.code, rejected.message);
    state.lastError = translatedMessage;
    pushLog(`\u547d\u4ee4\u88ab\u62d2\u7edd\uff1a${translatedMessage}`);
    showToast(`\u64cd\u4f5c\u5931\u8d25\uff1a${translatedMessage}`, "warning");
  }

  for (const event of events) {
    if (event.type === "cards-played") {
      state.recentDrawnCardIds = [];
      const receivedAt = Date.now();
      const playedEvent = {
        playerId: event.playerId,
        cardIds: [...event.cardIds],
        topCardId: event.topCardId,
        receivedAt,
        animationKey: `${event.topCardId}-${String(receivedAt)}`
      };
      state.latestCardsPlayedEvent = playedEvent;
      state.latestPlayGroupEvent = playedEvent;
      state.latestPlayGroupAnimationKey = playedEvent.animationKey;
      showToast(`${lookupNameFromKnownState(event.playerId)} \u51fa\u724c\u6210\u529f`, "success");
    }

    if (event.type === "draw-stack-cleared" && event.reason === "resolved") {
      startDrawStackBurstAnimation();
    }

    if (event.type === "cards-drawn") {
      if (event.count > 0) {
        startDrawCardAnimation(event.playerId, event.count);
      }

      if (event.drawUntilColor !== undefined) {
        const targetColor = getColorDisplayName(event.drawUntilColor.targetColor);
        const revealedColor =
          event.drawUntilColor.revealedColor === null
            ? "黑色"
            : getColorDisplayName(event.drawUntilColor.revealedColor);
        const suffix = event.drawUntilColor.matched ? "罚抽结束。" : "请继续摸。";

        showToast(
          `罚摸${targetColor}，摸到的是${revealedColor}，${suffix}`,
          event.drawUntilColor.matched ? "success" : "warning"
        );
      } else {
        showToast(`${lookupNameFromKnownState(event.playerId)} \u62bd ${String(event.count)} \u5f20`, "info");
      }
    }

    if (event.type === "challenge-resolved") {
      const message = event.success
        ? `\u8d28\u7591\u6210\u529f\uff1a${lookupNameFromKnownState(event.targetPlayerId)} \u62bd ${String(event.drawCount)} \u5f20`
        : `\u8d28\u7591\u5931\u8d25\uff1a${lookupNameFromKnownState(event.challengerPlayerId)} \u62bd ${String(event.drawCount)} \u5f20`;

      pushLog(message);
      showToast(message, event.success ? "success" : "warning");
    }

    if (event.type === "uno-report-failed-protected") {
      const message = `${lookupNameFromKnownState(event.targetPlayerId)} 仍在 UNO 保护期，抓 UNO 无效。`;
      pushLog(message);
      showToast(message, "warning");
    }

    if (event.type === "uno-called") {
      const message = `${lookupNameFromKnownState(event.playerId)} 已喊 UNO`;
      pushLog(message);
      showToast(message, "success");
    }

    if (event.type === "uno-penalty-applied") {
      const message = `抓 UNO 成功，${lookupNameFromKnownState(event.targetPlayerId)} 罚摸 ${String(event.drawCount)} 张`;
      pushLog(message);
      showToast(message, "success");
    }

    if (event.type === "player-eliminated") {
      const message = `${lookupNameFromKnownState(event.playerId)} 手牌为 ${String(event.handCount)} 张，已出局。`;
      state.eventModal = {
        key: `player-eliminated-${event.playerId}-${Date.now()}`,
        title: "玩家出局",
        message,
        tone: "warning",
        dismissible: true
      };
      pushLog(message);
      showToast(message, "warning");
    }

    if (event.type === "game-finished") {
      const message = `\u83b7\u80dc\u8005\uff1a${event.winnerPlayerIds
        .map((playerId) => lookupNameFromKnownState(playerId))
        .join(" \u00b7 ")}`;
      pushLog(message);
      showToast(message, "success");
    }

    if (event.type === "normal-draw-offer-opened" && event.playerId === state.playerId) {
      showToast("\u4f60\u6478\u5230\u4e86\u4e00\u5f20\u53ef\u51fa\u724c\uff0c\u8bf7\u9009\u62e9\u7acb\u5373\u6253\u51fa\u6216\u4fdd\u7559\u3002", "info");
    }
  }
}

function lookupNameFromKnownState(playerId: PlayerId): string {
  if (state.snapshot !== null) {
    return lookupPlayerName(state.snapshot, playerId);
  }

  if (state.room !== null) {
    const player = state.room.players.find((candidate) => candidate.playerId === playerId);
    return player?.displayName ?? playerId;
  }

  return playerId;
}

function translateRejectedMessage(code: ErrorCode, fallbackMessage: string): string {
  switch (code) {
    case "GAME_FINISHED":
      return "本局已经结束。";
    case "PLAYER_NOT_FOUND":
      return "找不到当前玩家。";
    case "PLAYER_ELIMINATED":
      return "你已经被淘汰，不能继续操作。";
    case "NOT_CURRENT_PLAYER":
      return "还没轮到你。";
    case "CARD_NOT_FOUND":
      return "你没有这张牌。";
    case "INVALID_COMBINATION":
      return "这组牌不合法。";
    case "CARD_NOT_PLAYABLE":
      return "这张牌不能接当前牌。";
    case "DECLARED_COLOR_REQUIRED":
      return "请先选择要声明的颜色。";
    case "DRAW_STACK_ACTIVE":
      return "当前有加牌链，只能叠加加牌牌或结算摸牌。";
    case "DRAW_STACK_NOT_ACTIVE":
      return "当前没有加牌链。";
    case "DRAW_UNTIL_COLOR_ACTIVE":
      return "当前处于罚抽状态，只能打罚抽牌或结算罚抽。";
    case "DRAW_UNTIL_COLOR_NOT_ACTIVE":
      return "当前没有罚抽状态。";
    case "UNO_NOT_AVAILABLE":
      return "当前不能说 UNO。";
    case "UNO_REPORT_FAILED":
      return translateUnoReportFailedMessage(fallbackMessage);
    case "CHALLENGE_NOT_AVAILABLE":
      return "当前不能质疑。";
    default:
      return fallbackMessage;
  }
}

function bindConnectionPanel(): void {
  document.querySelector("#connect-button")?.addEventListener("click", () => {
    if (state.connectionStatus === "open" || state.connectionStatus === "connecting") {
      return;
    }

    connectUsingCurrentInputs();
  });

  document.querySelector("#disconnect-button")?.addEventListener("click", () => {
    wsClient.close();
  });

  document.querySelector("#ping-button")?.addEventListener("click", () => {
    sendSafely(buildPingMessage());
  });
}

function connectUsingCurrentInputs(): void {
  const wsUrlInput = document.querySelector<HTMLInputElement>("#ws-url");
  const nicknameInput = document.querySelector<HTMLInputElement>("#nickname");

  if (wsUrlInput !== null) {
    state.wsUrl = wsUrlInput.value;
    setStoredValue("thunder-uno.wsUrl", state.wsUrl);
  }

  if (nicknameInput !== null) {
    state.nickname = ensureNicknameValue(nicknameInput.value);
    nicknameInput.value = state.nickname;
    setSessionStoredValue(USER_NICKNAME_STORAGE_KEY, state.nickname);
  }

  wsClient.connect(state.wsUrl);
}

function bindLobbyPanel(): void {
  bindRoomCodeInputs();

  document.querySelector("#create-room-button")?.addEventListener("click", () => {
    const mode = readSelectValue("#mode", "no-challenge") as GameMode;
    const message = buildCreateRoomMessage({
      userId: state.userId,
      nickname: state.nickname,
      mode
    });
    sendSafely(message);
  });

  document.querySelector("#join-room-button")?.addEventListener("click", () => {
    const roomId = getRoomCodeValue();

    if (roomId.length !== 6) {
      showRoomCodeInputError("请输入 6 位房间号。");
      render();
      return;
    }

    const message = buildJoinRoomMessage({
      roomId,
      userId: state.userId,
      nickname: state.nickname
    });
    sendSafely(message);
  });

  document.querySelector("#copy-room-button")?.addEventListener("click", () => {
    const roomId = state.roomId ?? getRoomCodeValue();

    if (roomId.length !== 6) {
      showToast("暂无可复制的房间号", "warning");
      return;
    }

    void copyTextToClipboard(roomId);
  });

  document.querySelector("#start-game-button")?.addEventListener("click", () => {
    if (state.roomId === null || state.playerId === null) {
      return;
    }

    sendSafely(
      buildStartGameMessage({
        roomId: state.roomId,
        playerId: state.playerId,
        seed: readInputValue("#seed-input")
      })
    );
  });

  document.querySelector("#add-bot-button")?.addEventListener("click", () => {
    if (state.roomId === null || state.playerId === null) {
      return;
    }

    sendSafely(
      buildAddBotMessage({
        roomId: state.roomId,
        playerId: state.playerId
      })
    );
  });

  document.querySelectorAll<HTMLButtonElement>("[data-kick-player]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.roomId === null || state.playerId === null) {
        return;
      }

      const targetPlayerId = button.dataset.kickPlayer;

      if (targetPlayerId === undefined || targetPlayerId.length === 0) {
        return;
      }

      sendSafely(
        buildKickPlayerMessage({
          roomId: state.roomId,
          playerId: state.playerId,
          targetPlayerId
        })
      );
    });
  });

  document.querySelector("#ready-button")?.addEventListener("click", () => {
    if (state.roomId === null || state.playerId === null || state.room === null) {
      return;
    }

    const selfPlayer = state.room.players.find((player) => player.playerId === state.playerId);

    if (selfPlayer === undefined || selfPlayer.isHost) {
      return;
    }

    sendSafely(
      buildSetReadyMessage({
        roomId: state.roomId,
        playerId: state.playerId,
        ready: !selfPlayer.isReady
      })
    );
  });

  document.querySelector("#leave-room-button")?.addEventListener("click", () => {
    if (state.roomId === null || state.playerId === null) {
      return;
    }

    sendSafely(buildLeaveRoomMessage({ roomId: state.roomId, playerId: state.playerId }));
    resetRoomContext();
    pushLog("已离开房间");
    render();
  });
}

function bindBattlePanel(): void {
  document.querySelector("#battle-leave-room-button")?.addEventListener("click", () => {
    leaveCurrentRoomFromBattle();
  });

  document.querySelector("#finish-reset-button")?.addEventListener("click", () => {
    resetRoomContext();
    pushLog("已返回大厅，请重新创建或加入房间");
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-card-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const cardId = button.dataset.cardId;

      if (cardId === undefined) {
        return;
      }

      handleHandCardClick(cardId);
    });
  });

  document.querySelector("#draw-card-button")?.addEventListener("click", () => {
    const drawButton = document.querySelector<HTMLButtonElement>("#draw-card-button");
    const drawAction = drawButton?.dataset.drawAction ?? "draw-card";

    if (drawAction === "resolve-draw-stack") {
      sendCommand({ type: "resolve-draw-stack" });
      return;
    }

    if (drawAction === "resolve-draw-until-color") {
      sendCommand({ type: "resolve-draw-until-color" });
      return;
    }

    sendCommand({ type: "draw-card" });
  });

  document.querySelector("#play-drawn-card-button")?.addEventListener("click", () => {
    if (state.snapshot === null) {
      return;
    }

    const offer = state.snapshot.normalDrawOffer;
    if (!offer.active || offer.playerId !== state.playerId || offer.cardId === null) {
      return;
    }

    const drawnCard = state.snapshot.self.hand.find((card) => card.id === offer.cardId);
    if (drawnCard === undefined) {
      return;
    }

    if (drawnCard.isBlack) {
      state.colorPickerCardId = drawnCard.id;
      render();
      return;
    }

    sendCommand({
      type: "play-card",
      cardId: drawnCard.id
    });
  });

  document.querySelector("#keep-drawn-card-button")?.addEventListener("click", () => {
    sendCommand({ type: "keep-drawn-card" });
  });

  document.querySelector("#say-uno-button")?.addEventListener("click", () => {
    sendCommand({ type: "say-uno" });
  });

  document.querySelector("#close-event-modal-button")?.addEventListener("click", () => {
    state.eventModal = null;
    render();
  });

  document.querySelector("#finish-reset-button-modal")?.addEventListener("click", () => {
    resetRoomContext();
    pushLog("已返回大厅，请重新创建或加入房间");
    render();
  });

  document.querySelector("#stay-in-room-button")?.addEventListener("click", () => {
    if (state.snapshot === null) {
      return;
    }

    const finishedNotice = buildFinishedNotice(state.snapshot);
    state.dismissedFinishedNoticeKey = finishedNotice?.key ?? null;
    render();
  });

  document.querySelector("#finish-leave-room-button")?.addEventListener("click", () => {
    leaveCurrentRoomFromBattle();
  });

  document.querySelector("#restart-game-button")?.addEventListener("click", () => {
    if (state.roomId === null || state.playerId === null) {
      return;
    }

    state.eventModal = null;
    sendSafely(
      buildRestartGameMessage({
        roomId: state.roomId,
        playerId: state.playerId,
        seed: readInputValue("#seed-input")
      })
    );
  });

  document.querySelector("#continue-game-button")?.addEventListener("click", () => {
    if (state.roomId === null || state.playerId === null) {
      return;
    }

    state.eventModal = null;
    sendSafely(
      buildContinueGameMessage({
        roomId: state.roomId,
        playerId: state.playerId
      })
    );
  });

  document.querySelector("#challenge-no-button")?.addEventListener("click", () => {
    if (state.challengePrompt !== null) {
      state.challengePrompt.dismissed = true;
      render();
    }
  });

  document.querySelector("#clear-selection-button")?.addEventListener("click", () => {
    clearSelectedCards();
    render();
  });

  document.querySelector("#play-button")?.addEventListener("click", () => {
    playSelectedCards();
  });

  document.querySelector("#cancel-color-picker-button")?.addEventListener("click", () => {
    state.colorPickerCardId = null;
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-color-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const color = button.dataset.colorChoice;

      if (
        color !== "red" &&
        color !== "yellow" &&
        color !== "blue" &&
        color !== "green"
      ) {
        return;
      }

      playSelectedBlackCard(color);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-report-uno]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetPlayerId = button.dataset.reportUno;

      if (targetPlayerId !== undefined) {
        sendCommand({ type: "report-uno", targetPlayerId });
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-challenge]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetPlayerId = button.dataset.challenge;

      if (targetPlayerId !== undefined) {
        sendCommand({ type: "challenge-draw", targetPlayerId });
        if (state.challengePrompt !== null) {
          state.challengePrompt.dismissed = true;
        }
      }
    });
  });
}

function leaveCurrentRoomFromBattle(): void {
  if (state.roomId === null || state.playerId === null) {
    return;
  }

  sendSafely(buildLeaveRoomMessage({ roomId: state.roomId, playerId: state.playerId }));
  resetRoomContext();
  pushLog("已退出房间");
  render();
}

function bindRuleControls(): void {
  document.querySelectorAll("#battle-rule-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.ruleModal = { type: "home" };
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-rule-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      const entryId = button.dataset.ruleEntry as RuleEntryId | undefined;
      if (entryId === undefined) {
        return;
      }

      openRuleEntry(entryId);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-rule-card]").forEach((button) => {
    button.addEventListener("click", () => {
      const cardId = button.dataset.ruleCard;
      if (cardId === undefined) {
        return;
      }

      state.ruleModal = { type: "card-rule", cardId, pageIndex: 0 };
      render();
    });
  });

  document.querySelector("#close-rule-modal-button")?.addEventListener("click", () => {
    state.ruleModal = null;
    render();
  });

  document.querySelector("#rule-back-button")?.addEventListener("click", () => {
    if (state.ruleModal?.type === "card-rule") {
      state.ruleModal = { type: "card-list" };
    } else {
      state.ruleModal = { type: "home" };
    }
    render();
  });

  document.querySelector("#rule-prev-button")?.addEventListener("click", () => {
    moveRulePage(-1);
  });

  document.querySelector("#rule-next-button")?.addEventListener("click", () => {
    moveRulePage(1);
  });

  document.querySelector("#rule-prev-card-button")?.addEventListener("click", () => {
    moveRuleCard(-1);
  });

  document.querySelector("#rule-next-card-button")?.addEventListener("click", () => {
    moveRuleCard(1);
  });
}

function openRuleEntry(entryId: RuleEntryId): void {
  const disabledReason = getRuleEntryDisabledReason(entryId, state.ruleModal === null ? "lobby" : "modal");
  if (disabledReason !== null) {
    showToast(disabledReason, "warning");
    return;
  }

  if (entryId === "cards") {
    state.ruleModal = { type: "card-list" };
    render();
    return;
  }

  state.ruleModal = { type: "image-group", groupId: entryId, pageIndex: 0 };
  render();
}

function moveRulePage(delta: -1 | 1): void {
  const view = state.ruleModal;
  if (view === null || (view.type !== "image-group" && view.type !== "card-rule")) {
    return;
  }

  const images =
    view.type === "image-group"
      ? getRuleImageGroup(view.groupId)?.images
      : getRuleCardIntro(view.cardId)?.ruleImages;

  if (images === undefined || images.length === 0) {
    return;
  }

  const nextPageIndex = Math.min(
    Math.max(view.pageIndex + delta, 0),
    images.length - 1
  );

  if (nextPageIndex === view.pageIndex) {
    return;
  }

  state.ruleModal = { ...view, pageIndex: nextPageIndex };
  render();
}

function moveRuleCard(direction: -1 | 1): void {
  const view = state.ruleModal;
  if (view === null || view.type !== "card-rule") {
    return;
  }

  const nextCardId = getAdjacentRuleCardId(view.cardId, direction);
  if (nextCardId === null) {
    return;
  }

  state.ruleModal = { type: "card-rule", cardId: nextCardId, pageIndex: 0 };
  render();
}

function sendCommand(command: ClientCommandInput): void {
  if (state.roomId === null || state.playerId === null) {
    return;
  }

  sendSafely(
    buildCommandMessage({
      roomId: state.roomId,
      playerId: state.playerId,
      command
    })
  );
}

function maybeReconnect(): void {
  if (state.roomId === null) {
    return;
  }

  sendSafely(
    buildReconnectMessage({
      roomId: state.roomId,
      userId: state.userId
    })
  );
}

function playSelectedSingleCard(): void {
  if (state.snapshot === null) {
    return;
  }

  const selectedCards = getSelectedCards(state.snapshot.self.hand, state.selectedCardIds);

  if (selectedCards.length !== 1) {
    state.lastError = "请先只选择一张牌。";
    pushLog(state.lastError);
    render();
    return;
  }

  const card = selectedCards[0];

  if (card === undefined) {
    return;
  }

  if (card.isBlack) {
    state.colorPickerCardId = card.id;
    render();
    return;
  }

  sendCommand({
    type: "play-card",
    cardId: card.id
  });
}

function playSelectedBlackCard(declaredColor: CardColor): void {
  if (state.colorPickerCardId === null) {
    return;
  }

  sendCommand({
    type: "play-card",
    cardId: state.colorPickerCardId,
    declaredColor
  });

  state.colorPickerCardId = null;
  render();
}

function playSelectedSequence(): void {
  if (state.snapshot === null) {
    return;
  }

  const selectedCards = getSelectedCards(state.snapshot.self.hand, state.selectedCardIds);

  if (!isValidSequenceSelection(selectedCards)) {
    state.lastError = "顺子至少需要 5 张数字牌。";
    pushLog(state.lastError);
    render();
    return;
  }

  sendCommand({
    type: "play-sequence",
    cardIds: selectedCards.map((card) => card.id)
  });
}

function playSelectedMultipleNumber(): void {
  if (state.snapshot === null) {
    return;
  }

  const selectedCards = getSelectedCards(state.snapshot.self.hand, state.selectedCardIds);

  if (!canPlayMultipleNumberSelection(selectedCards)) {
    state.lastError = "连对需要至少 2 张同色同数的数字牌。";
    pushLog(state.lastError);
    render();
    return;
  }

  sendCommand({
    type: "play-multiple-number",
    cardIds: selectedCards.map((card) => card.id)
  });
}

function playSelectedDiscardSameColor(): void {
  if (state.snapshot === null) {
    return;
  }

  const selectedCards = getSelectedCards(state.snapshot.self.hand, state.selectedCardIds);
  const payload = buildDiscardSameColorPayload(selectedCards);

  if (payload === null) {
    state.lastError = "同色丢弃需要先选中一张同色丢弃主牌。";
    pushLog(state.lastError);
    render();
    return;
  }

  sendCommand({
    type: "play-discard-same-color",
    ...payload
  });
}

function playSelectedCards(): void {
  if (state.snapshot === null) {
    return;
  }

  const selectedCards = getSelectedCards(state.snapshot.self.hand, state.selectedCardIds);
  const preview = getPlaySelectionPreview(state.snapshot, selectedCards, true);
  const discardSameColorPreview = getDiscardSameColorPlayPreview(state.snapshot, selectedCards);

  if (!preview.canPlay) {
    state.lastError = preview.message;
    pushLog(state.lastError);
    render();
    return;
  }

  if (discardSameColorPreview?.canPlay && discardSameColorPreview.payload !== null) {
    sendCommand({
      type: "play-discard-same-color",
      ...discardSameColorPreview.payload
    });
    return;
  }

  if (selectedCards.length === 1) {
    const [card] = selectedCards;

    if (card === undefined) {
      return;
    }

    if (card.isBlack) {
      state.colorPickerCardId = card.id;
      render();
      return;
    }

    sendCommand({
      type: "play-card",
      cardId: card.id
    });
    return;
  }

  if (isValidSequenceSelection(selectedCards) && canSequenceConnectCurrentCard(selectedCards, state.snapshot)) {
    sendCommand({
      type: "play-sequence",
      cardIds: selectedCards.map((card) => card.id)
    });
    return;
  }

  if (canPlayMultipleNumberSelection(selectedCards) && canMultipleConnectCurrentCard(selectedCards, state.snapshot)) {
    sendCommand({
      type: "play-multiple-number",
      cardIds: selectedCards.map((card) => card.id)
    });
    return;
  }

  state.lastError = preview.message;
  pushLog(state.lastError);
  render();
}

function sendSafely(message: Parameters<WsClient["send"]>[0]): void {
  try {
    wsClient.send(message);
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "发送失败";
    pushLog(state.lastError);
    render();
  }
}

function pushLog(line: string): void {
  state.log = [`${new Date().toLocaleTimeString()} ${line}`, ...state.log].slice(0, 12);
}

function showToast(message: string, tone: UiToastState["tone"] = "info"): void {
  const key = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  state.uiToast = { key, message, tone };

  window.setTimeout(() => {
    if (state.uiToast?.key === key) {
      state.uiToast = null;
      render();
    }
  }, 2600);
}

async function copyTextToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopyText(text);
    }

    showToast(`已复制房间号 ${text}`, "success");
    pushLog(`已复制房间号 ${text}`);
    render();
  } catch {
    fallbackCopyText(text);
    showToast(`已复制房间号 ${text}`, "success");
    pushLog(`已复制房间号 ${text}`);
    render();
  }
}

function fallbackCopyText(text: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function toggleSelectedCard(cardId: string): void {
  const index = state.selectedCardIds.indexOf(cardId);

  if (index === -1) {
    state.selectedCardIds = [...state.selectedCardIds, cardId];
    setHandCardMotion(cardId, "select");
  } else {
    state.selectedCardIds = [
      ...state.selectedCardIds.slice(0, index),
      ...state.selectedCardIds.slice(index + 1)
    ];
    setHandCardMotion(cardId, "deselect");
  }
}

function setHandCardMotion(cardId: string, motion: "select" | "deselect"): void {
  state.handCardMotion = {
    ...state.handCardMotion,
    [cardId]: motion
  };

  window.setTimeout(() => {
    if (state.handCardMotion[cardId] !== motion) {
      return;
    }

    const remainingMotion = { ...state.handCardMotion };
    delete remainingMotion[cardId];
    state.handCardMotion = remainingMotion;
    render();
  }, 190);
}

function syncHandOverlapLayout(): void {
  const cards = document.querySelector<HTMLElement>(".battle-action-dock .cards");

  if (cards === null) {
    return;
  }

  const cardButtons = [...cards.querySelectorAll<HTMLElement>(".card-button")];

  if (cardButtons.length === 0) {
    cards.classList.remove("cards-overlap");
    cards.style.removeProperty("--hand-overlap-height");
    return;
  }

  for (const cardButton of cardButtons) {
    cardButton.style.removeProperty("left");
    cardButton.style.removeProperty("z-index");
  }

  const containerWidth = cards.clientWidth;
  const firstCard = cardButtons[0]!;
  const cardWidth = firstCard.getBoundingClientRect().width;
  const normalGap = 8;
  const normalWidth = cardWidth * cardButtons.length + normalGap * (cardButtons.length - 1);

  if (normalWidth <= containerWidth || cardButtons.length <= 1) {
    cards.classList.remove("cards-overlap");
    cards.style.removeProperty("--hand-overlap-height");
    return;
  }

  const step = Math.max(18, (containerWidth - cardWidth) / (cardButtons.length - 1));
  const cardHeight = firstCard.getBoundingClientRect().height;

  cards.classList.add("cards-overlap");
  cards.style.setProperty("--hand-overlap-height", `${String(Math.ceil(cardHeight + 26))}px`);

  cardButtons.forEach((cardButton, index) => {
    cardButton.style.left = `${String(Math.max(0, step * index))}px`;
    cardButton.style.zIndex = String(index + 1);
  });
}

function bindRoomCodeInputs(): void {
  document.querySelectorAll<HTMLInputElement>("[data-room-code-index]").forEach((input) => {
    input.addEventListener("beforeinput", (event) => {
      if (event.data !== null && /\D/.test(event.data)) {
        event.preventDefault();
        showRoomCodeInputError("请输入数字。");
        render();
      }
    });

    input.addEventListener("input", () => {
      const index = Number(input.dataset.roomCodeIndex ?? "0");
      const rawValue = input.value;

      if (/\D/.test(rawValue)) {
        showRoomCodeInputError("请输入数字。");
      }

      const digit = rawValue.replace(/\D/g, "").slice(-1);
      state.roomCodeDigits[index] = digit;
      input.value = digit;

      if (digit !== "" && index < 5) {
        document
          .querySelector<HTMLInputElement>(`[data-room-code-index="${String(index + 1)}"]`)
          ?.focus();
      }
    });

    input.addEventListener("keydown", (event) => {
      const index = Number(input.dataset.roomCodeIndex ?? "0");

      if (event.key === "Backspace" && input.value === "" && index > 0) {
        state.roomCodeDigits[index - 1] = "";
        document
          .querySelector<HTMLInputElement>(`[data-room-code-index="${String(index - 1)}"]`)
          ?.focus();
        render();
      }
    });

    input.addEventListener("paste", (event) => {
      const text = event.clipboardData?.getData("text") ?? "";

      event.preventDefault();

      if (/\D/.test(text)) {
        showRoomCodeInputError("请输入数字。");
      }

      setRoomCodeFromText(text);
      render();
    });
  });
}

function translateUnoReportFailedMessage(fallbackMessage: string): string {
  if (fallbackMessage.includes("called UNO")) {
    return "对方已经喊过 UNO，不能抓。";
  }

  if (fallbackMessage.includes("not currently punishable")) {
    return "目标玩家当前不能被抓 UNO。";
  }

  return "抓 UNO 失败。";
}

function handleHandCardClick(cardId: string): void {
  if (state.snapshot === null) {
    return;
  }

  const hand = state.snapshot.self.hand;
  const card = hand.find((candidate) => candidate.id === cardId);

  if (card === undefined) {
    return;
  }

  const selectedCards = getSelectedCards(hand, state.selectedCardIds);
  const canTakeTurnAction =
    state.connectionStatus === "open" &&
    state.playerId === state.snapshot.currentPlayerId &&
    state.snapshot.status !== "finished" &&
    !state.snapshot.self.isEliminated &&
    !state.snapshot.self.isRoundWinner;
  const sequenceCandidateCardIds = getSequenceCandidateCardIds(hand, {
    currentColor: state.snapshot.currentColor,
    topCard: state.snapshot.topCard
  });
  const info = getHandCardPresentation(
    card,
    state.snapshot,
    canTakeTurnAction,
    selectedCards,
    sequenceCandidateCardIds
  );

  if (info.relationState === "selected") {
    toggleSelectedCard(cardId);
    render();
    return;
  }

  if (!info.canSelect) {
    showToast(info.reason, "warning");
    pushLog(info.reason);
    render();
    return;
  }

  toggleSelectedCard(cardId);
  render();
}

function clearSelectedCards(): void {
  for (const cardId of state.selectedCardIds) {
    setHandCardMotion(cardId, "deselect");
  }

  state.selectedCardIds = [];
  state.colorPickerCardId = null;
}

function resetRoomContext(): void {
  if (unoProtectionRenderTimer !== null) {
    window.clearTimeout(unoProtectionRenderTimer);
    unoProtectionRenderTimer = null;
  }

  state.room = null;
  state.snapshot = null;
  state.roomId = null;
  state.playerId = null;
  state.uiToast = null;
  state.snapshotRecoveryRoomId = null;
  state.recentDrawnCardIds = [];
  state.handCardMotion = {};
  state.latestCardsPlayedEvent = null;
  state.latestPlayGroupEvent = null;
  state.latestPlayGroupAnimationKey = null;
  state.flyingCard = null;
  state.drawFlyingCard = null;
  state.drawStackBurst = null;
  state.eventModal = null;
  state.ruleModal = null;
  state.dismissedFinishedNoticeKey = null;
  clearSelectedCards();
  removeSessionStoredValue(LAST_ROOM_STORAGE_KEY);
}

function normalizePlayerGameSnapshot(snapshot: unknown): PlayerGameSnapshot {
  const partial = snapshot as Partial<PlayerGameSnapshot>;
  const self = partial.self ?? ({} as Partial<PlayerGameSnapshot["self"]>);

  return {
    ...partial,
    discardPile: Array.isArray(partial.discardPile) ? partial.discardPile : [],
    drawStack: {
      active: false,
      amount: 0,
      previousDrawValue: null,
      previousDrawKind: null,
      targetPlayerId: null,
      ...partial.drawStack
    },
    drawUntilColor: {
      active: false,
      color: null,
      targetPlayerId: null,
      ...partial.drawUntilColor
    },
    normalDrawOffer: {
      active: false,
      playerId: null,
      cardId: null,
      ...partial.normalDrawOffer
    },
    challengeWindow: {
      active: false,
      targetPlayerId: null,
      ...partial.challengeWindow
    },
    winnerPlayerIds: Array.isArray(partial.winnerPlayerIds)
      ? partial.winnerPlayerIds
      : [],
    opponents: Array.isArray(partial.opponents)
      ? partial.opponents.map((player) => normalizeSnapshotPublicPlayer(player))
      : [],
    self: {
      ...self,
      hand: Array.isArray(self.hand) ? self.hand : [],
      handCount:
        typeof self.handCount === "number"
          ? self.handCount
          : Array.isArray(self.hand)
            ? self.hand.length
            : 0,
      hasCalledUno: self.hasCalledUno ?? false,
      unoPendingSinceMs: self.unoPendingSinceMs ?? null,
      unoProtectionStartedAtMs: self.unoProtectionStartedAtMs ?? null,
      unoProtectionEndsAtMs: self.unoProtectionEndsAtMs ?? null,
      isEliminated: self.isEliminated ?? false,
      isRoundWinner: self.isRoundWinner ?? false,
      hasLeftRoom: self.hasLeftRoom ?? false,
      isCurrentPlayer: self.isCurrentPlayer ?? false,
      isBot: self.isBot ?? false
    }
  } as PlayerGameSnapshot;
}

function normalizeSnapshotPublicPlayer(
  player: PlayerGameSnapshot["opponents"][number]
): PlayerGameSnapshot["opponents"][number] {
  return {
    ...player,
    handCount: typeof player.handCount === "number" ? player.handCount : 0,
    hasCalledUno: player.hasCalledUno ?? false,
    unoPendingSinceMs: player.unoPendingSinceMs ?? null,
    unoProtectionStartedAtMs: player.unoProtectionStartedAtMs ?? null,
    unoProtectionEndsAtMs: player.unoProtectionEndsAtMs ?? null,
    isEliminated: player.isEliminated ?? false,
    isRoundWinner: player.isRoundWinner ?? false,
    hasLeftRoom: player.hasLeftRoom ?? false,
    isCurrentPlayer: player.isCurrentPlayer ?? false,
    isBot: player.isBot ?? false
  };
}

function recoverMissingPlayingSnapshot(room: PlayerRoomSnapshot): void {
  if (
    room.status !== "playing" ||
    state.snapshot !== null ||
    state.connectionStatus !== "open" ||
    state.snapshotRecoveryRoomId === room.roomId
  ) {
    return;
  }

  state.snapshotRecoveryRoomId = room.roomId;
  sendSafely(
    buildReconnectMessage({
      roomId: room.roomId,
      userId: state.userId
    })
  );
  pushLog("房间已开始，正在同步对局快照");
}

function readInputValue(selector: string): string {
  return document.querySelector<HTMLInputElement>(selector)?.value ?? "";
}

function readSelectValue(selector: string, fallback: string): string {
  return document.querySelector<HTMLSelectElement>(selector)?.value ?? fallback;
}

function getOrCreateUserId(): string {
  const stored = getSessionStoredValue(USER_ID_STORAGE_KEY);

  if (stored !== null && shouldReuseStoredSession) {
    return stored;
  }

  const userId = createUserId();
  setSessionStoredValue(USER_ID_STORAGE_KEY, userId);
  return userId;
}

function getOrCreateNickname(): string {
  const stored = getSessionStoredValue(USER_NICKNAME_STORAGE_KEY);

  if (stored !== null && stored.trim() !== "" && shouldReuseStoredSession) {
    return stored.trim();
  }

  const nickname = createRandomNickname();
  setSessionStoredValue(USER_NICKNAME_STORAGE_KEY, nickname);
  return nickname;
}

function getStoredValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

function removeStoredValue(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

function readStoredRoomId(): RoomId | null {
  if (!shouldReuseStoredSession) {
    return null;
  }

  const value = getSessionStoredValue(LAST_ROOM_STORAGE_KEY);
  return value === null || value.trim() === "" ? null : value;
}

function resetClonedSessionIdentity(): void {
  removeSessionStoredValue(LAST_ROOM_STORAGE_KEY);
  removeSessionStoredValue(USER_ID_STORAGE_KEY);
  removeSessionStoredValue(USER_NICKNAME_STORAGE_KEY);
}

function shouldReuseStoredSessionIdentity(): boolean {
  const navigationType = getNavigationType();

  return (
    navigationType === null ||
    navigationType === "reload" ||
    navigationType === "back_forward"
  );
}

function getNavigationType(): PerformanceNavigationTiming["type"] | null {
  try {
    const [navigationEntry] = performance.getEntriesByType("navigation");

    if (
      navigationEntry !== undefined &&
      "type" in navigationEntry &&
      typeof navigationEntry.type === "string"
    ) {
      return navigationEntry.type as PerformanceNavigationTiming["type"];
    }
  } catch {
    return null;
  }

  return null;
}

function getSessionStoredValue(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSessionStoredValue(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

function removeSessionStoredValue(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

function ensureNicknameValue(value: string): string {
  const trimmed = value.trim();
  return trimmed.length === 0 ? createRandomNickname() : trimmed;
}

function createRandomNickname(): string {
  return `玩家${createRandomFourDigitNumber()}`;
}

function createRandomFourDigitNumber(): string {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi !== undefined && typeof cryptoApi.getRandomValues === "function") {
    const buffer = new Uint32Array(1);
    cryptoApi.getRandomValues(buffer);
    return String(buffer[0]! % 10_000).padStart(4, "0");
  }

  return String(Math.floor(Math.random() * 10_000)).padStart(4, "0");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}





