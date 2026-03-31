// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DelegationRules
 * @notice EIP-7710 caveat enforcement for MentoGuard autonomous agent.
 *         These caveats are checked onchain — the agent CANNOT exceed them
 *         even if the backend is compromised.
 */
contract DelegationRules {
    // ─── Errors ───────────────────────────────────────────────────────────────

    error ExceedsMaxSwapAmount(uint256 amount, uint256 max);
    error ExceedsDailyVolume(uint256 newTotal, uint256 max);
    error TokenNotAllowed(address token);
    error DexNotAllowed(address dex);
    error OutsideTimeWindow(uint8 hour, uint8 start, uint8 end);
    error RequiresHumanApproval(uint256 amount, uint256 threshold);

    // ─── Storage ──────────────────────────────────────────────────────────────

    struct Rules {
        uint256 maxSwapAmountUSD;          // in 1e18 USD
        uint256 maxDailyVolumeUSD;         // in 1e18 USD
        address[] allowedTokens;
        address[] allowedDexes;
        uint8 timeWindowStart;             // UTC hour (0–23)
        uint8 timeWindowEnd;               // UTC hour (0–23)
        uint256 requireHumanApprovalAbove; // in 1e18 USD
    }

    mapping(address => Rules) public userRules;
    mapping(address => uint256) public dailyVolumeUsed;
    mapping(address => uint256) public lastVolumeReset;

    // ─── Events ───────────────────────────────────────────────────────────────

    event RulesUpdated(address indexed user, Rules rules);
    event SwapValidated(address indexed user, address fromToken, address toToken, uint256 amountUSD);

    // ─── Setup ────────────────────────────────────────────────────────────────

    function setRules(Rules calldata rules) external {
        userRules[msg.sender] = rules;
        emit RulesUpdated(msg.sender, rules);
    }

    // ─── Validation ───────────────────────────────────────────────────────────

    function validateSwap(
        address user,
        address fromToken,
        address toToken,
        address dex,
        uint256 amountUSD
    ) external {
        Rules storage rules = userRules[user];

        // 1. Max single swap
        if (amountUSD > rules.maxSwapAmountUSD) {
            revert ExceedsMaxSwapAmount(amountUSD, rules.maxSwapAmountUSD);
        }

        // 2. Daily volume
        _resetDailyVolumeIfNeeded(user);
        uint256 newTotal = dailyVolumeUsed[user] + amountUSD;
        if (newTotal > rules.maxDailyVolumeUSD) {
            revert ExceedsDailyVolume(newTotal, rules.maxDailyVolumeUSD);
        }

        // 3. Allowed tokens
        if (!_isTokenAllowed(rules, fromToken)) revert TokenNotAllowed(fromToken);
        if (!_isTokenAllowed(rules, toToken)) revert TokenNotAllowed(toToken);

        // 4. Allowed DEX
        if (!_isDexAllowed(rules, dex)) revert DexNotAllowed(dex);

        // 5. Time window
        uint8 hour = uint8((block.timestamp / 3600) % 24);
        if (hour < rules.timeWindowStart || hour >= rules.timeWindowEnd) {
            revert OutsideTimeWindow(hour, rules.timeWindowStart, rules.timeWindowEnd);
        }

        // 6. Human approval threshold
        if (amountUSD > rules.requireHumanApprovalAbove) {
            revert RequiresHumanApproval(amountUSD, rules.requireHumanApprovalAbove);
        }

        dailyVolumeUsed[user] += amountUSD;
        emit SwapValidated(user, fromToken, toToken, amountUSD);
    }

    // ─── Internals ────────────────────────────────────────────────────────────

    function _resetDailyVolumeIfNeeded(address user) internal {
        uint256 dayStart = (block.timestamp / 86400) * 86400;
        if (lastVolumeReset[user] < dayStart) {
            dailyVolumeUsed[user] = 0;
            lastVolumeReset[user] = dayStart;
        }
    }

    function _isTokenAllowed(Rules storage rules, address token) internal view returns (bool) {
        for (uint256 i = 0; i < rules.allowedTokens.length; i++) {
            if (rules.allowedTokens[i] == token) return true;
        }
        return false;
    }

    function _isDexAllowed(Rules storage rules, address dex) internal view returns (bool) {
        for (uint256 i = 0; i < rules.allowedDexes.length; i++) {
            if (rules.allowedDexes[i] == dex) return true;
        }
        return false;
    }
}
