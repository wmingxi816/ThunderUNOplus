let connectionIdCounter = 0;

/** mock connection 使用递增 connectionId，方便测试时直接断言。 */
export function createConnectionId(): string {
  connectionIdCounter += 1;
  return `conn-${String(connectionIdCounter).padStart(6, "0")}`;
}
