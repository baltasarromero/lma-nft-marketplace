// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/**
    @dev Import OpenZeppelin's ERC721 interface to interact with NFTs.
*/
import "@openzeppelin/contracts/interfaces/IERC721.sol";

interface INFTMarketplace {
	// Structs
	struct Auction {
		IERC721 nft;
		uint256 tokenId;
		address payable seller;
		uint256 floorPrice;
		uint256 sellPrice;
		mapping(address => uint256) bids;
		address highestBidder;
		uint256 highestBid;
		bool cancelled;
		bool ended;
		uint256 startTimestamp;
		uint256 endTimestamp;
	}

	// Events
	// Listings
	event ListingCreated(
		address indexed nftAddress,
		uint256 indexed tokenId,
		address seller,
		uint256 price,
		uint256 listingTimestamp
	);

	event Purchase(
		address indexed nftAddress,
		uint256 tokenId,
		address indexed seller,
		address indexed buyer,
		uint256 price,
		uint256 endTimestamp
	);

	event ListingPriceUpdated(
		address indexed nftAddress,
		uint256 tokenId,
		uint256 oldPrice,
		uint256 newPrice,
		uint256 timestamp
	);

	event ListingCancelled(
		address indexed nftAddress,
		uint256 tokenId,
		address indexed seller,
		uint256 cancelTimestamp
	);

	// Auctions
	event AuctionCreated(
		address indexed nftAddress,
		uint256 indexed tokenId,
		address seller,
		uint256 floorPrice,
		uint256 startTimestamp,
		uint256 endTimestamp
	);

	event NewHighestBid(
		address indexed nftAddress,
		uint256 tokenId,
		address indexed bidder,
		uint256 bid,
		uint256 previousHighestBid,
		uint256 timestamp
	);

	event AuctionCancelled(
		address indexed nftAddress,
		uint256 tokenId,
		address indexed seller,
		uint256 cancelTimestamp
	);

	event AuctionFinished(
		address indexed nftAddress,
		uint256 tokenId,
		uint256 amountId,
		address indexed seller,
		address indexed buyer,
		uint256 endTimestamp
	);

	event BidWithdrawn(
		address indexed bidder,
		address indexed nftAddress,
		uint256 tokenId,
		uint256 bid,
		uint256 timestamp
	);

	// Management
	event FundsClaimed(address indexed user, uint256 amount, uint256 timestamp);

	event FeeAccountUpdated(address previousFeeAccount, address newfeeAcount);

	event FeeAmountUpdated(uint256 previousFeeAmount, uint256 newFeeAmount);

	// Functions definitions
	// Listings
	function createListing(
		IERC721 nft,
		uint256 tokenId,
		uint256 price
	) external;

	function cancelListing(IERC721 nft,  uint256 tokenId) external;

	function updateListingPrice(IERC721 nft, uint256 tokenId, uint256 newPrice) external;

	function purchase(IERC721 nft, uint256 tokenId) external payable;

	// Audits
	function createAuction(
		IERC721 nft,
		uint256 tokenId,
		uint256 floorPrice,
		uint256 startTimestamp,
		uint256 endTimestamp
	) external;

	function bid(bytes32 auctionKey) external payable;

	function cancelAuction(bytes32 auctionKey) external;

	function endAuction(bytes32 auctionKey) external;

	function withdrawBid(bytes32 auctionKey) external;

}
