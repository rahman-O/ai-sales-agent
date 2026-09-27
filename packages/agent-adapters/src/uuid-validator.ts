const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

export function invalidUuidArg(toolName: string, field: string, received: unknown) {
  return {
    ok: false as const,
    code: 'TOOL_INVALID_ARGS',
    data: {
      toolName,
      field,
      reason: 'invalid_uuid_format',
      expectedType: 'uuid',
      received: typeof received === 'string' ? received.slice(0, 64) : typeof received,
    },
    safeMessage: `Invalid ${field} format (expected canonical UUID)`,
  };
}
