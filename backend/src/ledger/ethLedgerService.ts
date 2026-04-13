import {
  Contract,
  JsonRpcProvider,
  Wallet,
  type Provider,
  type TransactionReceipt,
} from "ethers";
import { LAND_LEDGER_ABI } from "./landLedgerAbi.js";

/**
 * One row returned from the Solidity `LandLedger` contract.
 */
export interface LedgerRecord {
  /** Zero-based index in the contract's `records` array. */
  index: number;
  /** Address that submitted the transaction (API relayer in this prototype). */
  author: string;
  /** Unix seconds from the block timestamp. */
  timestamp: number;
  /** Raw JSON string as stored on-chain. */
  jsonPayload: string;
}

export interface AppendLedgerResult {
  transactionHash: string;
  recordIndex: number;
  receipt: TransactionReceipt | null;
}

export interface LedgerSummary {
  /** Whether the JSON-RPC / provider responded successfully. */
  rpcOk: boolean;
  /** Number of records returned by `recordCount()`. */
  recordCount: number;
  /** Hash of the latest block from the provider. */
  latestBlockHash: string | null;
  /** Numeric chain id from the network. */
  chainId: bigint;
  /** Deployed `LandLedger` address. */
  contractAddress: string;
}

/**
 * Bridges the Express API to a deployed Solidity `LandLedger` using an ethers `Contract`.
 */
export class EthLedgerService {
  /**
   * @param contract - Bound `LandLedger` instance (with signer for writes).
   * @param contractAddress - Same address as `await contract.getAddress()` (cached for summaries).
   * @param provider - Network provider used for block metadata (Hardhat in-process or JSON-RPC).
   */
  constructor(
    private readonly contract: Contract,
    private readonly contractAddress: string,
    private readonly provider: Provider,
  ) {}

  /**
   * Writes a JSON envelope to the chain and waits for one confirmation.
   *
   * @param payload - Serializable object stored as a UTF-8 JSON string on-chain.
   */
  async appendLedgerEntry(payload: Record<string, unknown>): Promise<AppendLedgerResult> {
    const jsonPayload = JSON.stringify(payload);
    const tx = await this.contract.appendRecord(jsonPayload);
    const receipt = await tx.wait();
    const countBn = await this.contract.recordCount();
    const recordIndex = Number(countBn) - 1;
    return {
      transactionHash: receipt?.hash ?? tx.hash,
      recordIndex: Number.isFinite(recordIndex) ? recordIndex : 0,
      receipt: receipt ?? null,
    };
  }

  /**
   * Fetches high-level network and contract state for dashboards.
   */
  async getSummary(): Promise<LedgerSummary> {
    try {
      const network = await this.provider.getNetwork();
      const block = await this.provider.getBlock("latest");
      const countBn = await this.contract.recordCount();
      return {
        rpcOk: true,
        recordCount: Number(countBn),
        latestBlockHash: block?.hash ?? null,
        chainId: network.chainId,
        contractAddress: this.contractAddress,
      };
    } catch {
      return {
        rpcOk: false,
        recordCount: 0,
        latestBlockHash: null,
        chainId: 0n,
        contractAddress: this.contractAddress,
      };
    }
  }

  /**
   * Reads every on-chain record (fine for local dev; paginate for production).
   */
  async listRecords(): Promise<LedgerRecord[]> {
    const countBn = await this.contract.recordCount();
    const n = Number(countBn);
    const out: LedgerRecord[] = [];
    for (let i = 0; i < n; i++) {
      const row = await this.contract.getRecord(i);
      const author = row[0] as string;
      const ts = row[1] as bigint;
      const jsonPayload = row[2] as string;
      out.push({
        index: i,
        author,
        timestamp: Number(ts),
        jsonPayload,
      });
    }
    return out;
  }
}

/**
 * Builds {@link EthLedgerService} from JSON-RPC URL and relayer credentials.
 */
export function createEthLedgerFromEnv(
  rpcUrl: string,
  contractAddress: string,
  signerPrivateKey: string,
): EthLedgerService {
  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(signerPrivateKey, provider);
  const contract = new Contract(contractAddress, LAND_LEDGER_ABI, wallet);
  return new EthLedgerService(contract, contractAddress, provider);
}
