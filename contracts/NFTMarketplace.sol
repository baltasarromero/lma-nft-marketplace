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

contract NFTMarketplace is Ownable, ReentrancyGuard, ERC721Holder, INFTMarketplace {
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
	modifier onlyNFTOwnerOrApprovedForAll(
		IERC721 nft,
		uint tokenId,
		address senderAddress
	) {
		address tokenOwner = nft.ownerOf(tokenId);

		require(
			tokenOwner == msg.sender || nft.isApprovedForAll(tokenOwner, msg.sender),
			"Must be the owner or approved for all to list in the marketplace"
		);
		_;
	}

	modifier onlyValidTimestamps(uint start, uint end) {
		require((start > 0 && end > block.timestamp && start < end), "Invalid timestamps");
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
	modifier onlyValidListing(bytes32 listingKey) {
		Listing memory listing = listings[listingKey];
		require(
			address(listing.nft) != address(0) &&
				listing.tokenId != 0 &&
				listing.seller != address(0) &&
				listing.price > 0 &&
				listing.startTimestamp > 0 &&
				listing.endTimestamp > 0,
			"Not a valid listing"
		);
		_;
	}

	modifier onlyAfterListingStart(bytes32 listingKey) {
		require(
			block.timestamp >= listings[listingKey].startTimestamp,
			"Listing hasn't started yet"
		);
		_;
	}

	modifier onlyBeforeListingEnd(bytes32 listingKey) {
		require(block.timestamp < listings[listingKey].endTimestamp, "Listing has ended");
		_;
	}

	modifier onlyNotListingSeller(bytes32 listingKey) {
		require(msg.sender != listings[listingKey].seller, "Seller can't call this function");
		_;
	}

	modifier onlyListingSeller(bytes32 listingKey) {
		require(msg.sender == listings[listingKey].seller, "Not the listing seller");
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
		require(block.timestamp < auctions[auctionKey].endTimestamp, "Auction has ended");
		_;
	}

	modifier onlyAfterAuctionEndTime(bytes32 auctionKey) {
		require(block.timestamp > auctions[auctionKey].endTimestamp, "Haven't reached end time");
		_;
	}

	modifier onlyAuctionNotCancelled(bytes32 auctionKey) {
		require(auctions[auctionKey].cancelled == false, "Auction is already cancelled");
		_;
	}

	modifier onlyAuctionNotEnded(bytes32 auctionKey) {
		require(!auctions[auctionKey].ended, "Auction already ended");
		_;
	}

	modifier onlyNotAuctionSeller(bytes32 auctionKey) {
		require(msg.sender != auctions[auctionKey].seller, "Seller can't call this function");
		_;
	}

	modifier onlyAuctionSeller(bytes32 auctionKey) {
		require(msg.sender == auctions[auctionKey].seller, "Not the auction seller");
		_;
	}

	modifier onlyAuctionEndedOrCancelled(bytes32 auctionKey) {
		require(
			auctions[auctionKey].cancelled || auctions[auctionKey].ended,
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

	function _saveListing(
		IERC721 nft,
		uint tokenId,
		uint price,
		uint startTimestamp,
		uint endTimestamp
	) internal nonZeroPrice(price) onlyValidTimestamps(startTimestamp, endTimestamp) {
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

	function _transferNFTToMarketplace(IERC721 nft, uint tokenId) internal {
		address tokenOwner = nft.ownerOf(tokenId);
		// Transfer the NFT to the MarketPlace
		nft.safeTransferFrom(tokenOwner, address(this), tokenId);
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
		notInAuctionOrListing(nft, tokenId)
		onlyNFTOwnerOrApprovedForAll(nft, tokenId, msg.sender)
		onlyApprovedNFTs(nft, tokenId)
	{
		_saveListing(nft, tokenId, price, startTimestamp, endTimestamp);

		emit ListingCreated(address(nft), tokenId, msg.sender, price, startTimestamp, endTimestamp);
	}

	function cancelListing(
		bytes32 listingKey
	)
		external
		onlyValidListing(listingKey)
		onlyListingSeller(listingKey)
		onlyBeforeListingEnd(listingKey)
	{
		// Get listing attributes to trigger event
		Listing storage listingToBeCancelled = listings[listingKey];
		address listingNFTAddress = address(listingToBeCancelled.nft);
		uint listingTokenId = listingToBeCancelled.tokenId;
		address listingSeller = listingToBeCancelled.seller;

		// Delete the listing from the MarketPlace
		delete listings[listingKey];

		// Emit listing cancelled event
		emit ListingCancelled(listingNFTAddress, listingTokenId, listingSeller, block.timestamp);
	}

	function updateListingPrice(
		bytes32 listingKey,
		uint newPrice
	)
		external
		onlyValidListing(listingKey)
		onlyListingSeller(listingKey)
		onlyBeforeListingEnd(listingKey)
	{
		Listing storage listingToUpdate = listings[listingKey];
		uint oldPrice = uint(listingToUpdate.price);
		// Check if the new price is different from the current price
		require(newPrice != oldPrice, "New price must be different from current price");

		// Update the listing price
		listingToUpdate.price = newPrice;

		// Emit listing price updated event
		emit ListingPriceUpdated(
			address(listingToUpdate.nft),
			listingToUpdate.tokenId,
			oldPrice,
			newPrice,
			block.timestamp
		);
	}

	function purchase(
		bytes32 listingKey
	)
		external
		payable
		nonReentrant
		onlyValidListing(listingKey)
		onlyNotListingSeller(listingKey)
		onlyAfterListingStart(listingKey)
		onlyBeforeListingEnd(listingKey)
	{
		Listing memory listingToPurchase = listings[listingKey];

		// Ensure that the user has sent enough ether to purchase the NFT
		require(msg.value >= listingToPurchase.price, "Insufficient funds to purchase NFT");

		// Mark the listing as sold
		listings[listingKey].sold = true;

		address nftOwner = listingToPurchase.nft.ownerOf(listingToPurchase.tokenId);

		// Transfer the NFT ownership to the buyer
		listingToPurchase.nft.safeTransferFrom(nftOwner, msg.sender, listingToPurchase.tokenId);

		// Transfer the ether to the seller
		payable(listingToPurchase.seller).transfer(msg.value);

		// Emit an event to indicate that the purchase has happened
		emit Purchase(
			address(listingToPurchase.nft),
			listingToPurchase.tokenId,
			listingToPurchase.seller,
			msg.sender,
			listingToPurchase.price,
			block.timestamp
		);
	}

	// Auctions
	function _saveAuction(
		IERC721 nft,
		uint tokenId,
		uint floorPrice,
		uint startTimestamp,
		uint endTimestamp
	) internal nonZeroPrice(floorPrice) onlyValidTimestamps(startTimestamp, endTimestamp) {
		// Increment auctions count
		auctionsCount.increment();
		// Add the new listing to the mapping of listings
		Auction storage auction = auctions[getKey(nft, tokenId)];
		// Set the expected attributes
		auction.nft = nft;
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
		onlyNFTOwnerOrApprovedForAll(IERC721(nft), tokenId, msg.sender)
		onlyApprovedNFTs(IERC721(nft), tokenId)
	{
		_saveAuction(nft, tokenId, floorPrice, startTimestamp, endTimestamp);

		_transferNFTToMarketplace(nft, tokenId);

		emit AuctionCreated(
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
		onlyNotAuctionSeller(auctionKey)
		onlyAuctionNotCancelled(auctionKey)
		onlyAfterAuctionStart(auctionKey)
		onlyBeforeAuctionEnd(auctionKey)
	{
		// Reject payments of 0 ETH
		require(msg.value > 0, "Send ether to place a bid");

		Auction storage auction = auctions[auctionKey];
		uint256 currentHighestBid = auction.highestBid;
		uint256 newBid = auction.bids[msg.sender] + msg.value;

		// Check if the bid value is greater than the floor price
		require(newBid >= auction.floorPrice, "Bid value should be higher than the floor price");

		// Add the bid to the mapping of bids
		auction.bids[msg.sender] = newBid;

		// Check if the new bid is now the highest
		if (newBid > currentHighestBid) {
			// Set the new highest bid
			auction.highestBid = newBid;
			auction.highestBidder = msg.sender;

			emit NewHighestBid(
				address(auction.nft),
				auction.tokenId,
				msg.sender,
				newBid,
				currentHighestBid,
				block.timestamp
			);
		}
	}

	function cancelAuction(
		bytes32 auctionKey
	)
		external
		nonReentrant
		onlyAuctionSeller(auctionKey)
		onlyAuctionNotCancelled(auctionKey)
		onlyBeforeAuctionEnd(auctionKey)
	{
		Auction storage auctionToBeCancelled = auctions[auctionKey];
		// Mark as cancelled
		auctionToBeCancelled.cancelled = true;
		// We reset the highest bidder so they can claim the funds
		auctionToBeCancelled.highestBidder = address(0);

		// Tranfer the token back to the onwer
		auctionToBeCancelled.nft.safeTransferFrom(
			address(this),
			auctionToBeCancelled.seller,
			auctionToBeCancelled.tokenId
		);

		// Emit auction cancelled event
		emit AuctionCancelled(
			address(auctionToBeCancelled.nft),
			auctionToBeCancelled.tokenId,
			auctionToBeCancelled.seller,
			block.timestamp
		);
	}

	function endAuction(
		bytes32 auctionKey
	)
		external
		nonReentrant
		onlyAuctionSeller(auctionKey)
		onlyAuctionNotCancelled(auctionKey)
		onlyAfterAuctionEndTime(auctionKey)
		onlyAuctionNotEnded(auctionKey)
	{
		Auction storage auction = auctions[auctionKey];

		// End the auction
		auction.ended = true;

		// TODO implement Marketplace fee logic

		// If there's a winner of the auction
		if (auction.highestBidder != address(0)) {
			// buyers userfunds should be set to 0
			auction.bids[auction.highestBidder] = 0;

			// Transfer the NFT to the winner
			auction.nft.safeTransferFrom(address(this), auction.highestBidder, auction.tokenId);

			// Transfer the bidAmount to the seller
			(bool sent, ) = payable(auction.seller).call{ value: auction.highestBid }("");

			require(sent, "Failed to pay the seller");
		} else {
			// If there is no winner. Transfer the NFT back to the seller
			auction.nft.safeTransferFrom(address(this), auction.seller, auction.tokenId);
		}

		emit AuctionFinished(
			address(auction.nft),
			auction.tokenId,
			auction.highestBid,
			auction.seller,
			auction.highestBidder,
			block.timestamp
		);
	}

	function withdrawBid(
		bytes32 auctionKey
	) external nonReentrant onlyAuctionEndedOrCancelled(auctionKey) {
		Auction storage auction = auctions[auctionKey];

		// There's no need to check that the caller is not the highest bidder, because when an auction is ended
		// the funds of the highest bidder are set to zero
		// Get user's bid 
		uint userBid = auction.bids[msg.sender];
		require(userBid > 0, "No funds to withdraw");

		auction.bids[msg.sender] = 0;
		(bool sent, ) = payable(msg.sender).call{ value: userBid }("");

		require(sent, "Failed to send bid funds to bidder");

		emit BidWithdrawn(
			msg.sender,
			address(auction.nft),
			auction.tokenId,
			userBid,
			block.timestamp
		);
	}
}
