// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {KovaVault} from "./KovaVault.sol";

interface IUniswapV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory liquidityCumulatives);
}

/**
 * KovaPerp — moteur de levier (max x3) sur les memecoins de Robinhood Chain.
 *
 * Collatéral et règlement en ETH natif. Le prix d'entrée / de sortie est lu
 * on-chain depuis le pool Uniswap V3 TOKEN/WETH (TWAP 15 min, retombe sur le
 * prix spot si le pool n'a pas assez d'observations).
 *
 * Frais par transaction : 20 bps (0,2 %) par défaut, réglables par l'owner,
 * répartis entre LP, buyback $KVO et trésorerie.
 *
 * Non audité.
 */
contract KovaPerp {
    struct Position {
        address trader;
        address pool;
        address token;
        bool isLong;
        uint256 collateral; // ETH
        uint256 size; // ETH = collateral * leverage
        uint256 entryPrice; // WETH (wei) pour 1e18 token
        uint256 openedAt;
        bool open;
    }

    address public owner;
    KovaVault public immutable vault;
    address public immutable weth;

    uint16 public tradingFeeBps = 20; // 0,2 %
    uint16 public borrowFeeBpsHourly = 1; // 0,01 %/h
    uint16 public liquidationFeeBps = 500;
    uint16 public lpShareBps = 7000;
    uint16 public buybackShareBps = 2000;
    uint16 public treasuryShareBps = 1000;
    uint16 public maxLeverageX100 = 300; // x3

    address public buybackReceiver;
    address public treasuryReceiver;
    uint32 public twapWindow = 900;

    uint256 public nextId = 1;
    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) internal _byTrader;

    event Opened(uint256 indexed id, address indexed trader, address token, bool isLong, uint256 collateral, uint256 size, uint256 entryPrice);
    event Closed(uint256 indexed id, uint256 exitPrice, int256 pnl, uint256 payout);
    event Liquidated(uint256 indexed id, uint256 exitPrice);
    event FeeCollected(uint256 amount, uint256 lp, uint256 buyback, uint256 treasury);

    error NotOwner();
    error BadLeverage();
    error NoCollateral();
    error NotOpen();
    error NotTrader();
    error NotLiquidatable();
    error PoolMismatch();
    error InsufficientLiquidity();
    error BadSplit();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address payable vaultAddress, address wethAddress) {
        owner = msg.sender;
        vault = KovaVault(vaultAddress);
        weth = wethAddress;
        buybackReceiver = msg.sender;
        treasuryReceiver = msg.sender;
    }

    // ---------------------------------------------------------------- admin

    function setFees(
        uint16 _tradingFeeBps,
        uint16 _borrowFeeBpsHourly,
        uint16 _liquidationFeeBps,
        uint16 _lpShareBps,
        uint16 _buybackShareBps,
        uint16 _treasuryShareBps,
        uint16 _maxLeverageX100
    ) external onlyOwner {
        if (uint256(_lpShareBps) + _buybackShareBps + _treasuryShareBps != 10000) revert BadSplit();
        tradingFeeBps = _tradingFeeBps;
        borrowFeeBpsHourly = _borrowFeeBpsHourly;
        liquidationFeeBps = _liquidationFeeBps;
        lpShareBps = _lpShareBps;
        buybackShareBps = _buybackShareBps;
        treasuryShareBps = _treasuryShareBps;
        maxLeverageX100 = _maxLeverageX100;
    }

    function setReceivers(address buyback, address treasury) external onlyOwner {
        buybackReceiver = buyback;
        treasuryReceiver = treasury;
    }

    function setTwapWindow(uint32 secondsWindow) external onlyOwner {
        twapWindow = secondsWindow;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    // ---------------------------------------------------------------- price

    /// Prix on-chain : WETH (wei) pour 1e18 token.
    function priceOf(address pool, address token) public view returns (uint256) {
        uint160 sqrtPriceX96 = _twapSqrtPrice(pool);
        uint256 ratioX128 = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96)) >> 64; // token1/token0 en Q128
        address token0 = IUniswapV3Pool(pool).token0();
        address token1 = IUniswapV3Pool(pool).token1();
        if (token0 == token && token1 == weth) {
            return (ratioX128 * 1e18) >> 128;
        }
        if (token1 == token && token0 == weth) {
            if (ratioX128 == 0) return 0;
            return (uint256(1e18) << 128) / ratioX128;
        }
        revert PoolMismatch();
    }

    function _twapSqrtPrice(address pool) internal view returns (uint160) {
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = twapWindow;
        secondsAgos[1] = 0;
        try IUniswapV3Pool(pool).observe(secondsAgos) returns (
            int56[] memory tickCumulatives,
            uint160[] memory
        ) {
            int56 delta = tickCumulatives[1] - tickCumulatives[0];
            int24 avgTick = int24(delta / int56(uint56(twapWindow)));
            if (delta < 0 && (delta % int56(uint56(twapWindow)) != 0)) avgTick--;
            return TickMath.getSqrtRatioAtTick(avgTick);
        } catch {
            (uint160 sqrtPriceX96, , , , , , ) = IUniswapV3Pool(pool).slot0();
            return sqrtPriceX96;
        }
    }

    // --------------------------------------------------------------- trading

    function open(address pool, address token, bool isLong, uint16 leverageX100)
        external
        payable
        returns (uint256 id)
    {
        if (msg.value == 0) revert NoCollateral();
        if (leverageX100 < 100 || leverageX100 > maxLeverageX100) revert BadLeverage();

        uint256 size = (msg.value * leverageX100) / 100;
        uint256 fee = (size * tradingFeeBps) / 10000;
        if (fee >= msg.value) revert NoCollateral();
        uint256 collateral = msg.value - fee;
        uint256 borrowed = size - collateral;
        if (borrowed > vault.availableLiquidity()) revert InsufficientLiquidity();

        _distributeFee(fee);

        id = nextId++;
        positions[id] = Position({
            trader: msg.sender,
            pool: pool,
            token: token,
            isLong: isLong,
            collateral: collateral,
            size: size,
            entryPrice: priceOf(pool, token),
            openedAt: block.timestamp,
            open: true
        });
        _byTrader[msg.sender].push(id);

        emit Opened(id, msg.sender, token, isLong, collateral, size, positions[id].entryPrice);
    }

    function close(uint256 id) external {
        Position storage p = positions[id];
        if (!p.open) revert NotOpen();
        if (p.trader != msg.sender) revert NotTrader();
        _settle(id, false);
    }

    /// Ouvert à tous : liquide une position dont l'equity est épuisée.
    function liquidate(uint256 id) external {
        Position storage p = positions[id];
        if (!p.open) revert NotOpen();
        if (equity(id) > 0) revert NotLiquidatable();
        _settle(id, true);
    }

    /// PnL en ETH (positif ou négatif) d'une position ouverte.
    function pnlOf(uint256 id) public view returns (int256) {
        Position storage p = positions[id];
        if (!p.open || p.entryPrice == 0) return 0;
        uint256 price = priceOf(p.pool, p.token);
        int256 diff = int256(price) - int256(p.entryPrice);
        if (!p.isLong) diff = -diff;
        return (diff * int256(p.size)) / int256(p.entryPrice);
    }

    /// Frais d'emprunt accumulés (ETH).
    function borrowFeeOf(uint256 id) public view returns (uint256) {
        Position storage p = positions[id];
        if (!p.open) return 0;
        uint256 borrowed = p.size - p.collateral;
        uint256 hoursOpen = (block.timestamp - p.openedAt) / 1 hours;
        return (borrowed * borrowFeeBpsHourly * hoursOpen) / 10000;
    }

    /// Fonds propres restants d'une position (0 => liquidable).
    function equity(uint256 id) public view returns (int256) {
        Position storage p = positions[id];
        if (!p.open) return 0;
        int256 e = int256(p.collateral) + pnlOf(id) - int256(borrowFeeOf(id));
        return e > 0 ? e : int256(0);
    }

    /// Prix de liquidation on-chain (WETH par 1e18 token).
    function liquidationPriceOf(uint256 id) external view returns (uint256) {
        Position storage p = positions[id];
        if (!p.open || p.size == 0) return 0;
        uint256 move = (p.entryPrice * p.collateral) / p.size;
        return p.isLong ? p.entryPrice - move : p.entryPrice + move;
    }

    function positionsOf(address trader) external view returns (uint256[] memory) {
        return _byTrader[trader];
    }

    function _settle(uint256 id, bool liquidation) internal {
        Position storage p = positions[id];
        uint256 exitPrice = priceOf(p.pool, p.token);
        int256 pnl = pnlOf(id);
        uint256 borrowFee = borrowFeeOf(id);
        uint256 borrowed = p.size - p.collateral;
        uint256 closeFee = (p.size * tradingFeeBps) / 10000;

        int256 net = int256(p.collateral) + pnl - int256(borrowFee) - int256(closeFee);
        if (liquidation) {
            uint256 penalty = (p.collateral * liquidationFeeBps) / 10000;
            net -= int256(penalty);
        }
        uint256 payout = net > 0 ? uint256(net) : 0;

        p.open = false;

        // Le vault récupère le principal prêté + tout ce que le trader a perdu.
        uint256 owedToVault = borrowed + (p.collateral > payout ? p.collateral - payout : 0);
        uint256 balanceHere = address(this).balance;
        if (payout > 0 && payout + owedToVault > balanceHere + borrowed) {
            // sécurité : ne jamais payer plus que la trésorerie disponible
            payout = balanceHere > owedToVault ? balanceHere - owedToVault : 0;
        }

        _distributeFee(closeFee + borrowFee);

        if (owedToVault > 0) {
            uint256 send = owedToVault > address(this).balance ? address(this).balance : owedToVault;
            vault.settle{value: send}(borrowed);
        }
        if (payout > 0) {
            (bool ok, ) = p.trader.call{value: payout}("");
            if (!ok) revert TransferFailed();
        }

        if (liquidation) emit Liquidated(id, exitPrice);
        emit Closed(id, exitPrice, pnl, payout);
    }

    function _distributeFee(uint256 fee) internal {
        if (fee == 0) return;
        uint256 lp = (fee * lpShareBps) / 10000;
        uint256 buyback = (fee * buybackShareBps) / 10000;
        uint256 treasury = fee - lp - buyback;
        if (lp > 0) vault.settle{value: lp}(0);
        if (buyback > 0) {
            (bool ok, ) = buybackReceiver.call{value: buyback}("");
            if (!ok) revert TransferFailed();
        }
        if (treasury > 0) {
            (bool ok2, ) = treasuryReceiver.call{value: treasury}("");
            if (!ok2) revert TransferFailed();
        }
        emit FeeCollected(fee, lp, buyback, treasury);
    }

    receive() external payable {}
}

/// Extrait de la librairie Uniswap V3 TickMath (MIT / GPL-2.0).
library TickMath {
    int24 internal constant MIN_TICK = -887272;
    int24 internal constant MAX_TICK = 887272;

    function getSqrtRatioAtTick(int24 tick) internal pure returns (uint160 sqrtPriceX96) {
        unchecked {
            uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
            require(absTick <= uint256(int256(MAX_TICK)), "T");

            uint256 ratio = absTick & 0x1 != 0
                ? 0xfffcb933bd6fad37aa2d162d1a594001
                : 0x100000000000000000000000000000000;
            if (absTick & 0x2 != 0) ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128;
            if (absTick & 0x4 != 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128;
            if (absTick & 0x8 != 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128;
            if (absTick & 0x10 != 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128;
            if (absTick & 0x20 != 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128;
            if (absTick & 0x40 != 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128;
            if (absTick & 0x80 != 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128;
            if (absTick & 0x100 != 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128;
            if (absTick & 0x200 != 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128;
            if (absTick & 0x400 != 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128;
            if (absTick & 0x800 != 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128;
            if (absTick & 0x1000 != 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128;
            if (absTick & 0x2000 != 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128;
            if (absTick & 0x4000 != 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128;
            if (absTick & 0x8000 != 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128;
            if (absTick & 0x10000 != 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128;
            if (absTick & 0x20000 != 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128;
            if (absTick & 0x40000 != 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128;
            if (absTick & 0x80000 != 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128;

            if (tick > 0) ratio = type(uint256).max / ratio;

            sqrtPriceX96 = uint160((ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1));
        }
    }
}
