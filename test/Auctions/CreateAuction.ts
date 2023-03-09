import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
	NFTMarketplace,
	TestCarsNFT,
	TestCarsNFT__factory,
	NFTMarketplace__factory
} from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BytesLike } from "@ethersproject/bytes";
import { BigNumber } from "@ethersproject/bignumber";

describe("NFTMarketplace", function () {
	// Types definition
	type MarketplaceDataForAuction = {
		nftMarketplace: NFTMarketplace;
		marketPlaceOwner: SignerWithAddress;
		feeDestinationAccount: SignerWithAddress;
		nftLister: SignerWithAddress;
		nftBuyer: SignerWithAddress;
		testCarsNFT: TestCarsNFT;
		token1Auction: Auction,
		token2Auction: Auction
	};

	type Auction = {
		auctionKey: BytesLike,
		nft: TestCarsNFT,
		tokenId: number,
		seller: SignerWithAddress,
		price: BigNumber,
		startTimestamp: BigNumber,
		endTimestamp: BigNumber,
	}

	// Global Variables
	const initialFee: number = 100;
	let marketplaceDataForAuction: MarketplaceDataForAuction;
	// Mint first NFT to be listed
	const CAR_1_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/1.json";
	const CAR_2_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/2.json";
	const CAR_3_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/3.json";
	
	async function auctionsDataFixture(): Promise<MarketplaceDataForAuction> {
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
		const tokenId1:number = 1;

		// The seller needs to approve the contract before auction
		await testCarsNFT
			.connect(nftLister)
			.approve(nftMarketplace.address, tokenId1);

		// Mint 2nd Token
		// Mint first NFT to be listed
		await testCarsNFT.safeMint(CAR_2_METADATA_URI, nftAuctioneer.address);
		const tokenId2:number = 2;

		// The seller needs to approve the contract before auction
		await testCarsNFT
			.connect(nftAuctioneer)
			.approve(nftMarketplace.address, tokenId2);

		// Mint another token but don't approve it
		// Mint third NFT to be listed
		await testCarsNFT.safeMint(CAR_3_METADATA_URI, nftLister.address);
		const tokenId3:number = 3;
		// Don't approve the Marketplace to sell nft 3

		const auctionPrice: BigNumber = ethers.utils.parseEther("1");
		const auctionStartTimestamp: BigNumber = BigNumber.from(
			(await ethers.provider.getBlock("latest")).timestamp
		);
		const auctionEndTimestamp: BigNumber = auctionStartTimestamp.add(
			86400 * 10
		); // 86400 is one day so we create a 10 day listing period

		// Calculate auction key
		const auction1Key: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 1]
		);


		const token1Auction: Auction =  {
			auctionKey: auction1Key,
			nft: testCarsNFT,
			tokenId: tokenId1,
			seller: nftLister,
			price: auctionPrice,
			startTimestamp: auctionStartTimestamp,
			endTimestamp: auctionEndTimestamp
		};

		// Calculate auction key
		const auction3Key: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 3]
		);

		const token3Auction: Auction = {
			auctionKey: auction3Key,
			nft: testCarsNFT,
			tokenId: tokenId3,
			seller: nftLister,
			price: auctionPrice,
			startTimestamp: auctionStartTimestamp,
			endTimestamp: auctionEndTimestamp,
		};

		return {
			nftMarketplace,
			marketPlaceOwner,
			feeDestinationAccount,
			nftLister,
			nftBuyer,
			testCarsNFT,
			token1Auction: token1Auction,
			token2Auction: token3Auction
		};
	}

	describe("Auctions", function () {
		describe("Create auction", function () {
            let auction1:Auction;
		
            this.beforeEach(async function () {
				marketplaceDataForAuction = await loadFixture(
					auctionsDataFixture
				);

                auction1 = marketplaceDataForAuction.token1Auction;
			
			});

			it("Should create a new auction with the expected values and emit the AuctionCreatedEvent", async function () {
			
				// Check if AuctionCreated event was emitted
				await expect(
					marketplaceDataForAuction.nftMarketplace
						.connect(auction1.seller)
						.createAuction(
							auction1.nft.address,
							auction1.tokenId,
							auction1.price,
							auction1.startTimestamp,
							auction1.endTimestamp
						)
				)
					.to.emit(
						marketplaceDataForAuction.nftMarketplace,
						"AuctionCreated"
					)
					.withArgs(
						auction1.nft.address,
						auction1.tokenId,
						auction1.seller.address,
						auction1.price,
						auction1.startTimestamp,
						auction1.endTimestamp
					);

				// There should be 1 auction now
				expect(
					await marketplaceDataForAuction.nftMarketplace.auctionsCount()
				).to.equal(1);
				
				// Retrieve auction 1 and validate that all the attributes are properly created
				const retrievedAuction1 =
					await marketplaceDataForAuction.nftMarketplace.auctions(
						auction1.auctionKey
					);
				expect(retrievedAuction1.nft).to.equal(auction1.nft.address);
				expect(retrievedAuction1.seller).to.equal(
					auction1.seller.address
				);
				expect(retrievedAuction1.tokenId).to.equal(auction1.tokenId);
				expect(retrievedAuction1.floorPrice).to.equal(auction1.price);
				expect(retrievedAuction1.buyer).to.eq(
					ethers.constants.AddressZero
				);
				expect(retrievedAuction1.cancelled).to.be.false;
				expect(retrievedAuction1.startTimestamp).to.equal(
					auction1.startTimestamp
				);
				expect(retrievedAuction1.endTimestamp).to.equal(
					auction1.endTimestamp
				);
                //Check that there are no bids
                expect(retrievedAuction1.highestBid).to.eq(
					ethers.constants.Zero
				);
                expect(retrievedAuction1.highestBidder).to.eq(
					ethers.constants.AddressZero
				);
			});

			it("Should not create a new auction if the price is zero", async function () {
				await expect(
					marketplaceDataForAuction.nftMarketplace
						.connect(auction1.seller)
						.createAuction(
							auction1.nft.address,
							auction1.tokenId,
							ethers.constants.Zero,
							auction1.startTimestamp,
							auction1.endTimestamp
						)
				).to.be.revertedWith("Price must be greater than zero");
			});

			it("Should not create a new auction if start timestamp is after end timestamp", async function () {
                // New start time
                const invalidStart: BigNumber = auction1.startTimestamp.add(86400 * 2); // add two days
                const invalidEnd: BigNumber = auction1.startTimestamp.add(86400); // add one day

				await expect(
					marketplaceDataForAuction.nftMarketplace
						.connect(auction1.seller)
						.createAuction(
							auction1.nft.address,
							auction1.tokenId,
							auction1.price,
                            invalidStart,
                            invalidEnd
						)
				).to.be.revertedWith("Invalid timestamps");
			});

            it("Should not create a new auction if start timestamp is 0", async function () {
				await expect(
					marketplaceDataForAuction.nftMarketplace
						.connect(auction1.seller)
						.createAuction(
							auction1.nft.address,
							auction1.tokenId,
							auction1.price,
                            ethers.constants.Zero,
							auction1.endTimestamp
						)
				).to.be.revertedWith("Invalid timestamps");
            });

            it("Should not create a new auction if end timestamp is in the past", async function () {
                // Current timestamp
                const blockTimestamp: number = (
					await ethers.provider.getBlock("latest")
				).timestamp;

                const invalidEndTimestamp: BigNumber = BigNumber.from(blockTimestamp).sub(86400); // One day before now. This is an invalid end timestamp

                await expect(
					marketplaceDataForAuction.nftMarketplace
						.connect(auction1.seller)
						.createAuction(
							auction1.nft.address,
							auction1.tokenId,
							auction1.price,
							auction1.startTimestamp,
                            invalidEndTimestamp
						)
				).to.be.revertedWith("Invalid timestamps");
            });

                

			it("Should not create a new auction if the caller is not the owner of the NFT", async function () {
				await expect(
					marketplaceDataForAuction.nftMarketplace
						.connect(marketplaceDataForAuction.nftBuyer)
						.createAuction(
							auction1.nft.address,
							auction1.tokenId,
							auction1.price,
							auction1.startTimestamp,
							auction1.endTimestamp
						)
				).to.be.revertedWith(
					"Must be the owner of the NFT to list in the marketplace"
				);
			});

			it("Should not create a new auction if the contract is not approved to transfer the NFT", async function () {
				const unapprovedAuction: Auction = marketplaceDataForAuction.token2Auction;
				await expect(
					marketplaceDataForAuction.nftMarketplace
						.connect(marketplaceDataForAuction.nftLister)
						.createAuction(
							unapprovedAuction.nft.address,
							unapprovedAuction.tokenId,
							unapprovedAuction.price,
							unapprovedAuction.startTimestamp,
							unapprovedAuction.endTimestamp
						)
				).to.be.revertedWith(
					"Marketplace must be approved to transfer the NFT"
				);
			});

			describe("NotInAuctionOrListing modifier", function () {
				it("Should prevent creating an auction for an NFT that is already in a listing", async function () {
				 	// Create a listing for the NFT using auction's 1 data
					await marketplaceDataForAuction.nftMarketplace
						.connect(auction1.seller)
						.createListing(
							auction1.nft.address,
							auction1.tokenId,
							auction1.price,
							auction1.startTimestamp,
							auction1.endTimestamp
						);

					// Try to create an auction for the same NFT
					await expect(
						marketplaceDataForAuction.nftMarketplace
							.connect(auction1.seller)
							.createAuction(
								auction1.nft.address,
								auction1.tokenId,
								auction1.price,
								auction1.startTimestamp,
								auction1.endTimestamp
							)
					).to.be.revertedWith("NFT is already listed"); 
				});

				it("Should prevent creating an auction for an NFT that is already in an auction", async function () {
					// Create an auction for the NFT
			 		marketplaceDataForAuction.nftMarketplace
						.connect(auction1.seller)
						.createAuction(
							auction1.nft.address,
							auction1.tokenId,
							auction1.price,
							auction1.startTimestamp,
							auction1.endTimestamp
						);

					// Try to create another auction for the same NFT
					await expect(
						marketplaceDataForAuction.nftMarketplace
							.connect(auction1.seller)
							.createAuction(
								auction1.nft.address,
								auction1.tokenId,
								auction1.price,
								auction1.startTimestamp,
								auction1.endTimestamp
							)
					).to.be.revertedWith("NFT is already listed");
				});
			});

		});
	});
});
