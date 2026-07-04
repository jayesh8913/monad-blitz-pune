import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);

  console.log("Deploying MockETH ERC20 token to Monad Testnet...");
  const mockETH = await ethers.deployContract("MockETH");
  await mockETH.waitForDeployment();
  const mockETHAddress = await mockETH.getAddress();
  console.log(`MockETH successfully deployed to: ${mockETHAddress}`);

  console.log("Deploying MockDEX to Monad Testnet...");
  const mockDEX = await ethers.deployContract("MockDEX", [mockETHAddress], {
    value: ethers.parseEther("1.0") 
  });
  await mockDEX.waitForDeployment();
  const mockDEXAddress = await mockDEX.getAddress();
  console.log(`MockDEX successfully deployed to: ${mockDEXAddress}`);

  console.log("Deploying MockNFT ERC721 token to Monad Testnet...");
  const mockNFT = await ethers.deployContract("MockNFT");
  await mockNFT.waitForDeployment();
  const mockNFTAddress = await mockNFT.getAddress();
  console.log(`MockNFT successfully deployed to: ${mockNFTAddress}`);

  console.log("Funding MockDEX pool liquidity...");
  const mintTx = await mockETH.mintFaucet(ethers.parseEther("1000"));
  await mintTx.wait();
  
  const transferTx = await mockETH.transfer(mockDEXAddress, ethers.parseEther("1000"));
  await transferTx.wait();
  console.log("Sent 1000 MockETH to MockDEX for swap liquidity.");

  const sendMonTx = await deployer.sendTransaction({
    to: mockDEXAddress,
    value: ethers.parseEther("5.0")
  });
  await sendMonTx.wait();
  console.log("Sent 5.0 MON to MockDEX for native swap liquidity.");
  
  console.log("=================================================");
  console.log(`Deployment Completed!`);
  console.log(`MOCK_ETH_ADDRESS=${mockETHAddress}`);
  console.log(`MOCK_DEX_ADDRESS=${mockDEXAddress}`);
  console.log(`MOCK_NFT_ADDRESS=${mockNFTAddress}`);
  console.log("=================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
