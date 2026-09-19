import { requireProtocolRole } from './requireProtocolRole'

function expectReject(
  actualRole: unknown,
  expectedMessage: string,
) {
  let caught: unknown = null

  try {
    requireProtocolRole(actualRole, 'alice', 'fund BLAKE')
  } catch (error) {
    caught = error
  }

  if (!(caught instanceof Error)) {
    throw new Error(
      `expected protocol-role rejection for ${String(actualRole)}`,
    )
  }

  if (caught.message !== expectedMessage) {
    throw new Error(
      `unexpected role rejection: ${caught.message}`,
    )
  }
}

function main() {
  requireProtocolRole('alice', 'alice', 'fund BLAKE')

  expectReject(
    'bob',
    'Cannot fund BLAKE: local participant is protocol bob, not Alice.',
  )

  expectReject(
    undefined,
    'Cannot fund BLAKE: local participant is protocol unknown, not Alice.',
  )

  expectReject(
    'mallory',
    'Cannot fund BLAKE: local participant is protocol mallory, not Alice.',
  )

  console.log('PASS protocol role guard')
}

main()
