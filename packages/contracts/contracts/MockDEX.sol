// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMockETH {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title MockDEX
 * @dev A mock DEX contract designed specifically for Monad Testnet hackathon testing.
 * It simulates swaps between native MON and Mock ETH.
 */
contract MockDEX {
    
    event SwapExecuted(
        address indexed agentWallet,
        string tokenTicker, // "ETH" or "MON"
        bool isBuyMON, // true if swapping ETH -> MON (buying MON), false if swapping MON -> ETH (selling MON)
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );

    address public mockETHAddress;

    constructor(address _mockETHAddress) payable {
        mockETHAddress = _mockETHAddress;
    }

    /**
     * @dev Swaps Mock ETH for native MON. (Buying MON)
     * @param ethAmountIn The amount of Mock ETH to swap
     */
    function swapETHForMON(uint256 ethAmountIn) external {
        require(ethAmountIn > 0, "DEX: Insufficient ETH amount");
        
        IMockETH ethToken = IMockETH(mockETHAddress);
        
        // In sandbox fallback, if allowance is not set or balance is low, we simulate it.
        // For on-chain compatibility, we attempt transferFrom.
        require(ethToken.transferFrom(msg.sender, address(this), ethAmountIn), "DEX: ETH transfer failed");
        
        // Exchange rate: 1 ETH = 10 MON
        uint256 monAmountOut = ethAmountIn * 10;
        
        require(address(this).balance >= monAmountOut, "DEX: Insufficient MON liquidity in DEX pool");
        payable(msg.sender).transfer(monAmountOut);

        emit SwapExecuted(
            msg.sender,
            "ETH",
            true, // isBuyMON = true
            ethAmountIn,
            monAmountOut,
            block.timestamp
        );
    }

    /**
     * @dev Swaps native MON for Mock ETH. (Selling MON)
     */
    function swapMONForETH() external payable {
        require(msg.value > 0, "DEX: Insufficient MON sent");

        // Exchange rate: 10 MON = 1 ETH
        uint256 ethAmountOut = msg.value / 10;
        
        IMockETH ethToken = IMockETH(mockETHAddress);
        require(ethToken.balanceOf(address(this)) >= ethAmountOut, "DEX: Insufficient ETH liquidity in DEX pool");

        require(ethToken.transfer(msg.sender, ethAmountOut), "DEX: ETH payout failed");

        emit SwapExecuted(
            msg.sender,
            "ETH",
            false, // isBuyMON = false
            msg.value,
            ethAmountOut,
            block.timestamp
        );
    }

    /**
     * @dev Fallback to fund the mock DEX with native MON liquidity
     */
    receive() external payable {}
}
