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

import "hardhat/console.sol";

contract NFTMarketplace is Ownable, ReentrancyGuard, ERC721Holder, INFTMarketplace {
	// State Variables
	using Counters for Counters.Counter;
	// Listing Data
	Counters.Counter public listingsCount;
	mapping(bytes32 => int256) public listings;

	// Auction Data
	Counters.Counter public auctionsCount;
	mapping(bytes32 => Auction) public auctions;

	// Fee management
	address payable public feeAccount;
	uint public fee;

	// Modifiers
	// Shared
	modifier validPrice(uint256 price) {
		require(price > 0 && price <= uint256(type(int256).max), "Invalid price. Needs to be positive and not exceed Max Int valid value.");
		_;
	}

	modifier onlyValidTimestamps(uint start, uint end) {
		require((start > 0 && end > block.timestamp && start < end), "Invalid timestamps");
		_;
	}
	modifier notNFTOwner(IERC721 nft, uint256 tokenId) {
		require(msg.sender != nft.ownerOf(tokenId), "NFT owner can't call this function");
		_;
	}

	modifier onlyNFTOwner(IERC721 nft, uint256 tokenId) {
		require(msg.sender == nft.ownerOf(tokenId), "Not the NFT owner");
		_;
	}

	modifier onlyApprovedNFTs(IERC721 nft, uint tokenId) {
		address tokenOwner = nft.ownerOf(tokenId);
		require(
			nft.getApproved(tokenId) == address(this) ||
				nft.isApprovedForAll(tokenOwner, address(this)),
			"Marketplace must be approved or approvedForAll to transfer the NFT"
		);
		_;
	}

	// Listing
	modifier notListed(IERC721 nft, uint tokenId) {
		// If the NFT is listed the price will be a positive value
		require(listings[getKey(nft, tokenId)] <= 0, "NFT is already listed");
		_;
	}

	modifier listed(IERC721 nft, uint tokenId) {
		// If the NFT is listed the price will be a positive value
		require(listings[getKey(nft, tokenId)] > 0, "NFT is not listed");
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
		// If the NFT is listed the price will be higher than 0
		// and if the nft is in an auction the seller address will be different from Zero
		require(
			(listings[getKey(nft, tokenId)] <= 0) &&
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

	function _saveListing(IERC721 nft, uint tokenId, uint256 price) internal {
		// Increment listings count
		listingsCount.increment();
		// Add the new listing to the mapping of listings
		listings[getKey(nft, tokenId)] = int256(price);
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
		uint price
	)
		external
		validPrice(price)
		notListed(nft, tokenId)
		onlyNFTOwner(nft, tokenId)
		onlyApprovedNFTs(nft, tokenId)
	{
		_saveListing(nft, tokenId, price);

		emit ListingCreated(address(nft), tokenId, msg.sender, price, block.timestamp);
	}

	function cancelListing(
		IERC721 nft,
		uint256 tokenId
	) external listed(nft, tokenId) onlyNFTOwner(nft, tokenId) {
		// Delete the listing
		delete listings[getKey(nft, tokenId)];
		// Decrement listings count
		listingsCount.decrement();

		// Emit listing cancelled event
		emit ListingCancelled(address(nft), tokenId, msg.sender, block.timestamp);
	}

	function updateListingPrice(
		IERC721 nft,
		uint256 tokenId,
		uint256 newPrice
	) external validPrice(newPrice) listed(nft, tokenId) onlyNFTOwner(nft, tokenId) {
		bytes32 listingKey = getKey(nft, tokenId);
		/// @dev convert to uint for comparison and to pass as parameter to events. Liseting price will be positive because it passed the listed validation
		uint256 oldPrice = uint256(listings[listingKey]);
		// Check if the new price is different from the current price
		require(newPrice != oldPrice, "New price must be different from current price");

		// Update the listing price
		// TODO validate that there's not an overflow

		listings[listingKey] = int256(newPrice);

		// Emit listing price updated event
		emit ListingPriceUpdated(address(nft), tokenId, uint256(oldPrice), newPrice, block.timestamp);
	}

	function purchase(
		IERC721 nft,
		uint256 tokenId
	) external payable nonReentrant listed(nft, tokenId) notNFTOwner(nft, tokenId) {
		bytes32 listingKey = getKey(nft, tokenId);
		int256 listingPrice = listings[listingKey];
		
		/// @dev Ensure that the user has sent enough ether to purchase the NFT. ListingPrice is a positive value because it's validated by listed modifier 
		require(msg.value >= uint256(listingPrice), "Insufficient funds to purchase NFT");

		/// @dev Save negative price to have a quick reference to the previous sale price
		listings[listingKey] = listingPrice * -1;
		listingsCount.decrement();

		address nftSeller = nft.ownerOf(tokenId);
		// Transfer the NFT ownership to the buyer
		nft.safeTransferFrom(nftSeller, msg.sender, tokenId);

		// Transfer the ether to the seller
		payable(nftSeller).transfer(uint256(listingPrice));

		// Emit an event to indicate that the purchase has happened
		emit Purchase(address(nft), tokenId, nftSeller, msg.sender, uint256(listingPrice), block.timestamp);
	}

	// Auctions
	function _saveAuction(
		IERC721 nft,
		uint tokenId,
		uint floorPrice,
		uint startTimestamp,
		uint endTimestamp
	) internal validPrice(floorPrice) onlyValidTimestamps(startTimestamp, endTimestamp) {
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
		validPrice(floorPrice)
		notInAuctionOrListing(nft, tokenId)
		onlyNFTOwner(IERC721(nft), tokenId)
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
