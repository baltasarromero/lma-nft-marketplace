// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/** 
    @dev Import OpenZeppelin's the Ownable contract.
*/
import '@openzeppelin/contracts/access/Ownable.sol';
/**
    @dev Import OpenZeppelin's the ReentrancyGuardContract contract.
*/
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
/**
    @dev Import OpenZeppelin's Counters library.
*/
import '@openzeppelin/contracts/utils/Counters.sol';

/**
    @dev Import OpenZeppelin's ERC721 interface to interact with NFTs.
*/
import '@openzeppelin/contracts/interfaces/IERC721.sol';

contract NFTMarketplace is Ownable, ReentrancyGuard {
    // State Variables
    struct Listing {
        uint listingId;
        IERC721 nft;
        uint tokenId;
        address payable seller;
        uint price;
        bool sold;
        address buyer;
        uint startTimestamp;
        uint endTimestamp;
        bool cancelled;
    }

    struct Auction {
        uint auctionId;
        IERC721 nft;
        uint tokenId;
        address payable seller;
        uint floorPrice;
        uint sellPrice;
        bool sold;
        address buyer;
        mapping(address => uint) fundsByBidder;
        address highestBidder;
        uint highestBid;
        bool cancelled;
        bool ended;
        uint startTimestamp;
        uint endTimestamp;
    }

    using Counters for Counters.Counter;
    // Listing Data
    Counters.Counter public listingsCount;
    Counters.Counter public listingsSoldCount;
    mapping(uint => Listing) public listings;

    // Auction Data
    Counters.Counter public auctionsCount;
    Counters.Counter public auctionsSoldCount;
    mapping(uint => Auction) public auctions;

    // User funds
    mapping(address => uint) public userFunds;

    // Fee management
    address payable public feeAccount;
    uint public fee;

    // Events
    // Listings
    event ListingCreated(
        uint indexed listingId,
        address indexed nftAddress,
        uint indexed tokenId,
        address seller,
        uint price,
        uint startTimestamp,
        uint endTimestamp
    );

    event Purchase(
        uint indexed listingId,
        address indexed nftAddress,
        address indexed seller,
        address buyer,
        uint price,
        uint endTimestamp
    );

    event ListingPriceUpdated(
        uint indexed listingId,
        uint oldPrice,
        uint newPrice,
        uint timestamp
    );

    event ListingCancelled(
        uint indexed listingId,
        address indexed seller,
        uint cancelBlock,
        uint timestamp
    );

    // Auctions
    event AuctionCreated(
        uint indexed auctionId,
        address indexed nftAddress,
        uint indexed tokenId,
        address seller,
        uint floorPrice,
        uint startTimestamp,
        uint endTimestamp
    );

    event NewHighestBid(
        uint indexed auctionId,
        address indexed nftAddress,
        address indexed bidder,
        uint bid,
        uint previousHighestBid,
        uint timestamp
    );

    event AuctionCancelled(
        uint indexed auctionId,
        address indexed seller,
        uint cancelBlock,
        uint timestamp
    );

    event AuctionFinished(
        uint indexed auctionId,
        address indexed seller,
        address indexed buyer,
        address nftAddress,
        bool sold,
        uint endTimestamp
    );

    event BidWithdrawn(
        uint indexed auctionId,
        address indexed bidder,
        address indexed nftAddress,
        uint bid,
        uint timestamp
    );

    // Management
    event FundsClaimed(address indexed user, uint amount, uint timestamp);

    event FeeAccountUpdated(address previousFeeAccount, address newfeeAcount);

    event FeeAmountUpdated(uint previousFeeAmount, uint newFeeAmount);

    // Modifiers
    // Listings
    modifier onlyAfterListingStart(uint listingId) {
        _;
    }

    modifier onlyBeforeListingEnd(uint listingId) {
        _;
    }

    modifier onlyListingNotCancelled(uint listingId) {
        _;
    }

    modifier onlyNotListingSeller(uint listingId) {
        _;
    }

    modifier onlyListingSeller(uint listingId) {
        _;
    }

    modifier onlyListingEndedOrCancelled(uint listingId) {
        _;
    }

    // Auctions
    modifier onlyAfterAuctionStart(uint auctionId) {
        _;
    }

    modifier onlyBeforeAuctionEnd(uint auctionId) {
        _;
    }

    modifier onlyAuctionNotCancelled(uint auctionId) {
        _;
    }

    modifier onlyNotAuctionSeller(uint auctionId) {
        _;
    }

    modifier onlyAuctionSeller(uint auctionId) {
        _;
    }

    modifier onlyAuctionEndedOrCancelled(uint auctionId) {
        _;
    }

    modifier notInAuctionOrListing(address nftAddress, uint tokenId) {
        _;
    }

    // Functions
    // TODO revisar
    // Listings
    function createListing(
        IERC721 nft,
        uint tokenId,
        uint price,
        uint startTimestamp,
        uint endTimestamp
    )
        external
        nonReentrant
        notInAuctionOrListing(address(nft), tokenId)
        returns (bool)
    {
        return false;
    }

    function cancelListing(
        uint listingId
    )
        external
        nonReentrant
        onlyListingSeller(listingId)
        onlyListingNotCancelled(listingId)
        onlyBeforeListingEnd(listingId)
        returns (bool)
    {
        return false;
    }

    function updateListingPrice(
        uint listingId,
        uint newPrice
    )
        external
        nonReentrant
        onlyListingSeller(listingId)
        onlyListingNotCancelled(listingId)
        onlyBeforeListingEnd(listingId)
        returns (bool)
    {
        return false;
    }

    // Auctions
    function createAuction(
        IERC721 nft,
        uint tokenId,
        uint floorPrice,
        uint startBlock,
        uint endBlock
    )
        external
        nonReentrant
        notInAuctionOrListing(address(nft), tokenId)
        returns (bool)
    {
        return false;
    }

    function bid(
        uint auctionId
    )
        external
        payable
        nonReentrant
        onlyNotAuctionSeller(auctionId)
        onlyAuctionNotCancelled(auctionId)
        onlyAfterAuctionStart(auctionId)
        onlyBeforeAuctionEnd(auctionId)
        returns (bool)
    {
        return false;
    }

    function cancelAuction(
        uint auctionId
    )
        external
        nonReentrant
        onlyAuctionSeller(auctionId)
        onlyAuctionNotCancelled(auctionId)
        onlyBeforeAuctionEnd(auctionId)
        returns (bool)
    {
        return false;
    }

    function endAuction(
        uint auctionId
    )
        external
        nonReentrant
        onlyAuctionSeller(auctionId)
        onlyAuctionNotCancelled(auctionId)
        onlyBeforeAuctionEnd(auctionId)
        returns (bool)
    {
        return false;
    }

    function withDrawBid(
        uint auctionId
    )
        external
        nonReentrant
        onlyAuctionEndedOrCancelled(auctionId)
        returns (bool)
    {
        return true;
    }

    // Management functions
    // Get the final price which is seller's desired price + marketPlace fees
    function getFinalPrice(uint listingId) public view returns (uint) {
        return 0;
    }

    // TODO change FeeAccount and emit an event
    function changeFeeAcoount(
        address payable newFeeAccount
    ) external onlyOwner returns (bool) {
        return false;
    }

    // TODO change FeeAmoung and emit an event
    function changeFeeAmount(
        uint newFeeAmount
    ) external onlyOwner returns (bool) {
        return false;
    }
}
