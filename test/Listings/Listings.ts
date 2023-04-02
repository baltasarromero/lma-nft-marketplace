import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
	NFTMarketplace,
	TestCarsNFT,
	TestCarsNFT__factory,
	NFTMarketplace__factory,
	PurchaseListingAttacker,
	PurchaseListingAttacker__factory,
} from "../../typechain-types";
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
		approvedListing: Listing;
		unapprovedListing: Listing;
		purchaseListingAttacker: PurchaseListingAttacker;
	};

	type Listing = {
		listingKey: BytesLike;
		nft: TestCarsNFT;
		tokenId: number;
		seller: SignerWithAddress;
		price: BigNumber;
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
		const [marketPlaceOwner, feeDestinationAccount, nftLister, nftBuyer] =
			await ethers.getSigners();

		const NFTMarketplace: NFTMarketplace__factory = await ethers.getContractFactory(
			"NFTMarketplace"
		);
		const nftMarketplace: NFTMarketplace = await NFTMarketplace.deploy();

		const TestCarsNFT: TestCarsNFT__factory = await ethers.getContractFactory("TestCarsNFT");
		const testCarsNFT: TestCarsNFT = await TestCarsNFT.deploy();

		await testCarsNFT.safeMint(CAR_1_METADATA_URI, nftLister.address);
		const approvedTokenId: number = 1;

		// The seller needs to approve the contract before listing
		await testCarsNFT.connect(nftLister).approve(nftMarketplace.address, approvedTokenId);

		// Mint another token but don't approve it
		// Mint third NFT to be listed
		await testCarsNFT.safeMint(CAR_3_METADATA_URI, nftLister.address);
		const unapprovedTokenId: number = 2;
		// Don't approve the Marketplace to sell nft 2

		// Mint another nft that will be used for the reentrancy attack test
		// Mint third NFT to be listed
		await testCarsNFT.safeMint(CAR_3_METADATA_URI, nftLister.address);
		const attackedTokenId: number = 3;

		// The seller needs to approve the contract before listing
		await testCarsNFT.connect(nftLister).approve(nftMarketplace.address, attackedTokenId);

		// Deploy PurchaseListingAttacker contract
		const PurchaseListingAttacker: PurchaseListingAttacker__factory =
			await ethers.getContractFactory("PurchaseListingAttacker");
		const purchaseListingAttacker: PurchaseListingAttacker =
			await PurchaseListingAttacker.deploy(nftMarketplace.address);

		// Define listing price
		const listingPrice: BigNumber = ethers.utils.parseEther("1");

		// Calculate listing key
		const approvedListingKey: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 1]
		);

		const approvedListing: Listing = {
			listingKey: approvedListingKey,
			nft: testCarsNFT,
			tokenId: approvedTokenId,
			seller: nftLister,
			price: listingPrice,
		};

		// Calculate listing key
		const unapprovedListingKey: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 2]
		);

		const unapprovedListing: Listing = {
			listingKey: unapprovedListingKey,
			nft: testCarsNFT,
			tokenId: unapprovedTokenId,
			seller: nftLister,
			price: listingPrice,
		};

		// Calculate listing key
		const attackedListingKey: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 3]
		);

		const attackedListing: Listing = {
			listingKey: attackedListingKey,
			nft: testCarsNFT,
			tokenId: attackedTokenId,
			seller: nftLister,
			price: listingPrice,
		};

		return {
			nftMarketplace,
			marketPlaceOwner,
			feeDestinationAccount,
			nftLister,
			nftBuyer,
			testCarsNFT,
			approvedListing: approvedListing,
			unapprovedListing: unapprovedListing,
			purchaseListingAttacker,
		};
	}

	describe("Listings", function () {
		describe("Create listings", function () {
			let listing1: Listing;

			this.beforeEach(async function () {
				marketplaceDataForListing = await loadFixture(
					deployNFMarketplaceAndMintTokensFixture
				);

				listing1 = marketplaceDataForListing.approvedListing;
			});

			it("Should create a new listing with the expected values and emit the ListingCreatedEvent", async function () {
				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;
				// NFMarketplace is already approved to transfer the NFT
				// Check if ListingCreated event was emitted
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.createListing(listing1.nft.address, listing1.tokenId, listing1.price)
				)
					.to.emit(marketplaceDataForListing.nftMarketplace, "ListingCreated")
					.withArgs(
						listing1.nft.address,
						listing1.tokenId,
						listing1.seller.address,
						listing1.price,
						blockTimestamp + 1
					);

				// There should be 1 listing now
				//expect(await marketplaceDataForListing.nftMarketplace.listingsCount()).to.equal(1);

				// Retrieve Listing 1 and validate that all the attributes are properly created
				const listing1Price = await marketplaceDataForListing.nftMarketplace.listings(
					listing1.listingKey
				);
				expect(listing1Price).to.equal(listing1.price);
			});

			it("Should create a new listing with the expected values and emit the ListingCreatedEvent when the marketplace is approvedForAll", async function () {
				const unapprovedListing: Listing = marketplaceDataForListing.unapprovedListing;
				const nftSeller: SignerWithAddress = unapprovedListing.seller;

				// Approve NFT Marketplace
				await marketplaceDataForListing.testCarsNFT
					.connect(nftSeller)
					.setApprovalForAll(marketplaceDataForListing.nftMarketplace.address, true);

				// Get current timestamp
				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;

				// Check if ListingCreated event was emitted
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(nftSeller)
						.createListing(
							unapprovedListing.nft.address,
							unapprovedListing.tokenId,
							unapprovedListing.price
						)
				)
					.to.emit(marketplaceDataForListing.nftMarketplace, "ListingCreated")
					.withArgs(
						unapprovedListing.nft.address,
						unapprovedListing.tokenId,
						unapprovedListing.seller.address,
						unapprovedListing.price,
						blockTimestamp + 1
					);

				// There should be 1 listing now
				//expect(await marketplaceDataForListing.nftMarketplace.listingsCount()).to.equal(1);

				// Retrieve Listing 1 and validate that all the attributes are properly created
				const unapprovedListingPrice =
					await marketplaceDataForListing.nftMarketplace.listings(
						unapprovedListing.listingKey
					);
				expect(unapprovedListingPrice).to.equal(unapprovedListing.price);
			});

			it("Should not create a new listing if price is zero", async function () {
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.createListing(
							listing1.nft.address,
							listing1.tokenId,
							ethers.constants.Zero
						)
				).to.be.revertedWith("Invalid price. Needs to be above zero.");
			});

			it("Should not create a new listing if the caller is not the owner of the NFT", async function () {
				const listing1: Listing = marketplaceDataForListing.approvedListing;
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftBuyer)
						.createListing(listing1.nft.address, listing1.tokenId, listing1.price)
				).to.be.revertedWith("Not the NFT owner");
			});

			it("Should not create a new listing if the marketplace is not approved to transfer the NFT", async function () {
				const unapprovedListing: Listing = marketplaceDataForListing.unapprovedListing;
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftLister)
						.createListing(
							unapprovedListing.nft.address,
							unapprovedListing.tokenId,
							unapprovedListing.price
						)
				).to.be.revertedWith(
					"Marketplace must be approved or approvedForAll to transfer the NFT"
				);
			});

			it("Should prevent creating a listing for an NFT that is already in a listing", async function () {
				const listing1: Listing = marketplaceDataForListing.approvedListing;
				// Create a listing for the NFT
				await marketplaceDataForListing.nftMarketplace
					.connect(listing1.seller)
					.createListing(listing1.nft.address, listing1.tokenId, listing1.price);

				// Try to create another listing for the same NFT
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.createListing(listing1.nft.address, listing1.tokenId, listing1.price)
				).to.be.revertedWith("NFT is already listed");
			});

			/* it("Should prevent creating a listing for an NFT that is already in an auction", async function () {
				const listing1: Listing = marketplaceDataForListing.token1Listing;
				// Create an auction for the NFT
				marketplaceDataForListing.nftMarketplace
					.connect(listing1.seller)
					.createAuction(
						listing1.nft.address,
						listing1.tokenId,
						listing1.price
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

			it("Should allow creating a listing for an NFT that is not listed", async function () {
				const listing1: Listing = marketplaceDataForListing.token1Listing;
				// Check if ListingCreated event was emmited
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.createListing(
							listing1.nft.address,
							listing1.tokenId,
							listing1.price
						)
				).to.emit(marketplaceDataForListing.nftMarketplace, "ListingCreated");
			});*/
		});

		describe("Cancel listings", function () {
			let listing1: Listing;

			this.beforeEach(async function () {
				marketplaceDataForListing = await loadFixture(
					deployNFMarketplaceAndMintTokensFixture
				);

				listing1 = marketplaceDataForListing.approvedListing;

				// List token 1
				await marketplaceDataForListing.nftMarketplace
					.connect(listing1.seller)
					.createListing(listing1.nft.address, listing1.tokenId, listing1.price);
			});

			it("Should cancel a listing", async function () {
				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;
				//const previousListingsCount: BigNumber =
				//	await marketplaceDataForListing.nftMarketplace.listingsCount();

				// Check if ListingCancelled event was emitted
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.cancelListing(listing1.nft.address, listing1.tokenId)
				)
					.to.emit(marketplaceDataForListing.nftMarketplace, "ListingCancelled")
					.withArgs(
						listing1.nft.address,
						listing1.tokenId,
						listing1.seller.address,
						blockTimestamp + 1
					);

				// Check that the listing has been cancelled. Price should be 0 because the listing was deleted
				const listingPrice = await marketplaceDataForListing.nftMarketplace.listings(
					listing1.listingKey
				);
				// Given the listing was deleted all the attributes should be set to their default value
				expect(listingPrice).to.equal(ethers.constants.Zero);

				// Check that the seller is still the owner of the NFT
				expect(
					await marketplaceDataForListing.testCarsNFT.ownerOf(listing1.tokenId)
				).to.equal(listing1.seller.address);

				// Check that the number of listings has decreased
				//expect(await marketplaceDataForListing.nftMarketplace.listingsCount()).to.equal(
				//	previousListingsCount.sub(1)
				//);
			});

			it("Should revert if the listing has already been cancelled", async function () {
				// Cancel the listing
				await marketplaceDataForListing.nftMarketplace
					.connect(listing1.seller)
					.cancelListing(listing1.nft.address, listing1.tokenId);

				// Try to cancel the listing again
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.cancelListing(listing1.nft.address, listing1.tokenId)
				).to.be.revertedWith("NFT is not listed");
			});

			it("Should revert if the caller is not the listing seller", async function () {
				// Try to cancel the listing as the buyer
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftBuyer)
						.cancelListing(listing1.nft.address, listing1.tokenId)
				).to.be.revertedWith("Not the NFT owner");
			});
		});

		describe("Update listing price", function () {
			let listing1: Listing;

			this.beforeEach(async function () {
				marketplaceDataForListing = await loadFixture(
					deployNFMarketplaceAndMintTokensFixture
				);

				listing1 = marketplaceDataForListing.approvedListing;

				await marketplaceDataForListing.nftMarketplace
					.connect(listing1.seller)
					.createListing(listing1.nft.address, listing1.tokenId, listing1.price);
			});

			it("Should update the listing price", async function () {
				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;
				const oldPrice = listing1.price;
				const newPrice = ethers.utils.parseEther("2");

				// Check if ListingCreated event was emitted
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.updateListingPrice(listing1.nft.address, listing1.tokenId, newPrice)
				)
					.to.emit(marketplaceDataForListing.nftMarketplace, "ListingPriceUpdated")
					.withArgs(
						listing1.nft.address,
						listing1.tokenId,
						oldPrice,
						newPrice,
						blockTimestamp + 1
					);
				// Check that the listing price has been updated
				const updatedListingPrice = await marketplaceDataForListing.nftMarketplace.listings(
					listing1.listingKey
				);
				expect(updatedListingPrice).to.equal(newPrice);
			});

			it("Should revert if the new price is the same as the old price", async function () {
				// Try to update the listing price with the same price
				// Try to update the listing price
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.updateListingPrice(listing1.nft.address, listing1.tokenId, listing1.price)
				).to.be.revertedWith("New price must be different from current price");
			});

			it("Should revert if the listing is already cancelled", async function () {
				// Cancel the listing
				await marketplaceDataForListing.nftMarketplace
					.connect(listing1.seller)
					.cancelListing(listing1.nft.address, listing1.tokenId);

				const newPrice = ethers.utils.parseEther("2");
				// Try to update the listing price
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.updateListingPrice(listing1.nft.address, listing1.tokenId, newPrice)
				).to.be.revertedWith("NFT is not listed");
			});

			it("Should revert if the caller is not the NFT Owner", async function () {
				const newPrice = ethers.utils.parseEther("2");
				// Try to cancel the listing as the buyer
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftBuyer)
						.updateListingPrice(listing1.nft.address, listing1.tokenId, newPrice)
				).to.be.revertedWith("Not the NFT owner");
			});

			it("Should revert if the new price is 0", async function () {
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.updateListingPrice(
							listing1.nft.address,
							listing1.tokenId,
							ethers.constants.Zero
						)
				).to.be.revertedWith("Invalid price. Needs to be above zero.");
			});
		});

		describe("Purchase NFTs", function () {
			let listing1: Listing;

			this.beforeEach(async function () {
				marketplaceDataForListing = await loadFixture(
					deployNFMarketplaceAndMintTokensFixture
				);

				listing1 = marketplaceDataForListing.approvedListing;

				await marketplaceDataForListing.nftMarketplace
					.connect(listing1.seller)
					.createListing(listing1.nft.address, listing1.tokenId, listing1.price);
			});

			it("Should allow a buyer to purchase a listing", async function () {
				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;

				const sellerPreviousBalance = await ethers.provider.getBalance(
					listing1.seller.address
				);

				// Check if ListingCreated event was emitted
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftBuyer)
						.purchase(listing1.nft.address, listing1.tokenId, {
							value: listing1.price,
						})
				)
					.to.emit(marketplaceDataForListing.nftMarketplace, "Purchase")
					.withArgs(
						listing1.nft.address,
						listing1.tokenId,
						listing1.seller.address,
						marketplaceDataForListing.nftBuyer.address,
						listing1.price,
						blockTimestamp + 1
					);

				// Retrieve listing and check values
				const updatedListingPrice = await marketplaceDataForListing.nftMarketplace.listings(
					listing1.listingKey
				);

				// Check that the price is now zero
				expect(updatedListingPrice).to.equal(ethers.constants.Zero);

				// Check that the NFT was transferred
				expect(await listing1.nft.ownerOf(listing1.tokenId)).to.equal(
					marketplaceDataForListing.nftBuyer.address
				);
				// Seller's balance should be increased by the listing price
				expect(await ethers.provider.getBalance(listing1.seller.address)).to.equal(
					sellerPreviousBalance.add(listing1.price)
				);
			});

			it("Should not allow a buyer to purchase a cancelled listing", async function () {
				// Cancel the listing
				await marketplaceDataForListing.nftMarketplace
					.connect(listing1.seller)
					.cancelListing(listing1.nft.address, listing1.tokenId);

				// Try to cancel the listing again
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftBuyer)
						.purchase(listing1.nft.address, listing1.tokenId, {
							value: listing1.price,
						})
				).to.be.revertedWith("NFT is not listed");
			});

			it("Should not allow a buyer to purchase a listing with insufficient funds", async function () {
				// Buyer will pay half of the price
				const insufficientPayment: BigNumber = BigNumber.from(listing1.price).div(2);

				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(marketplaceDataForListing.nftBuyer)
						.purchase(listing1.nft.address, listing1.tokenId, {
							value: insufficientPayment,
						})
				).to.be.revertedWith("Insufficient funds to purchase NFT");
			});

			it("Should not allow the seller to purchase their own listing", async function () {
				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(listing1.seller)
						.purchase(listing1.nft.address, listing1.tokenId, {
							value: listing1.price,
						})
				).to.be.revertedWith("NFT owner can't call this function");
			});

			// Reentrancy attack
			it("Should not allow to reenter purchase function V2", async function () {
				await hre.network.provider.request({
					method: "hardhat_impersonateAccount",
					params: [marketplaceDataForListing.purchaseListingAttacker.address],
				});

				const nftAttackerSigner = await ethers.getSigner(
					marketplaceDataForListing.purchaseListingAttacker.address
				);

				const attackedListing: Listing = marketplaceDataForListing.approvedListing;

				// Send funds to the attacker contract so it can call functions
				await marketplaceDataForListing.nftLister.sendTransaction({
					to: marketplaceDataForListing.purchaseListingAttacker.address,
					value: ethers.utils.parseEther("10.0"),
				});

				await expect(
					marketplaceDataForListing.nftMarketplace
						.connect(nftAttackerSigner)
						.purchase(attackedListing.nft.address, attackedListing.tokenId, {
							value: ethers.utils.parseEther("2.0"),
						})
				).to.be.revertedWith("ReentrancyGuard: reentrant call");
			});
		});
	});
});
