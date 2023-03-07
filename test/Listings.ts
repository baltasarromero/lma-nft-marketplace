import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
	NFTMarketplace,
	TestCarsNFT,
	TestCarsNFT__factory,
	NFTMarketplace__factory,
} from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractTransaction } from "@ethersproject/contracts";
import { BytesLike } from "@ethersproject/bytes";
import { BigNumber } from "@ethersproject/bignumber";

describe("NFTMarketplace", function () {
	// Types definition
	type MarketplaceDataWithMintedTokens = {
		nftMarketplace: NFTMarketplace;
		marketPlaceOwner: SignerWithAddress;
		feeDestinationAccount: SignerWithAddress;
		nftLister: SignerWithAddress;
		nftAuctioneer: SignerWithAddress;
		nftBuyer: SignerWithAddress;
		nftBidder: SignerWithAddress;
		testCarsNFT: TestCarsNFT;
		tokenId1: number;
		tokenId2: number;
		tokenId3: number;
	};

	// Global Variables
	const initialFee: number = 100;
	let marketplaceDataWithMintedTokens: MarketplaceDataWithMintedTokens;

	async function deployNFMarketplaceWithAndMintTokensFixture(): Promise<{
		nftMarketplace: NFTMarketplace;
		marketPlaceOwner: SignerWithAddress;
		feeDestinationAccount: SignerWithAddress;
		nftLister: SignerWithAddress;
		nftAuctioneer: SignerWithAddress;
		nftBuyer: SignerWithAddress;
		nftBidder: SignerWithAddress;
		testCarsNFT: TestCarsNFT;
		tokenId1: number;
		tokenId2: number;
		tokenId3: number;
	}> {
		// Contracts are deployed using the first signer/account by default
		const [
			marketPlaceOwner,
			feeDestinationAccount,
			nftLister,
			nftAuctioneer,
			nftBuyer,
			nftBidder,
		] = await ethers.getSigners();

		const NFTMarketplace: NFTMarketplace__factory =
			await ethers.getContractFactory("NFTMarketplace");
		const nftMarketplace: NFTMarketplace = await NFTMarketplace.deploy(
			feeDestinationAccount.address,
			initialFee
		);

		const TestCarsNFT: TestCarsNFT__factory =
			await ethers.getContractFactory("TestCarsNFT");
		const testCarsNFT: TestCarsNFT = await TestCarsNFT.deploy();

		// Mint first NFT to be listed
		const car1URI =
			"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/1.json";

		//const car1URI = "https://ipfs.io/ipfs/QmZf9uxhfD5cxCDTrouBBwW1U9yVq1sSZP1LJTAbciyL7Z";
		const mint1Tx: ContractTransaction = await testCarsNFT.safeMint(
			car1URI,
			nftLister.address
		);
		const mint1TxReceipt = await mint1Tx.wait();
		const tokenId1 = 1;

		// The seller needs to aprove the contract before listing
		await testCarsNFT
			.connect(nftLister)
			.approve(nftMarketplace.address, tokenId1);

		// Mint 2nd Token
		// Mint first NFT to be listed
		const car2URI =
			"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/2.json";

		//const car1URI = "https://ipfs.io/ipfs/QmZf9uxhfD5cxCDTrouBBwW1U9yVq1sSZP1LJTAbciyL7Z";
		const mint2Tx: ContractTransaction = await testCarsNFT.safeMint(
			car1URI,
			nftAuctioneer.address
		);
		const tokenId2 = 2;

		// The seller needs to aprove the contract before listing
		await testCarsNFT
			.connect(nftAuctioneer)
			.approve(nftMarketplace.address, tokenId2);

		// Mint another token but don't approve it
		// Mint first NFT to be listed
		const car3URI =
			"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/3.json";

		await testCarsNFT.safeMint(car3URI, nftLister.address);

		const tokenId3 = 3;

		// Don't approve the Marketplace to sell nft 3

		return {
			nftMarketplace,
			marketPlaceOwner,
			feeDestinationAccount,
			nftLister,
			nftAuctioneer,
			nftBuyer,
			nftBidder,
			testCarsNFT,
			tokenId1,
			tokenId2,
			tokenId3,
		};
	}

	describe("Listings", function () {
		let listing1: any;
		let token3Listing: any;
		const listingPrice = ethers.utils.parseEther("1");
		const listing1StartTimestamp = Math.floor(Date.now() / 1000); // now
		const listing1EndTimestamp = listing1StartTimestamp + 86400 * 10; // 86400 is one day so we create a 10 day listing period

		describe("Create listings", function () {
			this.beforeEach(async function () {
				marketplaceDataWithMintedTokens = await loadFixture(
					deployNFMarketplaceWithAndMintTokensFixture
				);

				listing1 = {
					nft: marketplaceDataWithMintedTokens.testCarsNFT,
					tokenId: marketplaceDataWithMintedTokens.tokenId1,
					seller: marketplaceDataWithMintedTokens.nftLister,
					price: listingPrice,
					startTimestamp: listing1StartTimestamp,
					endTimestamp: listing1EndTimestamp,
				};

				token3Listing = {
					nft: marketplaceDataWithMintedTokens.testCarsNFT,
					tokenId: marketplaceDataWithMintedTokens.tokenId3,
					seller: marketplaceDataWithMintedTokens.nftLister,
					price: listingPrice,
					buyer: ethers.constants.AddressZero,
					startTimestamp: listing1StartTimestamp,
					endTimestamp: listing1EndTimestamp,
				};
			});

			it("Should create a new listing with the expected values and emmit the ListingCreatedEvent", async function () {
				// Check if ListingCreated event was emmited
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(listing1.seller)
						.createListing(
							listing1.nft.address,
							listing1.tokenId,
							listing1.price,
							listing1.startTimestamp,
							listing1.endTimestamp
						)
				)
					.to.emit(
						marketplaceDataWithMintedTokens.nftMarketplace,
						"ListingCreated"
					)
					.withArgs(
						1,
						listing1.nft.address,
						listing1.tokenId,
						listing1.seller.address,
						listing1.price,
						listing1.startTimestamp,
						listing1.endTimestamp
					);

				// There should be 1 listing now
				expect(
					await marketplaceDataWithMintedTokens.nftMarketplace.listingsCount()
				).to.equal(1);
				// Retrieve the token using the key
				const listing1Key = ethers.utils.solidityKeccak256(
					["address", "uint256"],
					[marketplaceDataWithMintedTokens.testCarsNFT.address, 1]
				);

				// Retrieve Listing 1 and validate that all the attributes are properly created
				const retrievedListing1 =
					await marketplaceDataWithMintedTokens.nftMarketplace.listings(
						listing1Key
					);
				expect(retrievedListing1.nft).to.equal(listing1.nft.address);
				expect(retrievedListing1.seller).to.equal(
					listing1.seller.address
				);
				expect(retrievedListing1.tokenId).to.equal(listing1.tokenId);
				expect(retrievedListing1.price).to.equal(listing1.price);
				expect(retrievedListing1.sold).to.be.false;
				expect(retrievedListing1.buyer).to.eq(
					ethers.constants.AddressZero
				);
				expect(retrievedListing1.cancelled).to.be.false;
				expect(retrievedListing1.startTimestamp).to.equal(
					listing1.startTimestamp
				);
				expect(retrievedListing1.endTimestamp).to.equal(
					listing1.endTimestamp
				);
			});

			it("Should not create a new listing if price is zero", async function () {
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(listing1.seller)
						.createListing(
							listing1.nft.address,
							listing1.tokenId,
							ethers.constants.Zero,
							listing1.startTimestamp,
							listing1.endTimestamp
						)
				).to.be.revertedWith("Price must be greater than zero");
			});

			it("should not create a new listing if start timestamp is after end timestamp", async function () {
				const invalidEndTimestamp = listing1.startTimestamp - 86400; // One day before now. This is previous to start and therefore is an invalid endDate

				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(listing1.seller)
						.createListing(
							listing1.nft.address,
							listing1.tokenId,
							listing1.price,
							listing1.startTimestamp,
							invalidEndTimestamp
						)
				).to.be.revertedWith("Invalid timestamps");
			});

			it("Should not create a new listing if the caller is not the owner of the NFT", async function () {
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(marketplaceDataWithMintedTokens.nftBuyer)
						.createListing(
							listing1.nft.address,
							listing1.tokenId,
							listing1.price,
							listing1.startTimestamp,
							listing1.endTimestamp
						)
				).to.be.revertedWith(
					"Must be the owner of the NFT to list in the marketplace"
				);
			});

			it("Should not create a new listing if the contract is not approved to transfer the NFT", async function () {
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(marketplaceDataWithMintedTokens.nftLister)
						.createListing(
							token3Listing.nft.address,
							token3Listing.tokenId,
							token3Listing.price,
							token3Listing.startTimestamp,
							token3Listing.endTimestamp
						)
				).to.be.revertedWith(
					"Marketplace must be approved to transfer the NFT"
				);
			});

			describe("NotInAuctionOrListing modifier", function () {
				it("Should prevent creating a listing for an NFT that is already in a listing", async function () {
					// Create a listing for the NFT
					await marketplaceDataWithMintedTokens.nftMarketplace
						.connect(listing1.seller)
						.createListing(
							listing1.nft.address,
							listing1.tokenId,
							listing1.price,
							listing1.startTimestamp,
							listing1.endTimestamp
						);

					// Try to create another listing for the same NFT
					await expect(
						marketplaceDataWithMintedTokens.nftMarketplace
							.connect(listing1.seller)
							.createListing(
								listing1.nft.address,
								listing1.tokenId,
								listing1.price,
								listing1.startTimestamp,
								listing1.endTimestamp
							)
					).to.be.revertedWith("NFT is already listed");
				});

				it("Should prevent creating a listing for an NFT that is already in an auction", async function () {
					// Create an auction for the NFT
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(listing1.seller)
						.createAuction(
							listing1.nft.address,
							listing1.tokenId,
							listing1.price,
							listing1.startTimestamp,
							listing1.endTimestamp
						);

					// Try to create a listing for the same NFT
					await expect(
						marketplaceDataWithMintedTokens.nftMarketplace
							.connect(listing1.seller)
							.createListing(
								listing1.nft.address,
								listing1.tokenId,
								listing1.price,
								listing1.startTimestamp,
								listing1.endTimestamp
							)
					).to.be.revertedWith("NFT is already listed");
				});

				it("Should allow creating a listing for an NFT that is not in a listing or auction", async function () {
					// Check if ListingCreated event was emmited
					await expect(
						marketplaceDataWithMintedTokens.nftMarketplace
							.connect(listing1.seller)
							.createListing(
								listing1.nft.address,
								listing1.tokenId,
								listing1.price,
								listing1.startTimestamp,
								listing1.endTimestamp
							)
					).to.emit(
						marketplaceDataWithMintedTokens.nftMarketplace,
						"ListingCreated"
					);
				});
			});

			// TODO test missing modifiers
		});

		describe("Cancel listings", function () {
			let listing1Key: BytesLike;

			this.beforeEach(async function () {
				marketplaceDataWithMintedTokens = await loadFixture(
					deployNFMarketplaceWithAndMintTokensFixture
				);

				listing1 = {
					nft: marketplaceDataWithMintedTokens.testCarsNFT,
					tokenId: marketplaceDataWithMintedTokens.tokenId1,
					seller: marketplaceDataWithMintedTokens.nftLister,
					price: listingPrice,
					startTimestamp: listing1StartTimestamp,
					endTimestamp: listing1EndTimestamp,
				};

				token3Listing = {
					nft: marketplaceDataWithMintedTokens.testCarsNFT,
					tokenId: marketplaceDataWithMintedTokens.tokenId3,
					seller: marketplaceDataWithMintedTokens.nftLister,
					price: listingPrice,
					buyer: ethers.constants.AddressZero,
					startTimestamp: listing1StartTimestamp,
					endTimestamp: listing1EndTimestamp,
				};

				const insertTransaction: ContractTransaction =
					await marketplaceDataWithMintedTokens.nftMarketplace
						.connect(listing1.seller)
						.createListing(
							listing1.nft.address,
							listing1.tokenId,
							listing1.price,
							listing1.startTimestamp,
							listing1.endTimestamp
						);
				insertTransaction.wait();

				listing1Key =
					await marketplaceDataWithMintedTokens.nftMarketplace.getKey(
						listing1.nft.address,
						listing1.tokenId
					);
			});

			it("Should cancel a listing", async function () {
				const blockTimestamp: number = (
					await ethers.provider.getBlock("latest")
				).timestamp;
				// Check if ListingCreated event was emitted
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(listing1.seller)
						.cancelListing(listing1Key)
				)
					.to.emit(
						marketplaceDataWithMintedTokens.nftMarketplace,
						"ListingCancelled"
					)
					.withArgs(
						listing1.nft.address,
						listing1.tokenId,
						listing1.seller.address,
						blockTimestamp + 1
					);

				// Check that the listing has been cancelled
				const listing =
					await marketplaceDataWithMintedTokens.nftMarketplace.listings(
						listing1Key
					);
				expect(listing.cancelled).to.be.true;

				// Check that the NFT has been transferred back to the seller
				expect(
					await marketplaceDataWithMintedTokens.testCarsNFT.ownerOf(
						listing1.tokenId
					)
				).to.equal(listing1.seller.address);
			});

			it("Should revert if the listing has already been cancelled", async function () {
				// Cancel the listing
				await marketplaceDataWithMintedTokens.nftMarketplace
					.connect(listing1.seller)
					.cancelListing(listing1Key);

				// Try to cancel the listing again
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(listing1.seller)
						.cancelListing(listing1Key)
				).to.be.revertedWith("Listing is already cancelled");
			});

			it("Should revert if the listing has already ended", async function () {
				// Increase time to be past Listing's end time
				time.increaseTo(listing1.endTimestamp + 1);

				// Try to cancel the listing
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(listing1.seller)
						.cancelListing(listing1Key)
				).to.be.revertedWith("Listing has ended");
			});

			it("Should revert if the caller is not the listing seller", async function () {
				// Try to cancel the listing as the buyer
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(marketplaceDataWithMintedTokens.nftBuyer)
						.cancelListing(listing1Key)
				).to.be.revertedWith("Not the listing seller");
			});
		});

		describe("Update listing price", function () {
			let listing1Key: BytesLike;

			this.beforeEach(async function () {
				marketplaceDataWithMintedTokens = await loadFixture(
					deployNFMarketplaceWithAndMintTokensFixture
				);

				listing1 = {
					nft: marketplaceDataWithMintedTokens.testCarsNFT,
					tokenId: marketplaceDataWithMintedTokens.tokenId1,
					seller: marketplaceDataWithMintedTokens.nftLister,
					price: listingPrice,
					startTimestamp: listing1StartTimestamp,
					endTimestamp: listing1EndTimestamp,
				};

				token3Listing = {
					nft: marketplaceDataWithMintedTokens.testCarsNFT,
					tokenId: marketplaceDataWithMintedTokens.tokenId3,
					seller: marketplaceDataWithMintedTokens.nftLister,
					price: listingPrice,
					buyer: ethers.constants.AddressZero,
					startTimestamp: listing1StartTimestamp,
					endTimestamp: listing1EndTimestamp,
				};

				await marketplaceDataWithMintedTokens.nftMarketplace
					.connect(listing1.seller)
					.createListing(
						listing1.nft.address,
						listing1.tokenId,
						listing1.price,
						listing1.startTimestamp,
						listing1.endTimestamp
					);

				listing1Key =
					await marketplaceDataWithMintedTokens.nftMarketplace.getKey(
						listing1.nft.address,
						listing1.tokenId
					);
			});

			it("Should update the listing price", async function () {
				const blockTimestamp: number = (
					await ethers.provider.getBlock("latest")
				).timestamp;
				const oldPrice = listing1.price;
				const newPrice = ethers.utils.parseEther("2");

				// Check if ListingCreated event was emitted
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(listing1.seller)
						.updateListingPrice(listing1Key, newPrice)
				)
					.to.emit(
						marketplaceDataWithMintedTokens.nftMarketplace,
						"ListingPriceUpdated"
					)
					.withArgs(
						listing1.nft.address,
						listing1.tokenId,
						oldPrice,
						newPrice,
						blockTimestamp + 1
					);
				// Check that the listing price has been updated
				const updatedListing =
					await marketplaceDataWithMintedTokens.nftMarketplace.listings(
						listing1Key
					);
				expect(updatedListing.price).to.equal(newPrice);
			});

			it("Should revert if the new price is the same as the old price", async function () {
				const newPrice = listing1.price;
				// Try to update the listing price with the same price
				// Try to update the listing price
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(listing1.seller)
						.updateListingPrice(listing1Key, newPrice)
				).to.be.revertedWith(
					"New price must be different from current price"
				);
			});

			it("Should revert if the caller is not the seller", async function () {
				const newPrice = ethers.utils.parseEther("2");
				// Try to update the listing price with the same price
				it("Should revert if the caller is not the listing seller", async function () {
					// Try to cancel the listing as the buyer
					await expect(
						marketplaceDataWithMintedTokens.nftMarketplace
							.connect(marketplaceDataWithMintedTokens.nftBuyer)
							.updateListingPrice(listing1Key, newPrice)
					).to.be.revertedWith("Not the listing seller");
				});
			});

			it("Should revert if the listing is already cancelled", async function () {
				// Cancel the listing
				await marketplaceDataWithMintedTokens.nftMarketplace
					.connect(listing1.seller)
					.cancelListing(listing1Key);

				const newPrice = ethers.utils.parseEther("2");
				// Try to update the listing price
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(listing1.seller)
						.updateListingPrice(listing1Key, newPrice)
				).to.be.revertedWith("Listing is already cancelled");
			});

			it("Should revert if the listing is already ended", async function () {
				// Increase time past listings end time
				time.increaseTo(listing1.endTimestamp + 1);
				const newPrice = ethers.utils.parseEther("2");
				// Try to update the listing price
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(listing1.seller)
						.updateListingPrice(listing1Key, newPrice)
				).to.be.revertedWith("Listing has ended");
			});
		});

		describe("Purchase NFTs", function () {
			let listing1Key: BytesLike;

			this.beforeEach(async function () {
				marketplaceDataWithMintedTokens = await loadFixture(
					deployNFMarketplaceWithAndMintTokensFixture
				);

				listing1 = {
					nft: marketplaceDataWithMintedTokens.testCarsNFT,
					tokenId: marketplaceDataWithMintedTokens.tokenId1,
					seller: marketplaceDataWithMintedTokens.nftLister,
					price: listingPrice,
					startTimestamp: listing1StartTimestamp,
					endTimestamp: listing1EndTimestamp,
				};

				token3Listing = {
					nft: marketplaceDataWithMintedTokens.testCarsNFT,
					tokenId: marketplaceDataWithMintedTokens.tokenId3,
					seller: marketplaceDataWithMintedTokens.nftLister,
					price: listingPrice,
					buyer: ethers.constants.AddressZero,
					startTimestamp: listing1StartTimestamp,
					endTimestamp: listing1EndTimestamp,
				};

				await marketplaceDataWithMintedTokens.nftMarketplace
					.connect(listing1.seller)
					.createListing(
						listing1.nft.address,
						listing1.tokenId,
						listing1.price,
						listing1.startTimestamp,
						listing1.endTimestamp
					);

				listing1Key =
					await marketplaceDataWithMintedTokens.nftMarketplace.getKey(
						listing1.nft.address,
						listing1.tokenId
					);
			});

			it("Should allow a buyer to purchase a listing", async function () {
				const blockTimestamp: number = (
					await ethers.provider.getBlock("latest")
				).timestamp;

				const previousBalance = await ethers.provider.getBalance(
					listing1.seller.address
				);

				// Check if ListingCreated event was emitted
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(marketplaceDataWithMintedTokens.nftBuyer)
						.purchase(listing1Key, { value: listing1.price })
				)
					.to.emit(
						marketplaceDataWithMintedTokens.nftMarketplace,
						"Purchase"
					)
					.withArgs(
						listing1.nft.address,
						listing1.tokenId,
						listing1.seller.address,
						marketplaceDataWithMintedTokens.nftBuyer.address,
						listing1.price,
						blockTimestamp + 1
					);

				// Retrieve listing and check values
				const purchasedListing =
					await marketplaceDataWithMintedTokens.nftMarketplace.listings(
						listing1Key
					);
				// Check that the listing is marked as sold
				expect(purchasedListing.sold).to.be.true;
				// Check that the NFT was transferred
				expect(await listing1.nft.ownerOf(listing1.tokenId)).to.equal(
					marketplaceDataWithMintedTokens.nftBuyer.address
				);
				// Seller's balance should be increased by the listing price
				expect(
					await ethers.provider.getBalance(listing1.seller.address)
				).to.equal(previousBalance.add(listing1.price));
			});

			it("Should not allow a buyer to purchase a cancelled listing", async function () {
				// Cancel the listing
				await marketplaceDataWithMintedTokens.nftMarketplace
					.connect(listing1.seller)
					.cancelListing(listing1Key);

				// Try to cancel the listing again
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(marketplaceDataWithMintedTokens.nftBuyer)
						.purchase(listing1Key, { value: listing1.price })
				).to.be.revertedWith("Listing is already cancelled");
			});

			it("Should not allow a buyer to purchase a listing with insufficient funds", async function () {
				// Buyer will pay half of the price
				const valuePaid: BigNumber = BigNumber.from(listing1.price).div(
					2
				);

				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(marketplaceDataWithMintedTokens.nftBuyer)
						.purchase(listing1Key, { value: valuePaid })
				).to.be.revertedWith("Insufficient funds to purchase NFT");
			});

			it("Should not allow a buyer to purchase a listing before the start time", async function () {
				// The seller needs to aprove the contract before listing
				await marketplaceDataWithMintedTokens.testCarsNFT
					.connect(marketplaceDataWithMintedTokens.nftLister)
					.approve(
						marketplaceDataWithMintedTokens.nftMarketplace.address,
						marketplaceDataWithMintedTokens.tokenId3
					);

				const futureListing = {
					nft: marketplaceDataWithMintedTokens.testCarsNFT,
					tokenId: marketplaceDataWithMintedTokens.tokenId3,
					seller: marketplaceDataWithMintedTokens.nftLister,
					price: listingPrice,
					buyer: ethers.constants.AddressZero,
					startTimestamp: Math.floor(Date.now() / 1000) + 86400,
					endTimestamp: Math.floor(Date.now() / 1000) + 86400 * 10,
				};

				await marketplaceDataWithMintedTokens.nftMarketplace
					.connect(futureListing.seller)
					.createListing(
						futureListing.nft.address,
						futureListing.tokenId,
						futureListing.price,
						futureListing.startTimestamp,
						futureListing.endTimestamp
					);

				const futureListingkey: BytesLike =
					await marketplaceDataWithMintedTokens.nftMarketplace.getKey(
						futureListing.nft.address,
						futureListing.tokenId
					);

				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(marketplaceDataWithMintedTokens.nftBuyer)
						.purchase(futureListingkey, {
							value: futureListing.price,
						})
				).to.be.revertedWith("Listing hasn't started yet");
			});

			it("Should not allow a buyer to purchase a listing after the end time", async function () {
				// Increase time past the listings end time
				time.increaseTo(listing1.endTimestamp + 1);
				// Try to cancel the listing again
				await expect(
					marketplaceDataWithMintedTokens.nftMarketplace
						.connect(marketplaceDataWithMintedTokens.nftBuyer)
						.purchase(listing1Key, { value: listing1.price })
				).to.be.revertedWith("Listing has ended");
			});

			it("Should not allow the seller to purchase their own listing", async function () {
					// Try to cancel the listing again
					await expect(
						marketplaceDataWithMintedTokens.nftMarketplace
							.connect(listing1.seller)
							.purchase(listing1Key, { value: listing1.price })
					).to.be.revertedWith("Seller can't call this function");
			});
		});
	});
});
