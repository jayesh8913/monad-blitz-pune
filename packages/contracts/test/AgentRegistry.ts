import { expect } from "chai";
import { ethers } from "hardhat";

describe("AgentRegistry (ERC-8004)", function () {
  async function deployAgentRegistryFixture() {
    const [owner, otherAccount] = await ethers.getSigners();
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const registry = await AgentRegistry.deploy();
    return { registry, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      const { registry } = await deployAgentRegistryFixture();
      expect(await registry.name()).to.equal("ERC-8004 Agent Identity Registry");
      expect(await registry.symbol()).to.equal("ERC8004");
    });
  });

  describe("Registration", function () {
    it("Should allow a wallet to register once", async function () {
      const { registry, owner } = await deployAgentRegistryFixture();
      const metadataURI = "ipfs://QmAgentCardMetadata/1.json";

      await expect(registry.register(metadataURI))
        .to.emit(registry, "AgentRegistered")
        .withArgs(owner.address, 0, metadataURI);

      expect(await registry.isRegisteredAgent(owner.address)).to.be.true;
      expect(await registry.agentWalletToId(owner.address)).to.equal(0);
      expect(await registry.getAgentWallet(0)).to.equal(owner.address);
      expect(await registry.tokenURI(0)).to.equal(metadataURI);
    });

    it("Should fail if a wallet tries to register twice", async function () {
      const { registry } = await deployAgentRegistryFixture();
      await registry.register("uri1");
      await expect(registry.register("uri2")).to.be.revertedWith(
        "AgentRegistry: Wallet already registered as an agent"
      );
    });
  });

  describe("Updates", function () {
    it("Should allow the owner to update the Agent URI", async function () {
      const { registry, owner } = await deployAgentRegistryFixture();
      await registry.register("uri1");

      const newURI = "uri2";
      await expect(registry.setAgentURI(0, newURI))
        .to.emit(registry, "AgentURIUpdated")
        .withArgs(0, newURI);

      expect(await registry.tokenURI(0)).to.equal(newURI);
    });

    it("Should fail if a non-owner tries to update the Agent URI", async function () {
      const { registry, otherAccount } = await deployAgentRegistryFixture();
      await registry.register("uri1");

      await expect(
        registry.connect(otherAccount).setAgentURI(0, "uri2")
      ).to.be.revertedWith("AgentRegistry: Only the agent owner can update the URI");
    });
  });
});
