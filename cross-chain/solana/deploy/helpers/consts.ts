import { WRAPPED_TBTC_MINT } from "./../../tests/helpers/consts"
export const WH_ARBITRUM_CHAIN_ID = 23

export const WH_OPTIMISM_CHAIN_ID = 24

export const WH_POLYGON_CHAIN_ID = 5

export const WH_BASE_CHAIN_ID = 30

export const WH_SOLANA_CHAIN_ID = 1

// EVM addresses converted to 32 bytes. 0x is trimmed intentionally as the input
// param requires it without leading 0x.

export const ARBITRUM_GATEWAY_ADDRESS_TESTNET =
  "00000000000000000000000031a15e213b59e230b45e8c5c99dafac3d1236ee2"

export const ARBITRUM_GATEWAY_ADDRESS_MAINNET =
  "0000000000000000000000001293a54e160d1cd7075487898d65266081a15458"

export const OPTIMISM_GATEWAY_ADDRESS_TESTNET =
  "0000000000000000000000006449F4381f3d63bDfb36B3bDc375724aD3cD4621"
export const OPTIMISM_GATEWAY_ADDRESS_MAINNET =
  "0000000000000000000000001293a54e160D1cd7075487898d65266081A15458"

export const POLYGON_GATEWAY_ADDRESS_TESTNET =
  "00000000000000000000000091Fe7128f74dBd4F031ea3D90FC5Ea4DCfD81818"
export const POLYGON_GATEWAY_ADDRESS_MAINNET =
  "00000000000000000000000009959798B95d00a3183d20FaC298E4594E599eab"

export const BASE_GATEWAY_ADDRESS_TESTNET =
  "000000000000000000000000e3e0511EEbD87F08FbaE4486419cb5dFB06e1343"
export const BASE_GATEWAY_ADDRESS_MAINNET =
  "00000000000000000000000009959798B95d00a3183d20FaC298E4594E599eab"

// deriveWrappedMintKey("DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe", 2, "0x679874fbe6d4e7cc54a59e315ff1eb266686a937")
export const WRAPPED_TBTC_MINT_TESTNET =
  "FMYvcyMJJ22whB9m3T5g1oPKwM6jpLnFBXnrY6eXmCrp"
// deriveWrappedMintKey("wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb", 2, "0x18084fbA666a33d37592fA2633fD49a74DD93a88")
export const WRAPPED_TBTC_MINT_MAINNET =
  "25rXTx9zDZcHyTav5sRqM6YBvTGu9pPH9yv83uAEqbgG"

export const SOLANA_GATEWAY_ADDRESS_TESTNET =
  "Gj93RRt6QB7FjmyokAD5rcMAku7pq3Fk2Aa8y6nNbwsV"
// export const SOLANA_GATEWAY_ADDRESS_MAINNET = "tbd"
