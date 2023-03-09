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
import { BytesLike } from "@ethersproject/bytes";
import { BigNumber } from "@ethersproject/bignumber";

const hre = require("hardhat");

describe("NFTMarketplace", function () {
	// Types definition
	type MarketplaceDataForListing = {
		nftMarketplace: NFTMarketplace;
		marketPlaceOwner: SignerWithAddress;
		feeDestinationAccount: SignerWithAddress;
		nftLister: SignerWithAddress;
		nftBuyer: SignerWithAddress;
		testCarsNFT: TestCarsNFT;
		token1Listing: Listing;
		token3Listing: Listing;
	};

	type Listing = {
		listingKey: BytesLike;
		nft: TestCarsNFT;
		tokenId: number;
		seller: SignerWithAddress;
		price: BigNumber;
		startTimestamp: BigNumber;
		endTimestamp: BigNumber;
	};

	// Global Variables
	const initialFee: number = 100;
	let marketplaceDataForListing: MarketplaceDataForListing;
	// Mint first NFT to be listed
	const CAR_1_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/1.json";
	const CAR_2_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/2.json";
	const CAR_3_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/3.json";

	async function deployNFMarketplaceAndMintTokensFixture(): Promise<MarketplaceDataForListing> {
		// Contracts are deployed using the first signer/account by default
		const [
			marketPlaceOwner,
			feeDestinationAccount,
			nftLister,
			nftAuctioneer,
			nftBuyer,
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

		await testCarsNFT.safeMint(CAR_1_METADATA_URI, nftLister.address);
		const tokenId1: number = 1;

		// The seller needs to approve the contract before listing
		await testCarsNFT
			.connect(nftLister)
			.approve(nftMarketplace.address, tokenId1);

		// Mint 2nd Token
		// Mint first NFT to be listed
		await testCarsNFT.safeMint(CAR_2_METADATA_URI, nftAuctioneer.address);
		const tokenId2: number = 2;

		// The seller needs to aprove the contract before listing
		await testCarsNFT
			.connect(nftAuctioneer)
			.approve(nftMarketplace.address, tokenId2);

		// Mint another token but don't approve it
		// Mint third NFT to be listed
		await testCarsNFT.safeMint(CAR_3_METADATA_URI, nftLister.address);
		const tokenId3: number = 3;
		// Don't approve the Marketplace to sell nft 3

		// Define listing price
		const listingPrice: BigNumber = ethers.utils.parseEther("1");

		// Define listing timestamps
		
		const listingStartTimestamp: BigNumber = BigNumber.from(
			(await ethers.provider.getBlock("latest")).timestamp
		);
		const listingEndTimestamp: BigNumber = listingStartTimestamp.add(
			86400 * 10
		); // 86400 is one day so we create a 10 day listing period

		// Calculate listing key
		const listing1Key: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 1]
		);

		const token1Listing: Listing = {
			listingKey: listing1Key,
			nft: testCarsNFT,
			tokenId: tokenId1,
			seller: nftLister,
			price: listingPrice,
			startTimestamp: listingStartTimestamp,
			endTimestamp: listingEndTimestamp,
		};

		// Calculate listing key
		const listing3Key: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 3]
		);

		const token3Listing: Listing = {
			listingKey: listing3Key,
			nft: testCarsNFT,
			tokenId: tokenId3,
			seller: nftLister,
			price: listingPrice,
			startTimestamp: listingStartTimestamp,
			endTimestamp: listingEndTimestamp,
		};

		return {
			nftMarketplace,
			marketPlaceOwner,
			feeDestinationAccount,
			nftLister,
			nftBuyer,
			testCarsNFT,
			token1Listing,
			token3Listing,
		};
	}

	describe("Listings", function () {
		describe("Create listings", function () {
			let listing1: Listing;

			this.beforeEach(async function () {
				marketplaceDataForListing = await loadFixture(
					deployNFMarketplaceAndMintTokensFixture
				);

				listing1 = marketplaceDataForListing.token1Listing;
			});

			it("Should create a new listing with the expected values and emit the ListingCreatedEvent", async function () {
				// Check if ListingCreated event was emitted
				await expect(
					marketplaceDataForListing.nftMarketplace
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
						marketplaceDataForListing.nftMarketplace,
						"ListingCreated"
					)
					.withArgs(
						listing1.nft.address,
						listing1.tokenId,
						listing1.seller.address,
						listing1.price,
						listing1.startTimestamp,
						listing1.endTimestamp
					);

				// There should be 1 listing now
				expect(
					await marketplaceDataForListing.nftMarketplace.listingsCount()
				).to.equal(1);

				// Retrieve Listing 1 and validate that all the attributes are properly created
				const retrievedListing1 =
					await marketplaceDataForListing.nftMarketplace.listings(
						listing1.listingKey
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
					marketplaceDataForListing.nftMarketplace
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

			it("Should not create a new listing if start timestamp is after end timestamp", async function () {
				// New start time
				const invalidStart: BigNumber = listing1.startTimestamp.add(
					86400 * 2
				); // add two days
				const invalidEnd: BigNumber =
					listing1.startTimestamp.add(86400); // add one day

				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.createListing(
							listing1.nft.address,
							listing1.tokenId,
							listing1.price,
							invalidStart,
							invalidEnd
						)
				).to.be.revertedWith("Invalid timestamps");
			});

			it("Should not create a new lsiting if start timestamp is 0", async function () {
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.createListing(
							listing1.nft.address,
							listing1.tokenId,
							listing1.price,
							ethers.constants.Zero,
							listing1.endTimestamp
						)
				).to.be.revertedWith("Invalid timestamps");
			});

			it("Should not create a new listing if end timestamp is in the past", async function () {
				// Current timestamp
				const blockTimestamp: number = (
					await ethers.provider.getBlock("latest")
				).timestamp;

				const invalidEndTimestamp: BigNumber =
					BigNumber.from(blockTimestamp).sub(86400); // One day before now. This is an invalid end timestamp

				await expect(
					marketplaceDataForListing.nftMarketplace
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
				const listing1: Listing =
					marketplaceDataForListing.token1Listing;
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftBuyer)
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
				const unapprovedListing: Listing =
					marketplaceDataForListing.token3Listing;
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftLister)
						.createListing(
							unapprovedListing.nft.address,
							unapprovedListing.tokenId,
							unapprovedListing.price,
							unapprovedListing.startTimestamp,
							unapprovedListing.endTimestamp
						)
				).to.be.revertedWith(
					"Marketplace must be approved to transfer the NFT"
				);
			});

			describe("NotInAuctionOrListing modifier", function () {
				it("Should prevent creating a listing for an NFT that is already in a listing", async function () {
					const listing1: Listing =
						marketplaceDataForListing.token1Listing;
					// Create a listing for the NFT
					await marketplaceDataForListing.nftMarketplace
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
						marketplaceDataForListing.nftMarketplace
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
					const listing1: Listing =
						marketplaceDataForListing.token1Listing;
					// Create an auction for the NFT
					marketplaceDataForListing.nftMarketplace
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
						marketplaceDataForListing.nftMarketplace
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
					const listing1: Listing =
						marketplaceDataForListing.token1Listing;
					// Check if ListingCreated event was emmited
					await expect(
						marketplaceDataForListing.nftMarketplace
							.connect(listing1.seller)
							.createListing(
								listing1.nft.address,
								listing1.tokenId,
								listing1.price,
								listing1.startTimestamp,
								listing1.endTimestamp
							)
					).to.emit(
						marketplaceDataForListing.nftMarketplace,
						"ListingCreated"
					);
				});
			});
		});

		describe("Cancel listings", function () {
			let listing1: Listing;

			this.beforeEach(async function () {
				marketplaceDataForListing = await loadFixture(
					deployNFMarketplaceAndMintTokensFixture
				);

				listing1 = marketplaceDataForListing.token1Listing;

				// List token 1
				await marketplaceDataForListing.nftMarketplace
					.connect(listing1.seller)
					.createListing(
						listing1.nft.address,
						listing1.tokenId,
						listing1.price,
						listing1.startTimestamp,
						listing1.endTimestamp
					);
			});

			it("Should cancel a listing", async function () {
				const blockTimestamp: number = (
					await ethers.provider.getBlock("latest")
				).timestamp;
				// Check if ListingCancelled event was emitted
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.cancelListing(listing1.listingKey)
				)
					.to.emit(
						marketplaceDataForListing.nftMarketplace,
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
					await marketplaceDataForListing.nftMarketplace.listings(
						listing1.listingKey
					);
				expect(listing.cancelled).to.be.true;

				// Check that the NFT has been transferred back to the seller
				expect(
					await marketplaceDataForListing.testCarsNFT.ownerOf(
						listing1.tokenId
					)
				).to.equal(listing1.seller.address);
			});

			it("Should revert if the listing has already been cancelled", async function () {
				// Cancel the listing
				await marketplaceDataForListing.nftMarketplace
					.connect(listing1.seller)
					.cancelListing(listing1.listingKey);

				// Try to cancel the listing again
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.cancelListing(listing1.listingKey)
				).to.be.revertedWith("Listing is already cancelled");
			});

			it("Should revert if the listing has already ended", async function () {
				// Increase time to be past Listing's end time
				time.increaseTo(listing1.endTimestamp.add(1));

				// Try to cancel the listing
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.cancelListing(listing1.listingKey)
				).to.be.revertedWith("Listing has ended");
			});

			it("Should revert if the caller is not the listing seller", async function () {
				// Try to cancel the listing as the buyer
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftBuyer)
						.cancelListing(listing1.listingKey)
				).to.be.revertedWith("Not the listing seller");
			});
		});

		describe("Update listing price", function () {
			let listing1: Listing;

			this.beforeEach(async function () {
				marketplaceDataForListing = await loadFixture(
					deployNFMarketplaceAndMintTokensFixture
				);

				listing1 = marketplaceDataForListing.token1Listing;

				await marketplaceDataForListing.nftMarketplace
					.connect(listing1.seller)
					.createListing(
						listing1.nft.address,
						listing1.tokenId,
						listing1.price,
						listing1.startTimestamp,
						listing1.endTimestamp
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
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.updateListingPrice(listing1.listingKey, newPrice)
				)
					.to.emit(
						marketplaceDataForListing.nftMarketplace,
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
					await marketplaceDataForListing.nftMarketplace.listings(
						listing1.listingKey
					);
				expect(updatedListing.price).to.equal(newPrice);
			});

			it("Should revert if the new price is the same as the old price", async function () {
				// Try to update the listing price with the same price
				// Try to update the listing price
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.updateListingPrice(listing1.listingKey, listing1.price)
				).to.be.revertedWith(
					"New price must be different from current price"
				);
			});

			it("Should revert if the listing is already cancelled", async function () {
				// Cancel the listing
				await marketplaceDataForListing.nftMarketplace
					.connect(listing1.seller)
					.cancelListing(listing1.listingKey);

				const newPrice = ethers.utils.parseEther("2");
				// Try to update the listing price
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.updateListingPrice(listing1.listingKey, newPrice)
				).to.be.revertedWith("Listing is already cancelled");
			});

			it("Should revert if the listing is already ended", async function () {
				// Increase time past listings end time
				time.increaseTo(listing1.endTimestamp.add(1));
				const newPrice = ethers.utils.parseEther("2");
				// Try to update the listing price
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.updateListingPrice(listing1.listingKey, newPrice)
				).to.be.revertedWith("Listing has ended");
			});

			it("Should revert if the caller is not the seller", async function () {
				const newPrice = ethers.utils.parseEther("2");
				// Try to cancel the listing as the buyer
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftBuyer)
						.updateListingPrice(listing1.listingKey, newPrice)
				).to.be.revertedWith("Not the listing seller");
			});
		});

		describe("Purchase NFTs", function () {
			let listing1: Listing;

			this.beforeEach(async function () {
				marketplaceDataForListing = await loadFixture(
					deployNFMarketplaceAndMintTokensFixture
				);

				listing1 = marketplaceDataForListing.token1Listing;

				await marketplaceDataForListing.nftMarketplace
					.connect(listing1.seller)
					.createListing(
						listing1.nft.address,
						listing1.tokenId,
						listing1.price,
						listing1.startTimestamp,
						listing1.endTimestamp
					);
			});

			it("Should allow a buyer to purchase a listing", async function () {
				const blockTimestamp: number = (
					await ethers.provider.getBlock("latest")
				).timestamp;

				const sellerPreviousBalance = await ethers.provider.getBalance(
					listing1.seller.address
				);

				// Check if ListingCreated event was emitted
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftBuyer)
						.purchase(listing1.listingKey, {
							value: listing1.price,
						})
				)
					.to.emit(
						marketplaceDataForListing.nftMarketplace,
						"Purchase"
					)
					.withArgs(
						listing1.nft.address,
						listing1.tokenId,
						listing1.seller.address,
						marketplaceDataForListing.nftBuyer.address,
						listing1.price,
						blockTimestamp + 1
					);

				// Retrieve listing and check values
				const purchasedListing =
					await marketplaceDataForListing.nftMarketplace.listings(
						listing1.listingKey
					);
				// Check that the listing is marked as sold
				expect(purchasedListing.sold).to.be.true;
				// Check that the NFT was transferred
				expect(await listing1.nft.ownerOf(listing1.tokenId)).to.equal(
					marketplaceDataForListing.nftBuyer.address
				);
				// Seller's balance should be increased by the listing price
				expect(
					await ethers.provider.getBalance(listing1.seller.address)
				).to.equal(sellerPreviousBalance.add(listing1.price));
			});

			it("Should not allow a buyer to purchase a cancelled listing", async function () {
				// Cancel the listing
				await marketplaceDataForListing.nftMarketplace
					.connect(listing1.seller)
					.cancelListing(listing1.listingKey);

				// Try to cancel the listing again
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftBuyer)
						.purchase(listing1.listingKey, {
							value: listing1.price,
						})
				).to.be.revertedWith("Listing is already cancelled");
			});

			it("Should not allow a buyer to purchase a listing with insufficient funds", async function () {
				// Buyer will pay half of the price
				const valuePaid: BigNumber = BigNumber.from(listing1.price).div(
					2
				);

				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftBuyer)
						.purchase(listing1.listingKey, { value: valuePaid })
				).to.be.revertedWith("Insufficient funds to purchase NFT");
			});

			it("Should not allow a buyer to purchase a listing before the start time", async function () {
				// The seller needs to approve the Marketplace before listing
				await marketplaceDataForListing.testCarsNFT
					.connect(marketplaceDataForListing.nftLister)
					.approve(
						marketplaceDataForListing.nftMarketplace.address,
						marketplaceDataForListing.token3Listing.tokenId
					);

				const futureListing = marketplaceDataForListing.token3Listing;

				futureListing.startTimestamp = BigNumber.from(
					(await ethers.provider.getBlock("latest")).timestamp
				).add(86400);
				futureListing.endTimestamp = BigNumber.from(
					(await ethers.provider.getBlock("latest")).timestamp
				).add(86400 * 10);
		


				await marketplaceDataForListing.nftMarketplace
					.connect(futureListing.seller)
					.createListing(
						futureListing.nft.address,
						futureListing.tokenId,
						futureListing.price,
						futureListing.startTimestamp,
						futureListing.endTimestamp
					);

				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftBuyer)
						.purchase(futureListing.listingKey, {
							value: futureListing.price,
						})
				).to.be.revertedWith("Listing hasn't started yet");
			});

			it("Should not allow a buyer to purchase a listing after the end time", async function () {
				// Increase time past the listings end time
				time.increaseTo(listing1.endTimestamp.add(1));
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftBuyer)
						.purchase(listing1.listingKey, {
							value: listing1.price,
						})
				).to.be.revertedWith("Listing has ended");
			});

			it("Should not allow the seller to purchase their own listing", async function () {
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.purchase(listing1.listingKey, {
							value: listing1.price,
						})
				).to.be.revertedWith("Seller can't call this function");
			});
		});
	});
});
