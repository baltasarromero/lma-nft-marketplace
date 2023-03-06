// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/**
    @dev Import OpenZeppelin's ERC721 interface to interact with NFTs.
*/
import "@openzeppelin/contracts/interfaces/IERC721.sol";
interface INFTMarketplace  {
	// State Variables
	struct Listing {
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
		address indexed nftAddress,
        uint tokenId,
		address indexed seller,
		uint cancelTimestamp
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
		uint cancelTimestamp,
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

	// Functions definitions
	// Listings
	function createListing(
		IERC721 nft,
		uint tokenId,
		uint price,
		uint startTimestamp,
		uint endTimestamp
	) external;

	function cancelListing(bytes32 listingKey) external;

	function updateListingPrice(bytes32 listingKey, uint newPrice) external;

	// Audits
	function createAuction(
		IERC721 nft,
		uint tokenId,
		uint floorPrice,
		uint startTimestamp,
		uint endTimestamp
	) external;

	function bid(bytes32 auctionKey) external payable;

	function cancelAuction(bytes32 auctionKey) external;

	function endAuction(bytes32 auctionKey) external;

	function withDrawBid(bytes32 auctionKey) external;

    // Management functions
	// Get the final price which is seller's desired price + marketPlace fees
	function getFinalPrice(bytes32 listingKey) external view returns (uint);

    function changeFeeAcoount(
		address payable newFeeAccount
	) external;

	function changeFeeAmount(
		uint newFeeAmount
	) external;

}

