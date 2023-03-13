import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
	NFTMarketplace,
	TestCarsNFT,
	TestCarsNFT__factory,
	NFTMarketplace__factory,
} from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BytesLike } from "@ethersproject/bytes";
import { BigNumber } from "@ethersproject/bignumber";

describe("NFTMarketplace", function () {
	// Types definition
	type MarketplaceDataForBids = {
		nftMarketplace: NFTMarketplace;
		marketPlaceOwner: SignerWithAddress;
		feeDestinationAccount: SignerWithAddress;
		nftSeller: SignerWithAddress;
		nftBidder: SignerWithAddress;
		nftBidder2: SignerWithAddress;
		testCarsNFT: TestCarsNFT;
		auction1: Auction;
		futureAuction: Auction;
	};

	type Auction = {
		auctionKey: BytesLike;
		nft: TestCarsNFT;
		tokenId: number;
		seller: SignerWithAddress;
		bidder: SignerWithAddress | undefined;
		price: BigNumber;
		startTimestamp: BigNumber;
		endTimestamp: BigNumber;
	};

	// Global Variables
	const initialFee: number = 100;
	let marketplaceDataForBids: MarketplaceDataForBids;
	// Mint first NFT to be listed
	const CAR_1_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/1.json";
	const CAR_2_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/2.json";
	const CAR_3_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/3.json";

	async function bidAuctionsDataFixture(): Promise<MarketplaceDataForBids> {
		// Contracts are deployed using the first signer/account by default
		const [marketPlaceOwner, feeDestinationAccount, nftAuctioneer, nftBidder, nftBidder2] =
			await ethers.getSigners();

		const NFTMarketplace: NFTMarketplace__factory = await ethers.getContractFactory(
			"NFTMarketplace"
		);
		const nftMarketplace: NFTMarketplace = await NFTMarketplace.deploy(
			feeDestinationAccount.address,
			initialFee
		);

		const TestCarsNFT: TestCarsNFT__factory = await ethers.getContractFactory("TestCarsNFT");
		const testCarsNFT: TestCarsNFT = await TestCarsNFT.deploy();

		await testCarsNFT.safeMint(CAR_1_METADATA_URI, nftAuctioneer.address);
		const tokenId1: number = 1;

		// The seller needs to approve the contract before creating the auction
		await testCarsNFT.connect(nftAuctioneer).approve(nftMarketplace.address, tokenId1);

		// Mint 2nd Token
		// Mint first NFT to be listed
		await testCarsNFT.safeMint(CAR_2_METADATA_URI, nftAuctioneer.address);
		const tokenId2: number = 2;

		// The seller needs to approve the contract before creating the auction
		await testCarsNFT.connect(nftAuctioneer).approve(nftMarketplace.address, tokenId2);

		// Mint another token but don't approve it
		// Mint third NFT to be listed
		await testCarsNFT.safeMint(CAR_3_METADATA_URI, nftAuctioneer.address);
		const tokenId3: number = 3;
		// The seller needs to approve the contract before creating the auction
		await testCarsNFT.connect(nftAuctioneer).approve(nftMarketplace.address, tokenId3);

		const auctionFloorPrice: BigNumber = ethers.utils.parseEther("1");
		// Define listing timestamps

		const auctionStartTimestamp: BigNumber = BigNumber.from(
			(await ethers.provider.getBlock("latest")).timestamp
		);
		const auctionEndTimestamp: BigNumber = auctionStartTimestamp.add(86400 * 10); // 86400 is one day so we create a 10 day listing period

		// Calculate listing key
		const auction1Key: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 1]
		);

		const token1Auction: Auction = {
			auctionKey: auction1Key,
			nft: testCarsNFT,
			tokenId: tokenId1,
			seller: nftAuctioneer,
			bidder: undefined,
			price: auctionFloorPrice,
			startTimestamp: auctionStartTimestamp,
			endTimestamp: auctionEndTimestamp,
		};

		// Calculate listing key
		const futureAuctionKey: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 3]
		);

		const futureAuctionStart: BigNumber = BigNumber.from(
			(await ethers.provider.getBlock("latest")).timestamp
		).add(86400); // start will be 1 day in the future
		const futureAuctionEnd: BigNumber = BigNumber.from(
			(await ethers.provider.getBlock("latest")).timestamp
		).add(86400 * 10); // end will be 10 days in the future

		const futureAuction: Auction = {
			auctionKey: futureAuctionKey,
			nft: testCarsNFT,
			tokenId: tokenId3,
			seller: nftAuctioneer,
			bidder: undefined,
			price: auctionFloorPrice,
			startTimestamp: futureAuctionStart,
			endTimestamp: futureAuctionEnd,
		};

		await nftMarketplace
			.connect(token1Auction.seller)
			.createAuction(
				token1Auction.nft.address,
				token1Auction.tokenId,
				token1Auction.price,
				token1Auction.startTimestamp,
				token1Auction.endTimestamp
			);

		await nftMarketplace
			.connect(futureAuction.seller)
			.createAuction(
				futureAuction.nft.address,
				futureAuction.tokenId,
				futureAuction.price,
				futureAuction.startTimestamp,
				futureAuction.endTimestamp
			);

		return {
			nftMarketplace,
			marketPlaceOwner,
			feeDestinationAccount,
			nftSeller: nftAuctioneer,
			nftBidder: nftBidder,
			nftBidder2: nftBidder2,
			testCarsNFT,
			auction1: token1Auction,
			futureAuction: futureAuction,
		};
	}

	describe("Auctions", function () {
		describe("Bids", function () {
			let auction1: Auction;

			this.beforeEach(async function () {
				marketplaceDataForBids = await loadFixture(bidAuctionsDataFixture);

				auction1 = marketplaceDataForBids.auction1;
			});

			it("Should allow to place a bid if there were no previous bids", async function () {
				// Bidder places a bid
				const bidAmount = ethers.utils.parseEther("1.5");
				// Current timestamp
				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;

				// Check if AuctionCreated event was emitted
				await expect(
					marketplaceDataForBids.nftMarketplace
						.connect(marketplaceDataForBids.nftBidder)
						.bid(auction1.auctionKey, { value: bidAmount })
				)
					.to.emit(marketplaceDataForBids.nftMarketplace, "NewHighestBid")
					.withArgs(
						auction1.nft.address,
						auction1.tokenId,
						marketplaceDataForBids.nftBidder.address,
						bidAmount,
						ethers.constants.Zero, //there were no previous bids so previous highest bid should be zero
						blockTimestamp + 1
					);

				// Check that the bid was placed successfully
				const auction = await marketplaceDataForBids.nftMarketplace.auctions(
					auction1.auctionKey
				);
				expect(auction.highestBid).to.equal(bidAmount);
				expect(auction.highestBidder).to.equal(marketplaceDataForBids.nftBidder.address);
			});

			it("Should allow to place a new highest bid if there were previous bids", async function () {
				// Bidder places the first bid bid
				const bid1Amount = ethers.utils.parseEther("1.5");

				await marketplaceDataForBids.nftMarketplace
					.connect(marketplaceDataForBids.nftBidder)
					.bid(auction1.auctionKey, { value: bid1Amount });

				// 2nd Bidder tries to place a new highest bid
				// Current timestamp
				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;

				const bid2Amount = ethers.utils.parseEther("1.7");

				// Check if AuctionCreated event was emitted
				await expect(
					marketplaceDataForBids.nftMarketplace
						.connect(marketplaceDataForBids.nftBidder2)
						.bid(auction1.auctionKey, { value: bid2Amount })
				)
					.to.emit(marketplaceDataForBids.nftMarketplace, "NewHighestBid")
					.withArgs(
						auction1.nft.address,
						auction1.tokenId,
						marketplaceDataForBids.nftBidder2.address,
						bid2Amount,
						bid1Amount,
						blockTimestamp + 1
					);

				// Check that the bid was placed successfully
				const auction = await marketplaceDataForBids.nftMarketplace.auctions(
					auction1.auctionKey
				);
				expect(auction.highestBid).to.equal(bid2Amount);
				expect(auction.highestBidder).to.equal(marketplaceDataForBids.nftBidder2.address);
			});

			it("Should not allow a bid of 0 ETH", async function () {
				// Bidder tries to place a bid of 0 ETH
				await expect(
					marketplaceDataForBids.nftMarketplace
						.connect(marketplaceDataForBids.nftBidder)
						.bid(auction1.auctionKey, { value: 0 })
				).to.be.revertedWith("Send ether to place a bid");

				// Check that no bid was placed
				const auction = await marketplaceDataForBids.nftMarketplace.auctions(
					auction1.auctionKey
				);

				expect(auction.highestBid).to.equal(ethers.constants.Zero);
				expect(auction.highestBidder).to.equal(ethers.constants.AddressZero);
			});

			it("Should not allow a bid lower than the floor price", async function () {
				// Bidder tries to place a bid lower than the floor price which is 1 Ether
				const bidAmount: BigNumber = ethers.utils.parseEther("0.5");

				await expect(
					marketplaceDataForBids.nftMarketplace
						.connect(marketplaceDataForBids.nftBidder)
						.bid(auction1.auctionKey, { value: bidAmount })
				).to.be.revertedWith("Bid value should be higher than the floor price");

				// Check that no bid was placed
				const auction = await marketplaceDataForBids.nftMarketplace.auctions(
					auction1.auctionKey
				);
				expect(auction.highestBid).to.equal(ethers.BigNumber.from(0));
				expect(auction.highestBidder).to.equal(ethers.constants.AddressZero);
			});

			it("Should allow a bid lower than the current highest bid", async function () {
				// Bidder places the first bid
				const bid1Amount: BigNumber = ethers.utils.parseEther("1.5");

				await marketplaceDataForBids.nftMarketplace
					.connect(marketplaceDataForBids.nftBidder)
					.bid(auction1.auctionKey, { value: bid1Amount });

				// 2nd Bidder tries to place another bid
				const bid2Amount = ethers.utils.parseEther("1.2");

				// The bid should be placed (it shouldn't revert) but no emit should be emitted
				await expect(
					marketplaceDataForBids.nftMarketplace
						.connect(marketplaceDataForBids.nftBidder2)
						.bid(auction1.auctionKey, { value: bid2Amount })
				).to.not.emit(marketplaceDataForBids.nftMarketplace, "NewHighestBid");

				// Check that the highest bid wasn't changed
				const auction = await marketplaceDataForBids.nftMarketplace.auctions(
					auction1.auctionKey
				);
				expect(auction.highestBid).to.equal(bid1Amount);
				expect(auction.highestBidder).to.equal(marketplaceDataForBids.nftBidder.address);
			});

			it("Should allow the first Bidder to increase the bid to become the highest bidder NFT seller to bid", async function () {
				// Bidder places the first bid
				const bid1Amount = ethers.utils.parseEther("1.5");

				await marketplaceDataForBids.nftMarketplace
					.connect(marketplaceDataForBids.nftBidder)
					.bid(auction1.auctionKey, { value: bid1Amount });

				const bid2Amount = ethers.utils.parseEther("1.7");

				await marketplaceDataForBids.nftMarketplace
					.connect(marketplaceDataForBids.nftBidder2)
					.bid(auction1.auctionKey, { value: bid2Amount });

				// 2nd Bidder tries to place a new highest bid
				// Current timestamp
				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;

				const increaseBid1Amount = ethers.utils.parseEther("0.4");

				const totalBid1Amount = bid1Amount.add(increaseBid1Amount);

				// Check if AuctionCreated event was emitted
				await expect(
					marketplaceDataForBids.nftMarketplace
						.connect(marketplaceDataForBids.nftBidder)
						.bid(auction1.auctionKey, { value: increaseBid1Amount })
				)
					.to.emit(marketplaceDataForBids.nftMarketplace, "NewHighestBid")
					.withArgs(
						auction1.nft.address,
						auction1.tokenId,
						marketplaceDataForBids.nftBidder.address,
						totalBid1Amount,
						bid2Amount,
						blockTimestamp + 1
					);

				// Check that the bid was placed successfully
				const auction = await marketplaceDataForBids.nftMarketplace.auctions(
					auction1.auctionKey
				);
				expect(auction.highestBid).to.equal(totalBid1Amount);
				expect(auction.highestBidder).to.equal(marketplaceDataForBids.nftBidder.address);
			});

			it("Should not allow the NFT seller to bid", async function () {
				const bidValue = ethers.utils.parseEther("2");

				// Try to bid on the auction as the seller (should fail)
				await expect(
					marketplaceDataForBids.nftMarketplace
						.connect(auction1.seller)
						.bid(auction1.auctionKey, { value: bidValue })
				).to.be.revertedWith("Seller can't call this function");

				// Check that the bid was placed successfully
				const auction = await marketplaceDataForBids.nftMarketplace.auctions(
					auction1.auctionKey
				);
				expect(auction.highestBid).to.equal(ethers.constants.Zero);
				expect(auction.highestBidder).to.equal(ethers.constants.AddressZero);
			});

			it("Should not allow to bid if the auction is ended", async function () {
				const bidValue = ethers.utils.parseEther("2");

				// Advance time to be past auction's end
				time.increaseTo(auction1.endTimestamp.add(1));

				// Try to bid on the auction as the seller (should fail)
				await expect(
					marketplaceDataForBids.nftMarketplace
						.connect(marketplaceDataForBids.nftBidder)
						.bid(auction1.auctionKey, { value: bidValue })
				).to.be.revertedWith("Auction has ended");
			});

			it("Should not allow to bid if the auction is cancelled", async function () {
				const bidValue = ethers.utils.parseEther("2");

				// Cancel the auction
				await marketplaceDataForBids.nftMarketplace
					.connect(auction1.seller)
					.cancelAuction(auction1.auctionKey);

				// Try to bid
				await expect(
					marketplaceDataForBids.nftMarketplace
						.connect(marketplaceDataForBids.nftBidder)
						.bid(auction1.auctionKey, { value: bidValue })
				).to.be.revertedWith("Auction is already cancelled");
			});

			it("Should not allow to bid if the auction hasn't started", async function () {
				const bidValue = ethers.utils.parseEther("2");

				await expect(
					marketplaceDataForBids.nftMarketplace
						.connect(marketplaceDataForBids.nftBidder)
						.bid(marketplaceDataForBids.futureAuction.auctionKey, {
							value: bidValue,
						})
				).to.be.revertedWith("Auction hasn't started yet");
			});
		});
	});
});
