// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MentoGuardRules
 * @notice On-chain delegation rules for the MentoGuard autonomous agent.
 *         The agent reads these constraints before every swap — it cannot
 *         exceed them regardless of the LLM's decision.
 */
contract MentoGuardRules {
    address public owner;
    address public agent;

    struct Rules {
        uint256 maxSwapAmountUSD;    // Max single swap in USD (scaled by 1e2, e.g. 50000 = $500.00)
        uint256 maxDailyVolumeUSD;   // Max daily volume in USD (scaled by 1e2)
        uint8   driftThreshold;      // Portfolio drift % that triggers rebalance
        bool    paused;              // Pause all autonomous trading
        uint256 updatedAt;           // Block timestamp of last update
    }

    Rules public rules;

    event RulesUpdated(
        uint256 maxSwapAmountUSD,
        uint256 maxDailyVolumeUSD,
        uint8   driftThreshold,
        bool    paused,
        address updatedBy
    );

    event AgentPaused(address by);
    event AgentResumed(address by);

    modifier onlyOwner() {
        require(msg.sender == owner, "MentoGuard: not owner");
        _;
    }

    constructor(
        address _agent,
        uint256 _maxSwapAmountUSD,
        uint256 _maxDailyVolumeUSD,
        uint8   _driftThreshold
    ) {
        owner = msg.sender;
        agent = _agent;
        rules = Rules({
            maxSwapAmountUSD:  _maxSwapAmountUSD,
            maxDailyVolumeUSD: _maxDailyVolumeUSD,
            driftThreshold:    _driftThreshold,
            paused:            false,
            updatedAt:         block.timestamp
        });
    }

    function updateRules(
        uint256 _maxSwapAmountUSD,
        uint256 _maxDailyVolumeUSD,
        uint8   _driftThreshold
    ) external onlyOwner {
        rules.maxSwapAmountUSD  = _maxSwapAmountUSD;
        rules.maxDailyVolumeUSD = _maxDailyVolumeUSD;
        rules.driftThreshold    = _driftThreshold;
        rules.updatedAt         = block.timestamp;
        emit RulesUpdated(_maxSwapAmountUSD, _maxDailyVolumeUSD, _driftThreshold, rules.paused, msg.sender);
    }

    function pause() external onlyOwner {
        rules.paused    = true;
        rules.updatedAt = block.timestamp;
        emit AgentPaused(msg.sender);
    }

    function resume() external onlyOwner {
        rules.paused    = false;
        rules.updatedAt = block.timestamp;
        emit AgentResumed(msg.sender);
    }

    function getRules() external view returns (Rules memory) {
        return rules;
    }
}
