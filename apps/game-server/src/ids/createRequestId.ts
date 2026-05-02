let requestIdCounter = 0;

/** 给测试和未来 message handler 预留的 requestId 生成器。 */
export function createRequestId(): string {
  requestIdCounter += 1;
  return `req-${String(requestIdCounter).padStart(6, "0")}`;
}
