/// <reference types="jest" />
import { beforeAll, describe, expect, it } from "@jest/globals";
import type { Contract } from "ethers";
import { ethers } from "hardhat";
import { EthLedgerService } from "../src/ledger/ethLedgerService.js";

describe("EthLedgerService (Hardhat + Solidity LandLedger)", () => {
  let service: EthLedgerService;

  beforeAll(async () => {
    const factory = await ethers.getContractFactory("LandLedger");
    const ledger = await factory.deploy();
    await ledger.waitForDeployment();
    const address = await ledger.getAddress();
    service = new EthLedgerService(ledger as unknown as Contract, address, ethers.provider);
  });

  it("appends a JSON payload and lists it back", async () => {
    const result = await service.appendLedgerEntry({ hello: "world", n: 1 });
    expect(result.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    const rows = await service.listRecords();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const last = rows[rows.length - 1]!;
    const parsed = JSON.parse(last.jsonPayload) as { hello?: string };
    expect(parsed.hello).toBe("world");
  });

  it("getSummary reports rpcOk and record count", async () => {
    const summary = await service.getSummary();
    expect(summary.rpcOk).toBe(true);
    expect(summary.recordCount).toBeGreaterThanOrEqual(1);
    expect(summary.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});
