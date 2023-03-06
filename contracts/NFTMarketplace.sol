// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/** 
    @dev Import OpenZeppelin's the Ownable contract.
*/
import "@openzeppelin/contracts/access/Ownable.sol";
/**
    @dev Import OpenZeppelin's the ReentrancyGuardContract contract.
*/
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
/**
    @dev Import OpenZeppelin's Counters library.
*/
import "@openzeppelin/contracts/utils/Counters.sol";

/**
    @dev Import OpenZeppelin's ERC721 interface to interact with NFTs.
*/
import "@openzeppelin/contracts/interfaces/IERC721.sol";

/**
    @dev Import OpenZeppelin's ERC721Holder to allow the marketplace to hold NFTs.
*/
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

/**
    @dev Import OpenZeppelin's ERC721 interface to interact with NFTs.
*/
import "../interfaces/INFTMarketplace.sol";

contract NFTMarketplace is
	Ownable,
	ReentrancyGuard,
	ERC721Holder,
	INFTMarketplace
{
	// State Variables
	using Counters for Counters.Counter;
	// Listing Data
	Counters.Counter public listingsCount;
	Counters.Counter public listingsSoldCount;
	mapping(bytes32 => Listing) public listings;

	// Auction Data
	Counters.Counter public auctionsCount;
	Counters.Counter public auctionsSoldCount;
	mapping(bytes32 => Auction) public auctions;

	// User funds
	mapping(address => uint) public userFunds;

	// Fee management
	address payable public feeAccount;
	uint public fee;

	// Modifiers
	// Shared
	modifier nonZeroPrice(uint price) {
		require(price > 0, "Price must be greater than zero");
		_;
	}

	/*
        Also implicitly validates that the NFT address and token actually exists
    */
	modifier onlyNFTOwner(
		IERC721 nft,
		uint tokenId,
		address senderAddress
	) {
		require(
			nft.ownerOf(tokenId) == msg.sender,
			"Must be the owner of the NFT to list in the marketplace"
		);
		_;
	}

	modifier onlyValidTimestamps(uint start, uint end) {
		require(
			(start > 0 && end > block.timestamp && start < end),
			"Invalid timestamps"
		);
		_;
	}

	modifier onlyApprovedNFTs(IERC721 nft, uint tokenId) {
		require(
			nft.getApproved(tokenId) == address(this),
			"Marketplace must be approved to transfer the NFT"
		);
		_;
	}

	// Listing
	modifier onlyAfterListingStart(bytes32 listingKey) {
		require(
			block.timestamp >= listings[listingKey].startTimestamp,
			"Listing hasn't started yet"
		);
		_;
	}

	modifier onlyBeforeListingEnd(bytes32 listingKey) {
		require(
			block.timestamp < listings[listingKey].endTimestamp,
			"Listing has ended"
		);
		_;
	}

	modifier onlyListingNotCancelled(bytes32 listingKey) {
		require(
			listings[listingKey].cancelled == false,
			"Listing is already cancelled"
		);
		_;
	}

	modifier onlyNotListingSeller(bytes32 listingKey) {
		require(
			msg.sender != listings[listingKey].seller,
			"Seller can't call this function"
		);
		_;
	}

	modifier onlyListingSeller(bytes32 listingKey) {
		require(
			msg.sender == listings[listingKey].seller,
			"Not the listing seller"
		);
		_;
	}

	modifier onlyListingEndedOrCancelled(bytes32 listingKey) {
		Listing memory listing = listings[listingKey];
		require(
			listing.sold ||
				listing.cancelled ||
				block.timestamp > listing.endTimestamp,
			"Listing is still active"
		);
		_;
	}

	// Auctions
	modifier onlyAfterAuctionStart(bytes32 auctionKey) {
		require(
			block.timestamp >= auctions[auctionKey].startTimestamp,
			"Auction hasn't started yet"
		);
		_;
	}

	modifier onlyBeforeAuctionEnd(bytes32 auctionKey) {
		require(
			block.timestamp < auctions[auctionKey].endTimestamp,
			"Auction has ended"
		);
		_;
	}

	modifier onlyAuctionNotCancelled(bytes32 auctionKey) {
		require(
			auctions[auctionKey].cancelled == false,
			"Auction has been cancelled"
		);
		_;
	}

	modifier onlyNotAuctionSeller(bytes32 auctionKey) {
		require(
			msg.sender != auctions[auctionKey].seller,
			"Seller can't call this function"
		);
		_;
	}

	modifier onlyAuctionSeller(bytes32 auctionKey) {
		require(
			msg.sender == auctions[auctionKey].seller,
			"Only the seller can call this function"
		);
		_;
	}

	modifier onlyAuctionEndedOrCancelled(bytes32 auctionKey) {
		require(
			auctions[auctionKey].sold ||
				auctions[auctionKey].cancelled ||
				block.timestamp > auctions[auctionKey].endTimestamp,
			"Auction is still active"
		);
		_;
	}

	modifier notInAuctionOrListing(IERC721 nft, uint tokenId) {
		// If the NFT is listed the seller address will be different from Zero
		require(
			(listings[getKey(nft, tokenId)].seller == address(0)) &&
				(auctions[getKey(nft, tokenId)].seller == address(0)),
			"NFT is already listed"
		);
		_;
	}

	// Constructor
	constructor(address feeDestinationAccount, uint feeAmount) {
		feeAccount = payable(feeDestinationAccount);
		fee = feeAmount;
	}

	// Functions
	// Helpers
	function getKey(IERC721 nft, uint tokenId) public pure returns (bytes32) {
		return keccak256(abi.encodePacked(address(nft), tokenId));
	}

	function saveListing(
		IERC721 nft,
		uint tokenId,
		uint price,
		uint startTimestamp,
		uint endTimestamp
	)
		internal
		nonZeroPrice(price)
		onlyValidTimestamps(startTimestamp, endTimestamp)
	{
		// Increment listings count
		listingsCount.increment();

		Listing memory listing = Listing(
			nft,
			tokenId,
			payable(msg.sender),
			price,
			false,
			address(0),
			startTimestamp,
			endTimestamp,
			false
		);

		// Add the new listing to the mapping of listings
		listings[getKey(nft, tokenId)] = listing;
	}

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
		notInAuctionOrListing(nft, tokenId)
		onlyNFTOwner(nft, tokenId, msg.sender)
		onlyApprovedNFTs(nft, tokenId)
	{
		saveListing(nft, tokenId, price, startTimestamp, endTimestamp);

		// TODO try if instead of transfer it's possigle do approval here or permit and then just transfer on sell
		// Transfer the NFT to the MarketPlace
		IERC721(nft).safeTransferFrom(msg.sender, address(this), tokenId);

		emit ListingCreated(
			listingsCount.current(),
			address(nft),
			tokenId,
			msg.sender,
			price,
			startTimestamp,
			endTimestamp
		);
	}

	function cancelListing(
		bytes32 listingKey
	)
		external
		nonReentrant
		onlyListingSeller(listingKey)
		onlyListingNotCancelled(listingKey)
		onlyBeforeListingEnd(listingKey)
	{
		Listing storage listingToBeCancelled = listings[listingKey];
        // Mark as cancelled
		listingToBeCancelled.cancelled = true;
		
        // Tranfer the token back to the onwer
		IERC721(listingToBeCancelled.nft).safeTransferFrom(address(this), listingToBeCancelled.seller, listingToBeCancelled.tokenId);
	
        // Emit listing cancelled event
        emit ListingCancelled(address(listingToBeCancelled.nft), listingToBeCancelled.tokenId, listingToBeCancelled.seller, block.timestamp);    
    }

	function updateListingPrice(
		bytes32 listingKey,
		uint newPrice
	)
		external
		nonReentrant
		onlyListingSeller(listingKey)
		onlyListingNotCancelled(listingKey)
		onlyBeforeListingEnd(listingKey)
	{}

	// Auctions
	function saveAuction(
		IERC721 nft,
		uint tokenId,
		uint floorPrice,
		uint startTimestamp,
		uint endTimestamp
	)
		internal
		nonZeroPrice(floorPrice)
		onlyValidTimestamps(startTimestamp, endTimestamp)
	{
		// Increment auctions count
		auctionsCount.increment();
		// Add the new listing to the mapping of listings
		Auction storage auction = auctions[getKey(nft, tokenId)];
		// Set the expected attributes
		auction.nft = IERC721(nft);
		auction.tokenId = tokenId;
		auction.seller = payable(msg.sender);
		auction.floorPrice = floorPrice;
		auction.startTimestamp = startTimestamp;
		auction.endTimestamp = endTimestamp;
	}

	function createAuction(
		IERC721 nft,
		uint tokenId,
		uint floorPrice,
		uint startTimestamp,
		uint endTimestamp
	)
		external
		nonReentrant
		notInAuctionOrListing(nft, tokenId)
		onlyNFTOwner(IERC721(nft), tokenId, msg.sender)
		onlyApprovedNFTs(IERC721(nft), tokenId)
	{
		saveAuction(nft, tokenId, floorPrice, startTimestamp, endTimestamp);

		// TODO try if instead of transfer it's possigle do approval here or permit and then just transfer on sell
		// Transfer the NFT to the MarketPlace
		IERC721(nft).safeTransferFrom(msg.sender, address(this), tokenId);
		emit AuctionCreated(
			auctionsCount.current(),
			address(nft),
			tokenId,
			msg.sender,
			floorPrice,
			startTimestamp,
			endTimestamp
		);
	}

	function bid(
		bytes32 auctionKey
	)
		external
		payable
		nonReentrant
		onlyNotAuctionSeller(auctionKey)
		onlyAuctionNotCancelled(auctionKey)
		onlyAfterAuctionStart(auctionKey)
		onlyBeforeAuctionEnd(auctionKey)
	{}

	function cancelAuction(
		bytes32 auctionKey
	)
		external
		nonReentrant
		onlyAuctionSeller(auctionKey)
		onlyAuctionNotCancelled(auctionKey)
		onlyBeforeAuctionEnd(auctionKey)
	{}

	function endAuction(
		bytes32 auctionKey
	)
		external
		nonReentrant
		onlyAuctionSeller(auctionKey)
		onlyAuctionNotCancelled(auctionKey)
		onlyBeforeAuctionEnd(auctionKey)
	{}

	function withDrawBid(
		bytes32 auctionKey
	) external nonReentrant onlyAuctionEndedOrCancelled(auctionKey) {}

	// Management functions
	// Get the final price which is seller's desired price + marketPlace fees
	function getFinalPrice(bytes32 listingKey) public view returns (uint) {
		return 0;
	}

	// TODO change FeeAccount and emit an event
	function changeFeeAcoount(
		address payable newFeeAccount
	) external onlyOwner {}

	// TODO change FeeAmoung and emit an event
	function changeFeeAmount(uint newFeeAmount) external onlyOwner {}
}
