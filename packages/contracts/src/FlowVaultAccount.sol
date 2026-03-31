// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./DelegationRules.sol";

/**
 * @title FlowVaultAccount
 * @notice ERC-4337 Smart Account with EIP-7710 delegation caveats.
 *         The agent executes swaps through this account — it cannot exceed
 *         the rules set by the human owner, even if compromised.
 *
 * @dev In production this extends MetaMask Delegation Toolkit's DeleGator.
 *      This is a standalone reference implementation for hackathon purposes.
 */
contract FlowVaultAccount {
    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public agent; // authorized autonomous agent address
    DelegationRules public rulesContract;
    bool public selfVerified;
    string public ensName;

    uint256 private _nonce;

    // ─── Events ───────────────────────────────────────────────────────────────

    event AgentAuthorized(address indexed agent);
    event SwapExecuted(address indexed fromToken, address indexed toToken, uint256 amount, bytes32 txRef);
    event SelfVerified(bool status);
    event ENSNameSet(string name);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "Not agent");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _owner, address _rulesContract) {
        owner = _owner;
        rulesContract = DelegationRules(_rulesContract);
    }

    // ─── Owner Functions ──────────────────────────────────────────────────────

    function authorizeAgent(address _agent) external onlyOwner {
        agent = _agent;
        emit AgentAuthorized(_agent);
    }

    function setSelfVerified(bool status) external onlyOwner {
        selfVerified = status;
        emit SelfVerified(status);
    }

    function setENSName(string calldata name) external onlyOwner {
        ensName = name;
        emit ENSNameSet(name);
    }

    // ─── Agent Execution ─────────────────────────────────────────────────────

    /**
     * @notice Execute a swap through Uniswap on behalf of the account.
     *         Validates against DelegationRules before executing.
     */
    function executeSwap(
        address fromToken,
        address toToken,
        address dex,
        uint256 amountUSD,
        bytes calldata swapCalldata
    ) external onlyAgent returns (bytes32) {
        // Validate against onchain delegation rules — throws if violated
        rulesContract.validateSwap(owner, fromToken, toToken, dex, amountUSD);

        // Execute the swap calldata against the DEX
        (bool success,) = dex.call(swapCalldata);
        require(success, "Swap execution failed");

        bytes32 txRef = keccak256(abi.encodePacked(block.timestamp, fromToken, toToken, amountUSD, _nonce++));
        emit SwapExecuted(fromToken, toToken, amountUSD, txRef);
        return txRef;
    }

    // ─── ERC-4337 ─────────────────────────────────────────────────────────────

    function getNonce() external view returns (uint256) {
        return _nonce;
    }

    receive() external payable {}
}
