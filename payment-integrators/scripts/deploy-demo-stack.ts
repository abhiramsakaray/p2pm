import { ethers } from "hardhat";

/**
 * Self-contained DEMO stack on a public network (Base Sepolia):
 *   MockUSDC + MockDiamond + MerchantTerminalIntegrator + SimpleERC721Client.
 *
 * Use when official Diamond whitelisting is unavailable — we own the
 * MockDiamond, so the integrator is registered by us and order completion
 * is driven by the deployer (simulating the protocol's settlement).
 *
 *   npx hardhat run scripts/deploy-demo-stack.ts --network baseSepolia
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", await deployer.getAddress());

  console.log("1/6 MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.deploymentTransaction()?.wait(2);

  console.log("2/6 MockDiamond...");
  const MockDiamond = await ethers.getContractFactory("MockDiamond");
  const diamond = await MockDiamond.deploy(await usdc.getAddress());
  await diamond.deploymentTransaction()?.wait(2);

  console.log("3/6 MerchantTerminalIntegrator...");
  const Integrator = await ethers.getContractFactory("MerchantTerminalIntegrator");
  const integrator = await Integrator.deploy(await diamond.getAddress(), await usdc.getAddress());
  await integrator.deploymentTransaction()?.wait(2);

  console.log("4/6 SimpleERC721Client...");
  const Client = await ethers.getContractFactory("SimpleERC721Client");
  const client = await Client.deploy(
    await integrator.getAddress(),
    await usdc.getAddress(),
    "Merchant Terminal Item",
    "MTI"
  );
  await client.deploymentTransaction()?.wait(2);

  console.log("5/6 wiring (register integrator, price product, fund diamond)...");
  await (
    await diamond.registerIntegrator(await integrator.getAddress(), await integrator.proxyImpl())
  ).wait(2);
  await (await client.setProductPrice(2, 10_000)).wait(2); // 0.01 USDC/unit
  await (await usdc.mint(await diamond.getAddress(), ethers.parseUnits("100000", 6))).wait(2);

  console.log("6/6 done");
  const summary = {
    network: "baseSepolia (demo stack)",
    usdc: await usdc.getAddress(),
    diamond: await diamond.getAddress(),
    integrator: await integrator.getAddress(),
    proxyImpl: await integrator.proxyImpl(),
    client: await client.getAddress(),
    owner: await deployer.getAddress(),
  };
  console.log("");
  console.log("=== Demo Stack Summary ===");
  for (const [k, v] of Object.entries(summary)) console.log(`${k.padEnd(12)} ${v}`);
  console.log("");
  console.log("Verify commands:");
  console.log(`npx hardhat verify --network baseSepolia ${summary.usdc}`);
  console.log(`npx hardhat verify --network baseSepolia ${summary.diamond} ${summary.usdc}`);
  console.log(
    `npx hardhat verify --network baseSepolia ${summary.integrator} ${summary.diamond} ${summary.usdc}`
  );
  console.log(
    `npx hardhat verify --network baseSepolia ${summary.client} ${summary.integrator} ${summary.usdc} "Merchant Terminal Item" "MTI"`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
