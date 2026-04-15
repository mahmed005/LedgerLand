import { ethers, Contract, JsonRpcProvider } from "ethers";
import fs from "fs";
import path from "path";

// ABI subset — only the functions we call
const ABI = [
  "function addRecord(string calldata jsonPayload) external returns (uint256 index)",
  "function getRecord(uint256 index) external view returns (address author, uint256 timestamp, string payload)",
  "function recordCount() external view returns (uint256)",
];

let provider: JsonRpcProvider;
let signer: ethers.Wallet;
let contract: Contract;

/**
 * Initialise the ethers provider, signer, and contract instance.
 * Called once at startup from index.ts.
 */
export function init(rpcUrl: string, contractAddress: string, privateKey: string) {
  provider = new JsonRpcProvider(rpcUrl);
  signer = new ethers.Wallet(privateKey, provider);
  contract = new Contract(contractAddress, ABI, signer);
}

/**
 * Lazy-load the contract address from deployments/localhost.json
 * when LEDGER_CONTRACT_ADDRESS is not set explicitly.
 */
export function loadContractAddress(): string | null {
  const envAddr = process.env.LEDGER_CONTRACT_ADDRESS;
  if (envAddr) return envAddr;

  const deployFile = path.resolve("deployments", "localhost.json");
  if (fs.existsSync(deployFile)) {
    const data = JSON.parse(fs.readFileSync(deployFile, "utf-8"));
    return data.address ?? null;
  }
  return null;
}

/**
 * Append a JSON payload to the on-chain ledger.
 * @returns `{ transactionHash, recordIndex }`
 */
export async function addRecord(payload: object) {
  const jsonStr = JSON.stringify(payload);
  const tx = await contract.addRecord(jsonStr);
  const receipt = await tx.wait();

  // Parse the RecordAdded event to get the index
  const iface = new ethers.Interface(ABI);
  let recordIndex = 0;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "RecordAdded") {
        recordIndex = Number(parsed.args[0]);
      }
    } catch {
      // Skip logs from other contracts
    }
  }

  return { transactionHash: receipt.hash, recordIndex };
}

/**
 * Read all records from the on-chain ledger.
 */
export async function getRecords() {
  const count = Number(await contract.recordCount());
  const blocks: Array<{
    index: number;
    author: string;
    timestamp: number;
    payload: unknown;
  }> = [];

  for (let i = 0; i < count; i++) {
    const [author, timestamp, payloadStr] = await contract.getRecord(i);
    let payload: unknown;
    try {
      payload = JSON.parse(payloadStr);
    } catch {
      payload = payloadStr;
    }
    blocks.push({
      index: i,
      author,
      timestamp: Number(timestamp),
      payload,
    });
  }

  return blocks;
}

/**
 * Get an operational summary of the blockchain connection.
 */
export async function getSummary() {
  try {
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);
    const network = await provider.getNetwork();
    const count = Number(await contract.recordCount());

    return {
      valid: true,
      rpcOk: true,
      blockCount: count,
      tip: {
        hash: block?.hash ?? "unknown",
        chainId: network.chainId.toString(),
      },
      contractAddress: await contract.getAddress(),
    };
  } catch (err) {
    return {
      valid: false,
      rpcOk: false,
      blockCount: 0,
      tip: { hash: "unknown", chainId: "unknown" },
      contractAddress: "unknown",
      error: (err as Error).message,
    };
  }
}
