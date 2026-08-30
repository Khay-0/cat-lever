// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * KovaVault — pool de liquidité en ETH natif de Robinhood Chain.
 *
 * Les LP déposent de l'ETH et reçoivent des parts (shares). Le moteur de
 * levier (KovaPerp) emprunte l'ETH disponible pour financer les positions et
 * rembourse principal + frais. La part des frais destinée aux LP reste dans le
 * vault : la valeur de chaque share monte mécaniquement.
 *
 * Non audité. À déployer sur Robinhood Chain (chainId 4663).
 */
contract KovaVault {
    address public owner;
    address public engine;

    uint256 public totalShares;
    uint256 public totalBorrowed;
    mapping(address => uint256) public sharesOf;

    event Deposit(address indexed account, uint256 amount, uint256 shares);
    event Withdraw(address indexed account, uint256 shares, uint256 amount);
    event Borrow(uint256 amount);
    event Settle(uint256 principal, uint256 profit);

    error NotOwner();
    error NotEngine();
    error ZeroAmount();
    error InsufficientLiquidity();
    error InsufficientShares();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyEngine() {
        if (msg.sender != engine) revert NotEngine();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setEngine(address newEngine) external onlyOwner {
        engine = newEngine;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    /// Actifs totaux du pool : ETH en caisse + ETH prêté aux positions ouvertes.
    function totalAssets() public view returns (uint256) {
        return address(this).balance + totalBorrowed;
    }

    /// ETH immédiatement empruntable / retirable.
    function availableLiquidity() public view returns (uint256) {
        return address(this).balance;
    }

    /// Valeur en ETH d'une position LP.
    function assetsOf(address account) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (sharesOf[account] * totalAssets()) / totalShares;
    }

    function deposit() external payable returns (uint256 shares) {
        if (msg.value == 0) revert ZeroAmount();
        uint256 assetsBefore = totalAssets() - msg.value;
        shares = totalShares == 0 || assetsBefore == 0
            ? msg.value
            : (msg.value * totalShares) / assetsBefore;
        totalShares += shares;
        sharesOf[msg.sender] += shares;
        emit Deposit(msg.sender, msg.value, shares);
    }

    function withdraw(uint256 shares) external returns (uint256 amount) {
        if (shares == 0) revert ZeroAmount();
        if (sharesOf[msg.sender] < shares) revert InsufficientShares();
        amount = (shares * totalAssets()) / totalShares;
        if (amount > address(this).balance) revert InsufficientLiquidity();
        sharesOf[msg.sender] -= shares;
        totalShares -= shares;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdraw(msg.sender, shares, amount);
    }

    /// Emprunt du moteur de levier pour financer une position.
    function borrow(uint256 amount, address to) external onlyEngine {
        if (amount > address(this).balance) revert InsufficientLiquidity();
        totalBorrowed += amount;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Borrow(amount);
    }

    /// Remboursement : `principal` réduit la dette, le surplus est du profit LP.
    function settle(uint256 principal) external payable onlyEngine {
        uint256 repaid = principal > totalBorrowed ? totalBorrowed : principal;
        totalBorrowed -= repaid;
        emit Settle(repaid, msg.value > repaid ? msg.value - repaid : 0);
    }

    receive() external payable {}
}
