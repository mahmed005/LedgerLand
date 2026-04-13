const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const LandLedger = await hre.ethers.getContractFactory("LandLedger");
  const ledger = await LandLedger.deploy();
  await ledger.waitForDeployment();
  const address = await ledger.getAddress();

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const outPath = path.join(deploymentsDir, "localhost.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        address,
        network: hre.network.name,
        chainId: Number(hre.network.config.chainId ?? 31337),
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("LandLedger deployed to:", address);
  console.log("Wrote", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
