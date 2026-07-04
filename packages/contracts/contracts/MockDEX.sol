// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMockUSDC {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title MockDEX
 * @dev A mock DEX contract designed specifically for Monad Testnet hackathon testing.
 * It simulates swaps between native MON and USDC.
 */
contract MockDEX {
    
    event SwapExecuted(
        address indexed agentWallet,
        string tokenTicker, // "USDC" or "MON"
        bool isBuyMON, // true if swapping USDC -> MON (buying MON), false if swapping MON -> USDC (selling MON)
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );

    address public mockUSDCAddress;

    constructor(address _mockUSDCAddress) payable {
        mockUSDCAddress = _mockUSDCAddress;
    }

    /**
     * @dev Swaps Mock USDC for native MON. (Buying MON)
     * @param usdcAmountIn The amount of Mock USDC to swap
     */
    function swapUSDCForMON(uint256 usdcAmountIn) external {
        require(usdcAmountIn > 0, "DEX: Insufficient USDC amount");
        
        IMockUSDC usdcToken = IMockUSDC(mockUSDCAddress);
        
        // Transfer USDC to this contract
        require(usdcToken.transferFrom(msg.sender, address(this), usdcAmountIn), "DEX: USDC transfer failed");
        
        // Exchange rate: 1 USDC = 10 MON (USDC has 6 decimals, MON has 18 decimals)
        // monAmountOut = usdcAmountIn * 10 * 1e12
        uint256 monAmountOut = usdcAmountIn * 10 * 1e12;
        
        require(address(this).balance >= monAmountOut, "DEX: Insufficient MON liquidity in DEX pool");
        payable(msg.sender).transfer(monAmountOut);

        emit SwapExecuted(
            msg.sender,
            "USDC",
            true, // isBuyMON = true
            usdcAmountIn,
            monAmountOut,
            block.timestamp
        );
    }

    /**
     * @dev Swaps native MON for Mock USDC. (Selling MON)
     */
    function swapMONForUSDC() external payable {
        require(msg.value > 0, "DEX: Insufficient MON sent");

        // Exchange rate: 10 MON = 1 USDC (MON has 18 decimals, USDC has 6 decimals)
        // usdcAmountOut = msg.value / 10 / 1e12
        uint256 usdcAmountOut = msg.value / 10 / 1e12;
        
        IMockUSDC usdcToken = IMockUSDC(mockUSDCAddress);
        require(usdcToken.balanceOf(address(this)) >= usdcAmountOut, "DEX: Insufficient USDC liquidity in DEX pool");

        require(usdcToken.transfer(msg.sender, usdcAmountOut), "DEX: USDC payout failed");

        emit SwapExecuted(
            msg.sender,
            "USDC",
            false, // isBuyMON = false
            msg.value,
            usdcAmountOut,
            block.timestamp
        );
    }

    /**
     * @dev Fallback to fund the mock DEX with native MON liquidity
     */
    receive() external payable {}
}
