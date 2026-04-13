/**
 * Minimal ABI for {@link LandLedger} matching `contracts/LandLedger.sol`.
 */
export const LAND_LEDGER_ABI = [
  "function appendRecord(string jsonPayload) external",
  "function recordCount() view returns (uint256)",
  "function getRecord(uint256 index) view returns (address,uint256,string)",
  "event RecordAppended(uint256 indexed index, address indexed author, uint256 timestamp, string jsonPayload)",
] as const;
