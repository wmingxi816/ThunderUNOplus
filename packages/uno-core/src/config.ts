/**
 * 暴露给 uno-core 使用方的公共配置。
 *
 * 未来 game-server 接入时，可以从这里统一读取：
 * - 房间人数限制
 * - 模式元数据
 * - 当前采用的规则与牌库文档来源
 */
import { TOTAL_DECK_CARD_COUNT } from "./cardConfig";

export {
  CARD_CONFIG_SOURCE,
  COLORED_ACTION_CARD_COUNTS,
  BLACK_CARD_COUNTS,
  TOTAL_NUMBER_CARD_COUNT,
  TOTAL_COLORED_ACTION_CARD_COUNT,
  TOTAL_BLACK_CARD_COUNT,
  TOTAL_DECK_CARD_COUNT
} from "./cardConfig";

export const ROOM_LIMITS = {
  minPlayers: 3,
  maxPlayers: 8,
  startingHandSize: 7,
  handEliminationLimit: 25
} as const;

// 说明当前规则实现来源于哪些外部文档。
export const RULE_SOURCE_OF_TRUTH = {
  rulesDocumentPath: "GAME-RULES.md",
  cardConfigDocumentPath: "CARD-CONFIG.md",
  phase: "Phase 2C"
} as const;

// UI 层和服务层可以直接用这里的标签，不必重复维护一份模式说明。
export const GAME_MODE_METADATA = {
  "with-challenge": {
    label: "有质疑模式",
    supportChallenge: true
  },
  "no-challenge": {
    label: "无质疑模式",
    supportChallenge: false
  }
} as const;

// 作为便捷常量暴露出去，方便开局逻辑和后续服务端启动逻辑使用。
export const DEFAULT_DECK_TOTAL = TOTAL_DECK_CARD_COUNT;
