export type ProtocolRole = 'alice' | 'bob'

export function requireProtocolRole(
  actualRole: unknown,
  expectedRole: ProtocolRole,
  action: string,
): void {
  if (actualRole !== expectedRole) {
    const observed =
      typeof actualRole === 'string' && actualRole !== ''
        ? actualRole
        : 'unknown'

    const expectedLabel =
      expectedRole === 'alice' ? 'Alice' : 'Bob'

    throw new Error(
      `Cannot ${action}: local participant is protocol ${observed}, not ${expectedLabel}.`,
    )
  }
}
