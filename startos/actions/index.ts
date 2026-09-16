import { sdk } from '../sdk'
import { verifyEngine } from './verifyEngine'
import { createPersistenceMarker } from './createPersistenceMarker'
import { verifyPersistenceMarker } from './verifyPersistenceMarker'

import { checkBlakeRpc } from './checkBlakeRpc'
import { checkBtcRpc } from './checkBtcRpc'
import { configureBtcProvider } from './configureBtcProvider'
import { configureNostrRelays } from './configureNostrRelays'
import { configureWallets } from './configureWallets'
import { checkWalletReadiness } from './checkWalletReadiness'
import { checkEconomicReadiness } from './checkEconomicReadiness'
import { fundBlake } from './fundBlake'
import { resumeSwap } from './resumeSwap'
import { viewMarket } from './viewMarket'
import { showParticipantIdentity } from './showParticipantIdentity'
import {
  getBlakeDepositAddress,
  getBtcDepositAddress,
} from './depositAddresses'
import { createOffer } from './createOffer'
import { cancelOffer } from './cancelOffer'
import { takeOffer } from './takeOffer'
import { acceptMatch } from './acceptMatch'

export const actions = sdk.Actions.of()
  .addAction(verifyEngine)
  .addAction(createPersistenceMarker)
  .addAction(verifyPersistenceMarker)
  .addAction(checkBlakeRpc)
  .addAction(configureBtcProvider)
  .addAction(configureNostrRelays)
  .addAction(configureWallets)
  .addAction(checkWalletReadiness)
  .addAction(checkEconomicReadiness)
  .addAction(viewMarket)
  .addAction(showParticipantIdentity)
  .addAction(getBlakeDepositAddress)
  .addAction(getBtcDepositAddress)
  .addAction(createOffer)
  .addAction(cancelOffer)
  .addAction(takeOffer)
  .addAction(acceptMatch)
  .addAction(fundBlake)
  .addAction(resumeSwap)
  .addAction(checkBtcRpc)
