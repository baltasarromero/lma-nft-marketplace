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
	type MarketplaceDataForWithdrawBids = {
		nftMarketplace: NFTMarketplace;
		marketPlaceOwner: SignerWithAddress;
		feeDestinationAccount: SignerWithAddress;
		nftSeller: SignerWithAddress;
		nftBidder: SignerWithAddress;
		nftBidder2: SignerWithAddress;
		nonBidder: SignerWithAddress;
		testCarsNFT: TestCarsNFT;
		cancelledAuction: Auction;
		endedAuction: Auction;
		openAuction: Auction;
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
	let marketplaceDataForWithdrawBids: MarketplaceDataForWithdrawBids;
	// Mint first NFT to be listed
	const CAR_1_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/1.json";
	const CAR_2_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/2.json";
	const CAR_3_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/3.json";

	async function bidAuctionsDataFixture(): Promise<MarketplaceDataForWithdrawBids> {
		// Contracts are deployed using the first signer/account by default
		const [
			marketPlaceOwner,
			feeDestinationAccount,
			nftSeller,
			nftBidder,
			nftBidder2,
			nonBidder,
		] = await ethers.getSigners();

		const NFTMarketplace: NFTMarketplace__factory = await ethers.getContractFactory(
			"NFTMarketplace"
		);
		const nftMarketplace: NFTMarketplace = await NFTMarketplace.deploy(
			feeDestinationAccount.address,
			initialFee
		);

		const TestCarsNFT: TestCarsNFT__factory = await ethers.getContractFactory("TestCarsNFT");
		const testCarsNFT: TestCarsNFT = await TestCarsNFT.deploy();

		await testCarsNFT.safeMint(CAR_1_METADATA_URI, nftSeller.address);
		const tokenId1: number = 1;

		// The seller needs to approve the contract before creating the auction
		await testCarsNFT.connect(nftSeller).approve(nftMarketplace.address, tokenId1);

		// Mint 2nd Token
		// Mint first NFT to be listed
		await testCarsNFT.safeMint(CAR_2_METADATA_URI, nftSeller.address);
		const tokenId2: number = 2;

		// The seller needs to approve the contract before creating the auction
		await testCarsNFT.connect(nftSeller).approve(nftMarketplace.address, tokenId2);

		// Mint another token but don't approve it
		// Mint third NFT to be listed
		await testCarsNFT.safeMint(CAR_3_METADATA_URI, nftSeller.address);
		const tokenId3: number = 3;
		// The seller needs to approve the contract before creating the auction
		await testCarsNFT.connect(nftSeller).approve(nftMarketplace.address, tokenId3);

		const auctionFloorPrice: BigNumber = ethers.utils.parseEther("1");
		// Define listing timestamps

		const cancelledAuctionStart: BigNumber = BigNumber.from(
			(await ethers.provider.getBlock("latest")).timestamp
		);
		const cancelledAuctionEnd: BigNumber = cancelledAuctionStart.add(86400 * 10); // 86400 is one day so we create a 10 day listing period

		// Calculate listing key
		const cancelledAuctionKey: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 1]
		);

		const cancelledAuction: Auction = {
			auctionKey: cancelledAuctionKey,
			nft: testCarsNFT,
			tokenId: tokenId1,
			seller: nftSeller,
			bidder: undefined,
			price: auctionFloorPrice,
			startTimestamp: cancelledAuctionStart,
			endTimestamp: cancelledAuctionEnd,
		};

		// Calculate listing key
		const endedAuctionKey: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 2]
		);

		const endedAuctionStart: BigNumber = BigNumber.from(
			(await ethers.provider.getBlock("latest")).timestamp
		); // start will be 1 day in the future
		const endedAuctionEnd: BigNumber = BigNumber.from(
			(await ethers.provider.getBlock("latest")).timestamp
		).add(86400 * 2); // end will be 10 days in the future

		const endedAuction: Auction = {
			auctionKey: endedAuctionKey,
			nft: testCarsNFT,
			tokenId: tokenId2,
			seller: nftSeller,
			bidder: undefined,
			price: auctionFloorPrice,
			startTimestamp: endedAuctionStart,
			endTimestamp: endedAuctionEnd,
		};

		// Calculate listing key
		const openAuctionKey: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 3]
		);

		const openAuctionStart: BigNumber = BigNumber.from(
			(await ethers.provider.getBlock("latest")).timestamp
		);
		const openAuctionEnd: BigNumber = BigNumber.from(
			(await ethers.provider.getBlock("latest")).timestamp
		).add(86400 * 2); // end will be 10 days in the future

		const openAuction: Auction = {
			auctionKey: openAuctionKey,
			nft: testCarsNFT,
			tokenId: tokenId3,
			seller: nftSeller,
			bidder: undefined,
			price: auctionFloorPrice,
			startTimestamp: openAuctionStart,
			endTimestamp: openAuctionEnd,
		};

		// Create auction that will be cancelled
		await nftMarketplace
			.connect(cancelledAuction.seller)
			.createAuction(
				cancelledAuction.nft.address,
				cancelledAuction.tokenId,
				cancelledAuction.price,
				cancelledAuction.startTimestamp,
				cancelledAuction.endTimestamp
			);

		// Create auction that will be ended
		await nftMarketplace
			.connect(endedAuction.seller)
			.createAuction(
				endedAuction.nft.address,
				endedAuction.tokenId,
				endedAuction.price,
				endedAuction.startTimestamp,
				endedAuction.endTimestamp
			);

		// Auction 3 remains open
		await nftMarketplace
			.connect(openAuction.seller)
			.createAuction(
				openAuction.nft.address,
				openAuction.tokenId,
				openAuction.price,
				openAuction.startTimestamp,
				openAuction.endTimestamp
			);

		// Create bids for the auction that will be cancelled
		// Create first bid
		const bid1Amount = ethers.utils.parseEther("1.5");
		await nftMarketplace
			.connect(nftBidder)
			.bid(cancelledAuction.auctionKey, { value: bid1Amount });

		// Create second bid
		const bid2Amount = ethers.utils.parseEther("2.0");
		await nftMarketplace
			.connect(nftBidder2)
			.bid(cancelledAuction.auctionKey, { value: bid2Amount });

		// Cancel the auction
		await nftMarketplace.connect(nftSeller).cancelAuction(cancelledAuction.auctionKey);

		// Create bids for auction to be ended
		// Create first bid for the ended auction
		const bid3Amount = ethers.utils.parseEther("1.5");
		await nftMarketplace.connect(nftBidder).bid(endedAuction.auctionKey, { value: bid3Amount });

		// Create second bid for the ended auction
		const bid4Amount = ethers.utils.parseEther("2.0");
		await nftMarketplace
			.connect(nftBidder2)
			.bid(endedAuction.auctionKey, { value: bid4Amount });

		// Create bids for the auction that will remain open
		// Create first bid for the ended auction
		const bid5Amount = ethers.utils.parseEther("1.8");
		await nftMarketplace.connect(nftBidder).bid(openAuction.auctionKey, { value: bid5Amount });

		// Create second bid for the ended auction
		const bid6Amount = ethers.utils.parseEther("2.2");
		await nftMarketplace.connect(nftBidder2).bid(openAuction.auctionKey, { value: bid6Amount });

		// fast-forward time to end the auction
		time.increaseTo(endedAuction.endTimestamp.add(1));

		// End auction 2
		await nftMarketplace.connect(nftSeller).endAuction(endedAuction.auctionKey);

		return {
			nftMarketplace,
			marketPlaceOwner,
			feeDestinationAccount,
			nftSeller: nftSeller,
			nftBidder: nftBidder,
			nftBidder2: nftBidder2,
			nonBidder: nonBidder,
			testCarsNFT,
			cancelledAuction: cancelledAuction,
			endedAuction: endedAuction,
			openAuction: openAuction,
		};
	}

	describe("Auctions", function () {
		describe("Withdraw Bids", function () {
			let cancelledAuction: Auction;
			let endedAuction: Auction;
			let openAuction: Auction;

			this.beforeEach(async function () {
				marketplaceDataForWithdrawBids = await loadFixture(bidAuctionsDataFixture);

				cancelledAuction = marketplaceDataForWithdrawBids.cancelledAuction;
				endedAuction = marketplaceDataForWithdrawBids.endedAuction;
				openAuction = marketplaceDataForWithdrawBids.openAuction;
			});

			it("Should not allow a bidder to withdraw their bid if the auction is still active", async function () {
				// Withdraw bidder1's bid
				await expect(
					marketplaceDataForWithdrawBids.nftMarketplace.withdrawBid(
						openAuction.auctionKey
					)
				).to.be.revertedWith("Auction is still active");
			});

			it("Should revert when users with no bids in an auction try to withdraw", async function () {
				// Try to withdraw bidder1's bid before making one
				await expect(
					marketplaceDataForWithdrawBids.nftMarketplace
						.connect(marketplaceDataForWithdrawBids.nonBidder)
						.withdrawBid(endedAuction.auctionKey)
				).to.be.revertedWith("No funds to withdraw");
			});

			it("Should allow a bidder to withdraw a bid if the auction is cancelled even if they were the highest bidder", async function () {
				// Highest bid for the cancelled auction
				const highestBid: BigNumber = ethers.utils.parseEther("2.0");
				// Get the balance previous to withdraw
                const bidderPreviousBalance: BigNumber = await ethers.provider.getBalance(
					marketplaceDataForWithdrawBids.nftBidder2.address
				);
                // Current timestamp
				const blockTimestamp: BigNumber = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);

                
				await expect(
					marketplaceDataForWithdrawBids.nftMarketplace
						.connect(marketplaceDataForWithdrawBids.nftBidder2)
						.withdrawBid(cancelledAuction.auctionKey)
				)
					.to.emit(marketplaceDataForWithdrawBids.nftMarketplace, "BidWithdrawn")
					.withArgs(
						marketplaceDataForWithdrawBids.nftBidder2.address,
						cancelledAuction.nft.address,
						cancelledAuction.tokenId,
						highestBid,
						blockTimestamp.add(1)
					);

				// Get the auction and check that it was properly updated
				const auction = await marketplaceDataForWithdrawBids.nftMarketplace.auctions(
					cancelledAuction.auctionKey
				);
                
                // Check the bidders balance to confirm that it increased by a value close to the bid (2.0 ETH)
                // There will be a difference consumed for gas
                const acceptedDelta: BigNumber = ethers.utils.parseEther("0.001"); 
        		expect(
                    await ethers.provider.getBalance(marketplaceDataForWithdrawBids.nftBidder2.address)
				).to.be.greaterThan(bidderPreviousBalance).and.to.be.closeTo(bidderPreviousBalance.add(highestBid), acceptedDelta);
			});

            it("Should allow a bidder to withdraw a bid if the auction is ended", async function () {
				// Highest bid for the cancelled auction
				const bidder1Bid: BigNumber = ethers.utils.parseEther("1.5");
				// Get the balance previous to withdraw
                const bidderPreviousBalance: BigNumber = await ethers.provider.getBalance(
					marketplaceDataForWithdrawBids.nftBidder.address
				);
                // Current timestamp
				const blockTimestamp: BigNumber = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
                
				await expect(
					marketplaceDataForWithdrawBids.nftMarketplace
						.connect(marketplaceDataForWithdrawBids.nftBidder)
						.withdrawBid(endedAuction.auctionKey)
				)
					.to.emit(marketplaceDataForWithdrawBids.nftMarketplace, "BidWithdrawn")
					.withArgs(
						marketplaceDataForWithdrawBids.nftBidder.address,
						endedAuction.nft.address,
						endedAuction.tokenId,
						bidder1Bid,
						blockTimestamp.add(1)
					);

				// Get the auction and check that it was properly updated
				const auction = await marketplaceDataForWithdrawBids.nftMarketplace.auctions(
					endedAuction.auctionKey
				);
                
                // Check the bidders balance to confirm that it increased by a value close to the bid (2.0 ETH)
                // There will be a difference consumed for gas
                const acceptedDelta: BigNumber = ethers.utils.parseEther("0.001"); 
        		expect(
                    await ethers.provider.getBalance(marketplaceDataForWithdrawBids.nftBidder.address)
				).to.be.greaterThan(bidderPreviousBalance).and.to.be.closeTo(bidderPreviousBalance.add(bidder1Bid), acceptedDelta);
			});
		});
	});
});
