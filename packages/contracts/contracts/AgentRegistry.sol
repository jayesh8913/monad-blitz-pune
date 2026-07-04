// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentRegistry
 * @dev Implementation of the ERC-8004 Identity Registry standard for trustless AI agents.
 */
contract AgentRegistry {
    string public name = "ERC-8004 Agent Identity Registry";
    string public symbol = "ERC8004";
    uint256 public nextAgentId;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => string) private _agentURIs;
    
    // Mapping from agent wallet address to registered Agent ID
    mapping(address => uint256) public agentWalletToId;
    mapping(address => bool) public isRegisteredAgent;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event AgentRegistered(address indexed agentWallet, uint256 indexed agentId, string agentURI);
    event AgentURIUpdated(uint256 indexed agentId, string newURI);

    /**
     * @dev Registers msg.sender as an AI Agent and mints a unique agent ID.
     * @param agentURI The metadata URI pointing to the agent's capabilities card.
     */
    function register(string calldata agentURI) external returns (uint256) {
        require(!isRegisteredAgent[msg.sender], "AgentRegistry: Wallet already registered as an agent");
        
        uint256 agentId = nextAgentId;
        nextAgentId++;

        _balances[msg.sender] = 1;
        _owners[agentId] = msg.sender;
        _agentURIs[agentId] = agentURI;
        
        agentWalletToId[msg.sender] = agentId;
        isRegisteredAgent[msg.sender] = true;

        emit Transfer(address(0), msg.sender, agentId);
        emit AgentRegistered(msg.sender, agentId, agentURI);

        return agentId;
    }

    /**
     * @dev Updates the metadata URI of an agent.
     * @param agentId The unique ID of the agent.
     * @param newURI The new metadata URI.
     */
    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(_owners[agentId] == msg.sender, "AgentRegistry: Only the agent owner can update the URI");
        _agentURIs[agentId] = newURI;
        emit AgentURIUpdated(agentId, newURI);
    }

    /**
     * @dev Returns the owner wallet address of a registered agent.
     */
    function getAgentWallet(uint256 agentId) external view returns (address) {
        address wallet = _owners[agentId];
        require(wallet != address(0), "AgentRegistry: Agent ID does not exist");
        return wallet;
    }

    /**
     * @dev Returns the metadata URI of a registered agent.
     */
    function tokenURI(uint256 agentId) external view returns (string memory) {
        require(_owners[agentId] != address(0), "AgentRegistry: Agent ID does not exist");
        return _agentURIs[agentId];
    }
}
