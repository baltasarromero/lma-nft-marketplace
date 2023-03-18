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
import hre from "hardhat";

describe("NFTMarketplace", function () {
	// Types definition
	type EndAuctionsFixtureData = {
		nftMarketplace: NFTMarketplace;
		marketPlaceOwner: SignerWithAddress;
		feeDestinationAccount: SignerWithAddress;
		nftLister: SignerWithAddress;
		nftBidder: SignerWithAddress;
		nftBidder2: SignerWithAddress;
		testCarsNFT: TestCarsNFT;
		nftAttacker: NFTAttacker;
		auctionWithoutBids: Auction;
		auctionWithBids: Auction;
		attackerNFTAuction: Auction;
	};

	type Auction = {
		auctionKey: BytesLike;
		nft: TestCarsNFT;
		tokenId: number;
		seller: SignerWithAddress;
		bidder: SignerWithAddress | undefined;
		price: BigNumber;
		fundsByUser: Map<SignerWithAddress, BigNumber>;
		highestBidder: SignerWithAddress | undefined;
		highestBid: BigNumber;
		startTimestamp: BigNumber;
		endTimestamp: BigNumber;
	};

	// Global Variables
	const initialFee: number = 100;
	let endAuctionsTestData: EndAuctionsFixtureData;
	// Mint first NFT to be listed
	const CAR_1_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/1.json";
	const CAR_2_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/2.json";
	const CAR_3_METADATA_URI =
		"ipfs://bafybeigagr2hhn554ocpmidas6ifqxlmzmug533z7sh75dmhfrnoj3pmje/3.json";

	async function endAuctionsFixture(): Promise<EndAuctionsFixtureData> {
		// Contracts are deployed using the first signer/account by default
		const [marketPlaceOwner, feeDestinationAccount, nftLister, nftBidder, nftBidder2] =
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

		// The seller needs to approve the contract before creating the auction
		await testCarsNFT.connect(nftLister).approve(nftMarketplace.address, tokenId1);

		// Mint 2nd Token
		// Mint first NFT to be listed
		await testCarsNFT.safeMint(CAR_2_METADATA_URI, nftLister.address);
		const tokenId2: number = 2;

		// The seller needs to approve the contract before creating the auction
		await testCarsNFT.connect(nftLister).approve(nftMarketplace.address, tokenId2);

		// Mint third NFT to be listed
		await testCarsNFT.safeMint(CAR_3_METADATA_URI, nftLister.address);
		const tokenId3: number = 3;
		// The seller needs to approve the contract before creating the auction
		await testCarsNFT.connect(nftLister).approve(nftMarketplace.address, tokenId3);

		// Deploy AttackerNFT contract
		const NFTAttacker: NFTAttacker__factory = await ethers.getContractFactory("NFTAttacker");
		const nftAttacker: NFTAttacker = await NFTAttacker.deploy(
			"NFTAttacker",
			"NFTA",
			nftMarketplace.address
		);

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

		const auctionWithoutBids: Auction = {
			auctionKey: auction1Key,
			nft: testCarsNFT,
			tokenId: tokenId1,
			seller: nftLister,
			bidder: undefined,
			price: auctionFloorPrice,
			fundsByUser: new Map<SignerWithAddress, BigNumber>(),
			highestBidder: undefined,
			highestBid: BigNumber.from(0),
			startTimestamp: auctionStartTimestamp,
			endTimestamp: auctionEndTimestamp,
		};

		// Calculate listing key
		const auctionWithBidsKey: BytesLike = ethers.utils.solidityKeccak256(
			["address", "uint256"],
			[testCarsNFT.address, 3]
		);

		const auctionWithBidsStart: BigNumber = BigNumber.from(
			(await ethers.provider.getBlock("latest")).timestamp
		);
		const auctionWithBidsEnd: BigNumber = BigNumber.from(
			(await ethers.provider.getBlock("latest")).timestamp
		).add(86400 * 10); // end will be 10 days in the future

		const auctionWithBids: Auction = {
			auctionKey: auctionWithBidsKey,
			nft: testCarsNFT,
			tokenId: tokenId3,
			seller: nftLister,
			bidder: undefined,
			fundsByUser: new Map<SignerWithAddress, BigNumber>(),
			highestBidder: undefined,
			highestBid: BigNumber.from(0),
			price: auctionFloorPrice,
			startTimestamp: auctionWithBidsStart,
			endTimestamp: auctionWithBidsEnd,
		};

		// Create auction and don't create any bids
		await nftMarketplace
			.connect(auctionWithoutBids.seller)
			.createAuction(
				auctionWithoutBids.nft.address,
				auctionWithoutBids.tokenId,
				auctionWithoutBids.price,
				auctionWithoutBids.startTimestamp,
				auctionWithoutBids.endTimestamp
			);

		// Create the auction and then add two bids
		await nftMarketplace
			.connect(auctionWithBids.seller)
			.createAuction(
				auctionWithBids.nft.address,
				auctionWithBids.tokenId,
				auctionWithBids.price,
				auctionWithBids.startTimestamp,
				auctionWithBids.endTimestamp
			);

		// Create first bid
		const bid1Amount = ethers.utils.parseEther("1.5");

		await nftMarketplace
			.connect(nftBidder)
			.bid(auctionWithBids.auctionKey, { value: bid1Amount });

		// Create second bid
		const bid2Amount = ethers.utils.parseEther("1.7");

		await nftMarketplace
			.connect(nftBidder2)
			.bid(auctionWithBids.auctionKey, { value: bid2Amount });

		// Bidder 2 is the highest bidder
		auctionWithBids.highestBidder = nftBidder2;
		// Highest bid is 1.7 ETH
		auctionWithBids.highestBid = bid2Amount;

		// Attacker auction
		// Mint an attacker NFT
		// Send ether to the attacker contract so it can perform the attack
		await nftBidder.sendTransaction({
			to: nftAttacker.address,
			value: ethers.utils.parseEther("10.0"), // Sends exactly 10.0 ether
		});

		await nftAttacker.safeMint(CAR_1_METADATA_URI, nftAttacker.address);
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
			bidder: undefined,
			fundsByUser: new Map<SignerWithAddress, BigNumber>(),
			highestBidder: undefined,
			highestBid: BigNumber.from(0),
			price: auctionFloorPrice,
			startTimestamp: auctionStartTimestamp,
			endTimestamp: auctionEndTimestamp,
		};

		return {
			nftMarketplace,
			marketPlaceOwner,
			feeDestinationAccount,
			nftLister: nftLister,
			nftBidder: nftBidder,
			nftBidder2: nftBidder2,
			testCarsNFT,
			nftAttacker,
			auctionWithoutBids: auctionWithoutBids,
			auctionWithBids: auctionWithBids,
			attackerNFTAuction,
		};
	}

	describe("Auctions", function () {
		describe("End auctions", function () {
			let auctionWithoutBids: Auction;
			let auctionWithBids: Auction;

			this.beforeEach(async function () {
				endAuctionsTestData = await loadFixture(endAuctionsFixture);

				auctionWithoutBids = endAuctionsTestData.auctionWithoutBids;
				auctionWithBids = endAuctionsTestData.auctionWithBids;
			});

			it("Should allow to end an auction with no bids that is past endTimestamp and return the NFT to the seller and emit an event", async function () {
				// Change time to be past the auction's end
				time.increaseTo(auctionWithoutBids.endTimestamp.add(1));

				await expect(
					endAuctionsTestData.nftMarketplace
						.connect(auctionWithoutBids.seller)
						.endAuction(auctionWithoutBids.auctionKey)
				)
					.to.emit(endAuctionsTestData.nftMarketplace, "AuctionFinished")
					.withArgs(
						auctionWithoutBids.nft.address,
						auctionWithoutBids.tokenId,
						auctionWithoutBids.highestBid,
						auctionWithoutBids.seller.address,
						ethers.constants.AddressZero,
						auctionWithoutBids.endTimestamp.add(2)
					);

				// Get the auction and check that it was properly updated
				const auction = await endAuctionsTestData.nftMarketplace.auctions(
					auctionWithoutBids.auctionKey
				);

				expect(auction.ended).to.be.true;
				expect(auction.highestBidder).to.equal(ethers.constants.AddressZero);

				// Check that the NFT was transferred to the seller
				expect(await auctionWithoutBids.nft.ownerOf(auctionWithoutBids.tokenId)).to.equal(
					auctionWithoutBids.seller.address
				);
			});

			it("Should allow to end an auction with bids that is past endTimestamp, transfer the NFT to the buyer and the bidAmount to the seller", async function () {
				const sellerPreviousBalance = await ethers.provider.getBalance(
					auctionWithBids.seller.address
				);

				// Change time to be past the auction's end
				time.increaseTo(auctionWithBids.endTimestamp.add(1));

				await expect(
					endAuctionsTestData.nftMarketplace
						.connect(auctionWithBids.seller)
						.endAuction(auctionWithBids.auctionKey)
				)
					.to.emit(endAuctionsTestData.nftMarketplace, "AuctionFinished")
					.withArgs(
						auctionWithBids.nft.address,
						auctionWithBids.tokenId,
						auctionWithBids.highestBid,
						auctionWithBids.seller.address,
						auctionWithBids.highestBidder?.address,
						auctionWithBids.endTimestamp.add(2)
					);

				// Get the auction and check that it was properly updated
				const auction = await endAuctionsTestData.nftMarketplace.auctions(
					auctionWithBids.auctionKey
				);

				// Auction should be marked as ended
				expect(auction.ended).to.be.true;
				// Winner should be the second bidder
				expect(auction.highestBidder).to.equal(endAuctionsTestData.nftBidder2.address);

				// Check that the NFT was transferred to the buyer
				expect(await auctionWithBids.nft.ownerOf(auctionWithBids.tokenId)).to.equal(
					auction.highestBidder
				);

				// Check that the sellers balance was increased
				expect(
					await ethers.provider.getBalance(auctionWithBids.seller.address)
				).to.be.greaterThan(sellerPreviousBalance);
			});

			it("Should not allow to end an auction before endTimestamp", async function () {
				// Seller tries to end the auction
				await expect(
					endAuctionsTestData.nftMarketplace
						.connect(endAuctionsTestData.nftLister)
						.endAuction(auctionWithoutBids.auctionKey)
				).to.be.revertedWith("Haven't reached end time");
			});

			it("Should not allow to end an auction if not called by the seller", async function () {
				// Seller tries to end the auction
				await expect(
					endAuctionsTestData.nftMarketplace
						.connect(endAuctionsTestData.nftBidder)
						.endAuction(auctionWithoutBids.auctionKey)
				).to.be.revertedWith("Not the auction seller");
			});

			it("Should not allow to end an already cancelled auction", async function () {
				// Cancel the auction
				await endAuctionsTestData.nftMarketplace
					.connect(auctionWithoutBids.seller)
					.cancelAuction(auctionWithoutBids.auctionKey);

				// Seller tries to end the auction that is already cancelled
				await expect(
					endAuctionsTestData.nftMarketplace
						.connect(auctionWithoutBids.seller)
						.endAuction(auctionWithoutBids.auctionKey)
				).to.be.revertedWith("Auction is already cancelled");
			});

			it("Should not allow to end an already ended auction", async function () {
				// Change time to be past the auction's end
				time.increaseTo(auctionWithoutBids.endTimestamp.add(1));

				// Cancel the auction
				await endAuctionsTestData.nftMarketplace
					.connect(auctionWithoutBids.seller)
					.endAuction(auctionWithoutBids.auctionKey);

				// Seller tries to end the auction that is already cancelled
				await expect(
					endAuctionsTestData.nftMarketplace
						.connect(auctionWithoutBids.seller)
						.endAuction(auctionWithoutBids.auctionKey)
				).to.be.revertedWith("Auction already ended");
			});

			it("Should not allow to reenter endAuction function", async function () {
				const attackerAuction: Auction = endAuctionsTestData.attackerNFTAuction;

				const nftAttackerContractAddress: string = endAuctionsTestData.nftAttacker.address;

				// Impersonate the attacker contract so we can perform the attack
				await hre.network.provider.request({
					method: "hardhat_impersonateAccount",
					params: [nftAttackerContractAddress],
				});

				const attackerSigner = await ethers.getSigner(nftAttackerContractAddress);

				// Create the auction using the attacker contract
				await endAuctionsTestData.nftAttacker
					.connect(attackerSigner)
					.approveAndCreateAuction(
						attackerAuction.tokenId,
						attackerAuction.price,
						attackerAuction.startTimestamp,
						attackerAuction.endTimestamp
					);

				// After creating the auction advance the time so we can end the auction
				time.increaseTo(attackerAuction.endTimestamp.add(1));

				await expect(
					endAuctionsTestData.nftAttacker
						.connect(endAuctionsTestData.nftLister)
						.attackEndAuction(attackerAuction.tokenId)
				).to.be.revertedWith("ReentrancyGuard: reentrant call");
			});
		});
	});
});
