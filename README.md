# NFT Marketplace
The NFT Marketplace is a Solidity smart contract that enables users to create listings for their non-fungible tokens (NFTs) and sell them to other users. The contract uses the ERC721 interface to interact with NFTs and provides a simple interface for creating, updating, and cancelling listings.

This marketplace is built and tested using Hardhat Framework

## Dependencies
Install all dependencies by running npm
```
npm install
```
## Hardhat

### Unit tests
In order to run tests use the following command
```
npx hardhat test
```

### Test coverage reports
To generate test coverage reports run the following command
```
npx hardhat coverage
````

Currently the marketplace contract (NFTMarketplace.sol) and the test NFT contract (TestCarsNFT) have 100% coverage. The 
NFTAttacker.sol contract which is used to test reentrancy guards is not fully covered.

### Configuration
Generate a .env file in the root folder with  the following key/values
```
INFURA_PROJECT_ID = {INFURA_PROJECT_ID}
```
### Deployment

Add info about deployment scripts


## Features
- Create new listings for NFTs with a specified price
- Update the price of an existing listing
- Cancel a listing and remove it from the marketplace
- Purchase an NFT from the marketplace by sending the specified price to the seller
- Collect a fee on each purchase, which is sent to a specified fee account

## Usage
To use the NFT Marketplace contract in your own project, you can add it as a dependency in your Solidity code:

```
// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./NFTMarketplace.sol";

contract MyContract {
    NFTMarketplace marketplace;

    constructor(address feeAccount, uint256 feeAmount) {
        marketplace = new NFTMarketplace(feeAccount, feeAmount);
    }

    // Use the marketplace contract in your code
}
```
## Usage
### Creating a Listing
To create a new listing for an NFT, call the createListing function with the following parameters:

- nft - the address of the ERC721 contract that owns the NFT
- tokenId - the ID of the NFT being listed
- price - the price of the NFT in wei
```
function createListing(IERC721 nft, uint256 tokenId, uint256 price) external validPrice(price) notListed(nft, tokenId) onlyNFTOwner(nft, tokenId) onlyApprovedNFTs(nft, tokenId)
```

### Updating a Listing
To update the price of an existing listing, call the updateListingPrice function with the following parameters:

- nft - the address of the ERC721 contract that owns the NFT
- tokenId - the ID of the NFT being listed
- newPrice - the new price of the NFT in wei

```
function updateListingPrice(IERC721 nft, uint256 tokenId, uint256 newPrice) external validPrice(newPrice) listed(nft, tokenId) onlyNFTOwner(nft, tokenId)
```

### Cancelling a Listing
To cancel an existing listing, call the cancelListing function with the following parameters:

- nft - the address of the ERC721 contract that owns the NFT
- tokenId - the ID of the NFT being listed

```
function cancelListing(IERC721 nft, uint256 tokenId) external listed(nft, tokenId) onlyNFTOwner(nft, tokenId)
```

### Purchasing an NFT
To purchase an NFT from the marketplace, send the specified price to the contract using the purchase function with the following parameters:

- nft - the address of the ERC721 contract that owns the NFT
- tokenId - the ID of the NFT being purchased
- javascript
```
function purchase(IERC721 nft, uint256 tokenId) external payable nonReentrant
```

## Future
- Add fee management
- Add support for NFT offers
