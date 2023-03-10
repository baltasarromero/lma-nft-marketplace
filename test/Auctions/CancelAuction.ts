import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
	NFTMarketplace,
	TestCarsNFT,
	TestCarsNFT__factory,
	NFTMarketplace__factory,
	NFTAttacker,
	NFTAttacker__factory,
} from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BytesLike } from "@ethersproject/bytes";
import { BigNumber } from "@ethersproject/bignumber";

describe("NFTMarketplace", function () {
	// Types definition
	type CancelAuctionsFixtureData = {
		nftMarketplace: NFTMarketplace;
		marketPlaceOwner: SignerWithAddress;
		feeDestinationAccount: SignerWithAddress;
		nftLister: SignerWithAddress;
		nftBuyer: SignerWithAddress;
		testCarsNFT: TestCarsNFT;
		nftAttacker: NFTAttacker;
		auction1: Auction;
		auction2: Auction;
		attackerNFTAuction: Auction;
	};

	type Auction = {
		auctionKey: BytesLike;
		nft: TestCarsNFT;
		tokenId: number;
		seller: SignerWithAddress;
		price: BigNumber;
		startTimestamp: BigNumber;
		endTimestamp: BigNumber;
	};

	// Global Variables
	const initialFee: number = 100;
	let cancelAuctionsFixture: CancelAuctionsFixtureData;
	// Mint first NFT to be listed
	const CAR_1_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/1.json";
	const CAR_2_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/2.json";
	const CAR_3_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/3.json";

	async function cancelAuctionsDataFixture(): Promise<CancelAuctionsFixtureData> {
		// Contracts are deployed using the first signer/account by default
		const [marketPlaceOwner, feeDestinationAccount, nftLister, nftAuctioneer, nftBuyer] =
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

		await testCarsNFT.safeMint(CAR_1_METADATA_URI, nftLister.address);
		const tokenId1: number = 1;

		// The seller needs to approve the contract before the auction is created
		await testCarsNFT.connect(nftLister).approve(nftMarketplace.address, tokenId1);

		// Mint 2nd Token
		// Mint first NFT to be listed
		await testCarsNFT.safeMint(CAR_2_METADATA_URI, nftAuctioneer.address);
		const tokenId2: number = 2;

		// The seller needs to approve the contract before auction
		await testCarsNFT.connect(nftAuctioneer).approve(nftMarketplace.address, tokenId2);

		// Mint another token but don't approve it
		// Mint third NFT to be listed
		await testCarsNFT.safeMint(CAR_3_METADATA_URI, nftLister.address);
		const tokenId3: number = 3;
		// Don't approve the Marketplace to sell nft 3

		// Deploy AttackerNFT contract
		const NFTAttacker: NFTAttacker__factory = await ethers.getContractFactory("NFTAttacker");
		const nftAttacker: NFTAttacker = await NFTAttacker.deploy(
			"NFTAttacker",
			"NFTA",
			nftMarketplace.address
		);

		const auctionPrice: BigNumber = ethers.utils.parseEther("1");
		const auctionStartTimestamp: BigNumber = BigNumber.from(
			(await ethers.provider.getBlock("latest")).timestamp
		);
		const auctionEndTimestamp: BigNumber = auctionStartTimestamp.add(86400 * 10); // 86400 is one day so we create a 10 day listing period

		// Calculate auction key
		const auction1Key: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 1]
		);

		const token1Auction: Auction = {
			auctionKey: auction1Key,
			nft: testCarsNFT,
			tokenId: tokenId1,
			seller: nftLister,
			price: auctionPrice,
			startTimestamp: auctionStartTimestamp,
			endTimestamp: auctionEndTimestamp,
		};

		// Create one auction
		await nftMarketplace
			.connect(token1Auction.seller)
			.createAuction(
				token1Auction.nft.address,
				token1Auction.tokenId,
				token1Auction.price,
				token1Auction.startTimestamp,
				token1Auction.endTimestamp
			);

		// Calculate the auction key
		const token3AuctionKey: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 3]
		);

		const token3Auction: Auction = {
			auctionKey: token3AuctionKey,
			nft: testCarsNFT,
			tokenId: tokenId3,
			seller: nftLister,
			price: auctionPrice,
			startTimestamp: auctionStartTimestamp,
			endTimestamp: auctionEndTimestamp,
		};

		// Attacker auction
		// Mint an attacker NFT
		await nftAttacker.safeMint(CAR_1_METADATA_URI, nftLister.address);
		const attackerTokenId: number = 1;
		
		const attackerAuctionKey: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[nftAttacker.address, 1]
		);

		const attackerNFTAuction: Auction = {
			auctionKey: attackerAuctionKey,
			nft: nftAttacker,
			tokenId: attackerTokenId,
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
			nftAttacker,
			auction1: token1Auction,
			auction2: token3Auction,
			attackerNFTAuction
		};
	}

	describe("Auctions", function () {
		let auction1: Auction;

		this.beforeEach(async function () {
			cancelAuctionsFixture = await loadFixture(cancelAuctionsDataFixture);

			auction1 = cancelAuctionsFixture.auction1;
		});

		describe("Cancel Auctions", function () {
			it("Should cancel an auction", async function () {
				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;
				// Check if AuctionCancelled event was emitted
				await expect(
					cancelAuctionsFixture.nftMarketplace
						.connect(auction1.seller)
						.cancelAuction(auction1.auctionKey)
				)
					.to.emit(cancelAuctionsFixture.nftMarketplace, "AuctionCancelled")
					.withArgs(
						auction1.nft.address,
						auction1.tokenId,
						auction1.seller.address,
						blockTimestamp + 1
					);

				// Check that the auction has been cancelled
				const retrievedAuction = await cancelAuctionsFixture.nftMarketplace.auctions(
					auction1.auctionKey
				);
				expect(retrievedAuction.cancelled).to.be.true;
				expect(retrievedAuction.highestBidder).to.equal(ethers.constants.AddressZero);

				// Check that the NFT has been transferred back to the seller
				expect(
					await cancelAuctionsFixture.testCarsNFT.ownerOf(retrievedAuction.tokenId)
				).to.equal(retrievedAuction.seller);
			});

			it("Should revert if the auction has already been cancelled", async function () {
				// Cancel the auction
				await cancelAuctionsFixture.nftMarketplace
					.connect(auction1.seller)
					.cancelAuction(auction1.auctionKey);

				// Try to cancel the auction again
				await expect(
					cancelAuctionsFixture.nftMarketplace
						.connect(auction1.seller)
						.cancelAuction(auction1.auctionKey)
				).to.be.revertedWith("Auction is already cancelled");
			});

			it("Should revert if the auction has already ended", async function () {
				// Increase time to be past Auction's end time
				time.increaseTo(auction1.endTimestamp.add(1));

				// Try to cancel the auction
				await expect(
					cancelAuctionsFixture.nftMarketplace
						.connect(auction1.seller)
						.cancelAuction(auction1.auctionKey)
				).to.be.revertedWith("Auction has ended");
			});

			it("Should revert if the caller is not the auction seller", async function () {
				// Try to cancel the auction as the buyer
				await expect(
					cancelAuctionsFixture.nftMarketplace
						.connect(cancelAuctionsFixture.nftBuyer)
						.cancelAuction(auction1.auctionKey)
				).to.be.revertedWith("Not the auction seller");
			});

			it("Should not allow to reenter cancelAuction function", async function () {
				const attackerAuction: Auction = cancelAuctionsFixture.attackerNFTAuction;

				// Lister approves all its NFTs to NFTAttacker
				await cancelAuctionsFixture.nftAttacker
					.connect(cancelAuctionsFixture.nftLister)
					.setApprovalForAll(cancelAuctionsFixture.nftAttacker.address, true);

				await expect(
					cancelAuctionsFixture.nftAttacker
						.connect(cancelAuctionsFixture.nftLister)
						.attackCancelAuction(
							attackerAuction.tokenId,
							attackerAuction.price,
							attackerAuction.startTimestamp,
							attackerAuction.endTimestamp
						)
				).to.be.revertedWith("ReentrancyGuard: reentrant call");
			});
		});
	});
});
