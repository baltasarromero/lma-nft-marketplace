// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./NFTMarketplace.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "./ERC721WithPermit.sol";

contract AcceptNFTOfferWithPermitAttacker is IERC721Receiver {
	NFTMarketplace public lmaNFTMarketplace;

	constructor(address lmaNFTMartketplaceAddress) {
		lmaNFTMarketplace = NFTMarketplace(lmaNFTMartketplaceAddress);
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
		address /*operator*/,
		address /*from*/,
		uint256 tokenId,
		bytes calldata /*data*/
	) external returns (bytes4 /*functionSelector*/) {
		/// @dev Attempt to reenter acceptNFTOffer function. For testing purposes we assume that we only enter here when acceptingAnNFTOFferWithPermit in the marketplace
		bytes memory fakeSignature = "";
		lmaNFTMarketplace.acceptNFTOfferWithPermit(ERC721WithPermit(msg.sender), tokenId, address(this), type(uint256).max, fakeSignature);
	}

	/// @dev added receive function to accept ether for testing
	receive() external payable {}
}
