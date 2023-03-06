import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
	NFTMarketplace,
	TestCarsNFT,
	TestCarsNFT__factory,
	NFTMarketplace__factory,
	IERC721,
} from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BytesLike } from "@ethersproject/bytes";
import { ContractTransaction } from "@ethersproject/contracts";
import { extendEnvironment } from "hardhat/config";

describe("NFTMarketplace", function () {
	// Types definition
	type EmptyMarketplaceData = {
		nftMarketplace: NFTMarketplace;
		marketPlaceOwner: SignerWithAddress;
		feeDestinationAccount: SignerWithAddress;
		otherAccount: SignerWithAddress;
	};

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
	let emptyMarketplaceData: EmptyMarketplaceData;
	let marketplaceDataWithMintedTokens: MarketplaceDataWithMintedTokens;

	// We define a fixture to reuse the same setup in every test.
	// We use loadFixture to run this setup once, snapshot that state,
	// and reset Hardhat Network to that snapshot in every test.
	async function deployCleanNFMarketplaceFixture(): Promise<{
		nftMarketplace: NFTMarketplace;
		marketPlaceOwner: SignerWithAddress;
		feeDestinationAccount: SignerWithAddress;
		otherAccount: SignerWithAddress;
	}> {
		// Contracts are deployed using the first signer/account by default
		const [marketPlaceOwner, feeDestinationAccount, otherAccount] =
			await ethers.getSigners();

		const NFTMarketplace = await ethers.getContractFactory(
			"NFTMarketplace"
		);
		const nftMarketplace = await NFTMarketplace.deploy(
			feeDestinationAccount.address,
			initialFee
		);

		return {
			nftMarketplace,
			marketPlaceOwner,
			feeDestinationAccount,
			otherAccount,
		};
	}

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
		const listing1ApprovalTx = await testCarsNFT
			.connect(nftLister)
			.approve(nftMarketplace.address, tokenId1);
		const listing1ApprovalTxReceipt = await listing1ApprovalTx.wait();

		// Mint 2nd Token
		// Mint first NFT to be listed
		const car2URI =
			"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/2.json";

		//const car1URI = "https://ipfs.io/ipfs/QmZf9uxhfD5cxCDTrouBBwW1U9yVq1sSZP1LJTAbciyL7Z";
		const mint2Tx: ContractTransaction = await testCarsNFT.safeMint(
			car1URI,
			nftAuctioneer.address
		);
		const mint2TxReceipt = await mint2Tx.wait();
		const tokenId2 = 2;

		// The seller needs to aprove the contract before listing
		const listing2ApprovalTx = await testCarsNFT
			.connect(nftAuctioneer)
			.approve(nftMarketplace.address, tokenId2);
		const listing2ApprovalTxReceipt = await listing2ApprovalTx.wait();

		// Mint another token but don't approve it
		// Mint first NFT to be listed
		const car3URI =
			"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/3.json";

		const mint3Tx: ContractTransaction = await testCarsNFT.safeMint(
			car3URI,
			nftLister.address
		);

		const mint3TxReceipt = await mint2Tx.wait();
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

	describe("Deployment", function () {
		this.beforeEach(async function () {
			emptyMarketplaceData = await loadFixture(
				deployCleanNFMarketplaceFixture
			);
		});

		it("Should deploy NFTMarketplace", async function () {
			expect(emptyMarketplaceData.nftMarketplace.address).to.not.be
				.undefined;
		});

		describe("Should have an empty initial state", function () {
			it("Should have listingsCount initialized to 0", async function () {
				const listingsCount =
					await emptyMarketplaceData.nftMarketplace.listingsCount();
				expect(listingsCount).to.equal(0);
			});

			it("Should have auctionsCount initialized to 0", async function () {
				const auctionsCount =
					await emptyMarketplaceData.nftMarketplace.auctionsCount();
				expect(auctionsCount).to.equal(0);
			});

			it("Should have feeAccount set to the correct address", async function () {
				const feeAccount =
					await emptyMarketplaceData.nftMarketplace.feeAccount();
				expect(feeAccount).to.equal(
					emptyMarketplaceData.feeDestinationAccount.address
				);
			});

			it("Should have the expected fee", async function () {
				const fee = await emptyMarketplaceData.nftMarketplace.fee();
				expect(fee).to.equal(initialFee);
			});

			it("Should have userFunds set to 0 for the contract owner", async function () {
				const owner = emptyMarketplaceData.marketPlaceOwner.address;
				const userFunds =
					await emptyMarketplaceData.nftMarketplace.userFunds(owner);
				expect(userFunds).to.equal(0);
			});

			it("Should have userFunds set to 0 for the 'other' account", async function () {
				const userFunds =
					await emptyMarketplaceData.nftMarketplace.userFunds(
						emptyMarketplaceData.otherAccount.address
					);
				expect(userFunds).to.equal(0);
			});

			it("The NFT should not be listed for sale", async function () {
				// TODO implement
			});

			it("The NFT should not be listed for auction", async function () {
				// TODO implement
			});
		});
	});

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
					marketplaceDataWithMintedTokens.nftMarketplace.connect(listing1.seller).createListing(
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
					await marketplaceDataWithMintedTokens.nftMarketplace.connect(listing1.seller).createListing(
						listing1.nft.address,
						listing1.tokenId,
						listing1.price,
						listing1.startTimestamp,
						listing1.endTimestamp
					);

					// Try to create another listing for the same NFT
					await expect(
						marketplaceDataWithMintedTokens.nftMarketplace.connect(listing1.seller).createListing(
							listing1.nft.address,
							listing1.tokenId,
							listing1.price,
							listing1.startTimestamp,
							listing1.endTimestamp
						)
					).to.be.revertedWith(
						"NFT is already listed"
					);
				});

				it("Should prevent creating a listing for an NFT that is already in an auction", async function () {
					// Create an auction for the NFT
					marketplaceDataWithMintedTokens.nftMarketplace.connect(listing1.seller).createAuction(
						listing1.nft.address,
						listing1.tokenId,
						listing1.price,
						listing1.startTimestamp,
						listing1.endTimestamp
					);

					// Try to create a listing for the same NFT
					await expect(
						marketplaceDataWithMintedTokens.nftMarketplace.connect(listing1.seller).createListing(
							listing1.nft.address,
							listing1.tokenId,
							listing1.price,
							listing1.startTimestamp,
							listing1.endTimestamp
						)
					).to.be.revertedWith(
						"NFT is already listed"
					); 
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

			describe("notReentrant modifier", function () {
				it("Should prevent creating a listing while creating a listing", async function () {
					// TODO test reentrancy with a re-entrant attacker
				});
			});

			// TODO test missing modifiers
		});
	});
});