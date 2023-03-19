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

	// Fee management
	address payable public feeAccount;
	uint public fee;

	// Modifiers
	// Shared
	modifier validPrice(uint256 price) {
		require(price > 0 && price <= uint256(type(int256).max), "Invalid price. Needs to be positive and not exceed Max Int valid value.");
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
}
