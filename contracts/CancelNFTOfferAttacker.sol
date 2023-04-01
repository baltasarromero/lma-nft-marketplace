// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./NFTMarketplace.sol";
import '@openzeppelin/contracts/token/ERC721/ERC721.sol';

contract CancelNFTOfferAttacker {
	NFTMarketplace public lmaNFTMarketplace;
	address private immutable marketplaceAddress = 0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6;


	constructor(address lmaNFTMartketplaceAddress) {
		lmaNFTMarketplace = NFTMarketplace(lmaNFTMartketplaceAddress);
	}

	/// @dev added receive function to accept ether for testing
	receive() external payable {
		console.log("hi from COA", msg.sender);
	
		// Check if the message sender is the Marketplace
		if (msg.sender == address(0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6)) {
			console.log("trying to attack cancel nft offer", msg.sender);
			console.log("contract address", address(lmaNFTMarketplace));
			// Try to reenter cancelNFTOffer function
			// We don't care about the arguments as we are just trying to trigger the nonreentrant modifier
			lmaNFTMarketplace.cancelNFTOffer(ERC721(address(0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512)), 1);
		} 	else {
			console.log("not equal");
		}	
	}
}
