import { sdk } from '../sdk'
import { verifyEngine } from './verifyEngine'
import { createPersistenceMarker } from './createPersistenceMarker'
import { verifyPersistenceMarker } from './verifyPersistenceMarker'

import { checkBlakeRpc } from './checkBlakeRpc'
import { checkBtcRpc } from './checkBtcRpc'
import { configureBtcProvider } from './configureBtcProvider'
import { configureWallets } from './configureWallets'
import { checkWalletReadiness } from './checkWalletReadiness'
import { checkEconomicReadiness } from './checkEconomicReadiness'
import { fundBlake } from './fundBlake'
import { viewMarket } from './viewMarket'
import { createOffer } from './createOffer'
import { cancelOffer } from './cancelOffer'

export const actions = sdk.Actions.of()
  .addAction(verifyEngine)
  .addAction(createPersistenceMarker)
  .addAction(verifyPersistenceMarker)
  .addAction(checkBlakeRpc)
  .addAction(configureBtcProvider)
  .addAction(configureWallets)
  .addAction(checkWalletReadiness)
  .addAction(checkEconomicReadiness)
  .addAction(viewMarket)
  .addAction(createOffer)
  .addAction(cancelOffer)
  .addAction(fundBlake)
  .addAction(checkBtcRpc)
