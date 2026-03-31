// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentRegistry
 * @notice ERC-8004 Agent Identity Standard implementation.
 *         Stores agent capabilities, version, operator, and ENS name on-chain.
 *         Linked to ENS text records for human-readable discovery.
 */
contract AgentRegistry {
    // ─── Structs ──────────────────────────────────────────────────────────────

    struct AgentIdentity {
        string name;
        string version;
        string ensName;
        address operator;
        string[] capabilities;
        bool selfVerified;
        uint256 registeredAt;
        uint256 updatedAt;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    mapping(address => AgentIdentity) public agents;
    address[] public agentList;

    // ─── Events ───────────────────────────────────────────────────────────────

    event AgentRegistered(address indexed agent, string name, string ensName);
    event AgentUpdated(address indexed agent);
    event SelfVerificationSet(address indexed agent, bool verified);

    // ─── ERC-8004 Interface ───────────────────────────────────────────────────

    function register(
        string calldata name,
        string calldata version,
        string calldata ensName,
        string[] calldata capabilities
    ) external {
        require(agents[msg.sender].registeredAt == 0, "Already registered");

        agents[msg.sender] = AgentIdentity({
            name: name,
            version: version,
            ensName: ensName,
            operator: msg.sender,
            capabilities: capabilities,
            selfVerified: false,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp
        });

        agentList.push(msg.sender);
        emit AgentRegistered(msg.sender, name, ensName);
    }

    function updateCapabilities(string[] calldata capabilities) external {
        require(agents[msg.sender].registeredAt != 0, "Not registered");
        agents[msg.sender].capabilities = capabilities;
        agents[msg.sender].updatedAt = block.timestamp;
        emit AgentUpdated(msg.sender);
    }

    function setSelfVerified(address agent, bool verified) external {
        // In production: only callable by the Self Protocol verifier contract
        agents[agent].selfVerified = verified;
        emit SelfVerificationSet(agent, verified);
    }

    function getCapabilities(address agent) external view returns (string[] memory) {
        return agents[agent].capabilities;
    }

    function totalAgents() external view returns (uint256) {
        return agentList.length;
    }
}
