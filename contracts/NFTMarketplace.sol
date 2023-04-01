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

/**
    @dev Import OpenZeppelin's ERC721 interface to interact with NFTs.
*/
import "./ERC721WithPermit.sol";

import "hardhat/console.sol";

contract NFTMarketplace is Ownable, ReentrancyGuard, ERC721Holder, INFTMarketplace {
	// State Variables
	using Counters for Counters.Counter;
	// Listing Data
	// We only store de price ins the mapping
	mapping(bytes32 => uint256) public listings;

	// NFT Offers
	//mapping(bytes32 => NFTOffer[]) public nftOffers;	
	//Counters.Counter public nftOffersCount;	
	/// @dev Each buyer can only create one offer at a time for a given nft
	mapping(bytes32 => mapping(address => uint256)) public nftOffers;	

	// Fee management
	address payable public feeAccount;
	uint256 public fee;

	// Modifiers
	// Shared
	modifier validPrice(uint256 price) {
		require(price > 0, "Invalid price. Needs to be above zero.");
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

	modifier onlyNFTWithPermitsOwner(ERC721WithPermit nft, uint256 tokenId) {
		require(msg.sender == nft.ownerOf(tokenId), "Not the NFT owner");
		_;
	}

	modifier onlyApprovedNFTs(IERC721 nft, uint256 tokenId) {
		address tokenOwner = nft.ownerOf(tokenId);
		require(
			nft.getApproved(tokenId) == address(this) ||
				nft.isApprovedForAll(tokenOwner, address(this)),
			"Marketplace must be approved or approvedForAll to transfer the NFT"
		);
		_;
	}

	// Listing
	modifier notListed(IERC721 nft, uint256 tokenId) {
		// If the NFT is listed the price will be a positive value
		require(listings[getKey(nft, tokenId)] == 0, "NFT is already listed");
		_;
	}

	modifier listed(IERC721 nft, uint256 tokenId) {
		// If the NFT is listed the price will be a positive value
		require(listings[getKey(nft, tokenId)] > 0, "NFT is not listed");
		_;
	}

	// Constructor
	constructor(address feeDestinationAccount, uint256 feeAmount) {
		feeAccount = payable(feeDestinationAccount);
		fee = feeAmount;
	}

	// Functions
	// Helpers
	function getKey(IERC721 nft, uint256 tokenId) public pure returns (bytes32) {
		return keccak256(abi.encodePacked(address(nft), tokenId));
	}

	function _saveListing(IERC721 nft, uint256 tokenId, uint256 price) internal {
		// Add the new listing to the mapping of listings
		listings[getKey(nft, tokenId)] = price;
	}

	// Listings
	function createListing(
		IERC721 nft,
		uint256 tokenId,
		uint256 price
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
		
		// Emit listing cancelled event
		emit ListingCancelled(address(nft), tokenId, msg.sender, block.timestamp);
	}

	function updateListingPrice(
		IERC721 nft,
		uint256 tokenId,
		uint256 newPrice
	) external validPrice(newPrice) listed(nft, tokenId) onlyNFTOwner(nft, tokenId) {
		bytes32 listingKey = getKey(nft, tokenId);
		/// @dev convert to uint256 for comparison and to pass as parameter to events. Liseting price will be positive because it passed the listed validation
		uint256 oldPrice = listings[listingKey];
		// Check if the new price is different from the current price
		require(newPrice != oldPrice, "New price must be different from current price");

		// Update the listing price
		listings[listingKey] = newPrice;

		// Emit listing price updated event
		emit ListingPriceUpdated(address(nft), tokenId, oldPrice, newPrice, block.timestamp);
	}

	function purchase(
		IERC721 nft,
		uint256 tokenId
	) external payable nonReentrant listed(nft, tokenId) notNFTOwner(nft, tokenId) {
		bytes32 listingKey = getKey(nft, tokenId);
		uint256 listingPrice = listings[listingKey];
		
		/// @dev Ensure that the user has sent enough ether to purchase the NFT. ListingPrice is a positive value because it's validated by listed modifier 
		require(msg.value >= uint256(listingPrice), "Insufficient funds to purchase NFT");

		/// @dev Delete the listing
		delete listings[listingKey];
		
		address nftSeller = nft.ownerOf(tokenId);
		// Transfer the NFT ownership to the buyer
		nft.safeTransferFrom(nftSeller, msg.sender, tokenId);

		// Transfer the ether to the seller
		payable(nftSeller).transfer(uint256(listingPrice));

		// Emit an event to indicate that the purchase has happened
		emit Purchase(address(nft), tokenId, nftSeller, msg.sender, listingPrice, block.timestamp);
	}

	function createNFTOffer(IERC721 nft, uint256 tokenId) external payable notNFTOwner(nft, tokenId) notListed(nft, tokenId) {
		/// @dev If there's an outstanding offer the value sent wil be added to the existent offer. If there's no previous offer we just set the value sent
		uint256 offerValue = nftOffers[getKey(nft, tokenId)][msg.sender] + msg.value;
		
		// Save the offer
		nftOffers[getKey(nft, tokenId)][msg.sender] = offerValue;

		/// @dev emit a new offer event even if the offer is updated. The new event will reflect the new offer value
		emit NewNFTOffer(address(nft), tokenId, nft.ownerOf(tokenId), msg.sender, offerValue, block.timestamp);
	}

	function cancelNFTOffer(IERC721 nft, uint256 tokenId) external nonReentrant {
		uint256 offeredPrice = _deleteNFTOffer(nft, tokenId, msg.sender);
		
		require(offeredPrice > 0, "Offer does not exist");
		
		// Transfer the ether to the offerer
		payable(msg.sender).transfer(uint256(offeredPrice));

		// Emit event
		emit NFTOfferCancelled(address(nft), tokenId, nft.ownerOf(tokenId), msg.sender, block.timestamp);		
	}

	function acceptNFTOffer(IERC721 nft, uint256 tokenId, address buyer) external nonReentrant onlyNFTOwner(nft, tokenId) {
		uint256 offeredPrice = _deleteNFTOffer(nft, tokenId, buyer);
		// Transfer the NFT ownership to the buyer
		nft.safeTransferFrom(msg.sender, buyer, tokenId);

		// Transfer the ether to the NFT Owner
		payable(msg.sender).transfer(uint256(offeredPrice));

		// Emit event
		emit NFTOfferAccepted(address(nft), tokenId, msg.sender, buyer, offeredPrice, block.timestamp);
	}

	function _transferNFTWithPermit(ERC721WithPermit nft, uint256 tokenId, uint256 deadline, address receiver, bytes memory signature) internal {
		nft.safeTransferFromWithPermit(msg.sender, receiver, tokenId, "", deadline, signature);
	}

	function _deleteNFTOffer(IERC721 nft, uint256 tokenId, address buyer) internal returns (uint256 offeredPrice) {
		offeredPrice  = nftOffers[getKey(nft, tokenId)][buyer];

		delete nftOffers[getKey(nft, tokenId)][buyer];
	}

	function acceptNFTOfferWithPermit(
        ERC721WithPermit nft,
        uint256 tokenId,
		address receiver,
        uint256 deadline,
        bytes calldata signature
    ) public virtual nonReentrant onlyNFTWithPermitsOwner(nft, tokenId) {
        require(receiver != address(0), "Receiver can't be Zero address");

		(uint256 offeredPrice) = _deleteNFTOffer(nft,tokenId, receiver);

		_transferNFTWithPermit(nft, tokenId, deadline, receiver, signature);

		// Transfer the ether to the NFT Owner
		payable(msg.sender).transfer(uint256(offeredPrice));

		// Emit event
		emit NFTOfferAccepted(address(nft), tokenId, msg.sender, receiver, offeredPrice, block.timestamp);
    }
}
