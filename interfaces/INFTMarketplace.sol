// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/**
    @dev Import OpenZeppelin's ERC721 interface to interact with NFTs.
*/
import "@openzeppelin/contracts/interfaces/IERC721.sol";

import "../contracts/ERC721WithPermit.sol";

interface INFTMarketplace {
	// Structs
	// NFT Offers
	// Where the offer struct would be
	struct NFTOffer {
		uint256 offerId;
		address buyer;
		uint256 offer;
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
		uint256 purchaseTimestamp
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

	// NFT Offers
	event NewNFTOffer(
		address indexed nftAddress,
		uint256 tokenId,
		address indexed seller,
		address indexed buyer,
		uint256 offer,
		uint256 offerCreatedTimestamp
	);

	event NFTOfferCancelled(
		address indexed nftAddress,
		uint256 tokenId,
		address indexed seller,
		address indexed buyer,
		uint256 offerCancelledTimestamp
	);

	event NFTOfferAccepted(
		address indexed nftAddress,
		uint256 tokenId,
		address indexed seller,
		address indexed buyer,
		uint256 offeredPrice,
		uint256 offerAcceptedTimestamp
	);

	// Management
	event FundsClaimed(address indexed user, uint256 amount, uint256 timestamp);

	event FeeAccountUpdated(address previousFeeAccount, address newfeeAcount);

	event FeeAmountUpdated(uint256 previousFeeAmount, uint256 newFeeAmount);

	// Functions definitions
	// Listings
	function createListing(IERC721 nft, uint256 tokenId, uint256 price) external;

	function cancelListing(IERC721 nft, uint256 tokenId) external;

	function updateListingPrice(IERC721 nft, uint256 tokenId, uint256 newPrice) external;

	function purchase(IERC721 nft, uint256 tokenId) external payable;

	// NFT Offers
	function createNFTOffer(IERC721 nft, uint256 tokenId) external payable;

	function cancelNFTOffer(IERC721 nft, uint256 tokenId) external;

	function acceptNFTOffer(IERC721 nft, uint256 tokenId, address buyer) external;

	function acceptNFTOfferWithPermit(
		ERC721WithPermit nft,
		uint256 tokenId,
		address receiver,
		uint256 deadline,
		bytes calldata signature
	) external;
}
