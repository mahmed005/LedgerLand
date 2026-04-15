import hardhatPkg from "hardhat";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ethers } = hardhatPkg as any;
import fs from "fs";
import path from "path";

async function main() {
  const LandLedger = await ethers.getContractFactory("LandLedger");
  const ledger = await LandLedger.deploy();
  await ledger.waitForDeployment();

  const address = await ledger.getAddress();
  console.log(`LandLedger deployed to: ${address}`);

  // Persist address for the backend to read
  const deploymentsDir = path.resolve(process.cwd(), "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deploymentsDir, "localhost.json"),
    JSON.stringify({ address }, null, 2) + "\n"
  );
  console.log(`Address written to deployments/localhost.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
