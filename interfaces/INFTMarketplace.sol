// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/**
    @dev Import OpenZeppelin's ERC721 interface to interact with NFTs.
*/
import "@openzeppelin/contracts/interfaces/IERC721.sol";

interface INFTMarketplace {
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
		mapping(address => uint) bids;
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
		address indexed nftAddress,
		uint indexed tokenId,
		address seller,
		uint price,
		uint startTimestamp,
		uint endTimestamp
	);

	event Purchase(
		address indexed nftAddress,
		uint tokenId,
		address indexed seller,
		address indexed buyer,
		uint price,
		uint endTimestamp
	);

	event ListingPriceUpdated(
		address indexed nftAddress,
		uint tokenId,
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
		address indexed nftAddress,
		uint indexed tokenId,
		address seller,
		uint floorPrice,
		uint startTimestamp,
		uint endTimestamp
	);

	event NewHighestBid(
		address indexed nftAddress,
		uint tokenId,
		address indexed bidder,
		uint bid,
		uint previousHighestBid,
		uint timestamp
	);

	event AuctionCancelled(
		address indexed nftAddress,
		uint tokenId,
		address indexed seller,
		uint cancelTimestamp
	);

	event AuctionFinished(
		address indexed nftAddress,
		uint tokenId,
		uint amountId,
		address indexed seller,
		address indexed buyer,
		uint endTimestamp
	);

	event BidWithdrawn(
		address indexed bidder,
		address indexed nftAddress,
		uint tokenId,
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

	function purchase(bytes32 listingKey) external payable;

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

	function withdrawBid(bytes32 auctionKey) external;
}
