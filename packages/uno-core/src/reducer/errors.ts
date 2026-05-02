import { ERROR_CODES, type ErrorCode } from "@thunder-uno/shared-types";
import type { GameState } from "../gameState";
import type { ApplyCommandResult, GameCommand } from "./types";

export { ERROR_CODES };
export type { ErrorCode };

/** 统一构造“命令被拒绝”的 reducer 返回值。 */
export function rejectCommand(
  state: GameState,
  command: GameCommand,
  code: ErrorCode,
  message: string
): ApplyCommandResult {
  return {
    state,
    events: [
      {
        type: "command-rejected",
        commandType: command.type,
        playerId: command.playerId,
        code,
        message
      }
    ]
  };
}
