import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
	NFTMarketplace,
	NFTMarketplace__factory,
	MyNFTWithPermit,
	MyNFTWithPermit__factory,
	AcceptNFTOfferAttacker__factory,
	AcceptNFTOfferAttacker,
	AcceptNFTOfferWithPermitAttacker,
	AcceptNFTOfferWithPermitAttacker__factory
} from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BytesLike } from "@ethersproject/bytes";
import { BigNumber } from "@ethersproject/bignumber";

const hre = require("hardhat"); // hardhat runtime

const _INTERFACE_ID_ERC721 = "0x80ac58cd";
const _INTERFACE_ID_ERC721_METADATA = "0x5b5e139f";
const _INTERFACE_ID_ERC165 = "0x01ffc9a7";
const _INTERFACE_WITH_PERMIT = "0x5604e225";

// Helper function to sign data using ethers.js _singTypedData
async function sign(
	tokenContract: MyNFTWithPermit,
	signerAccount: SignerWithAddress,
	spender: string,
	tokenId: BigNumber,
	nonce: BigNumber,
	deadline: BigNumber
) {
	const [name, version, chainId] = await Promise.all([
		tokenContract.name(),
		"1",
		signerAccount.getChainId(),
	]);

	const typedData = {
		types: {
			Permit: [
				{ name: "spender", type: "address" },
				{ name: "tokenId", type: "uint256" },
				{ name: "nonce", type: "uint256" },
				{ name: "deadline", type: "uint256" },
			],
		},
		primaryType: "Permit",
		domain: {
			name: name,
			version: version,
			chainId: chainId,
			verifyingContract: tokenContract.address,
		},
		message: {
			spender,
			tokenId,
			nonce,
			deadline,
		},
	};

	// sign Permit
	const signature = await signerAccount._signTypedData(
		typedData.domain,
		{ Permit: typedData.types.Permit },
		typedData.message
	);

	return signature;
}

describe("NFTMarketplace", function () {
	// Types definition
	type MarketplaceDataForOffers = {
		nftMarketplace: NFTMarketplace;
		marketPlaceOwner: SignerWithAddress;
		feeDestinationAccount: SignerWithAddress;
		nftSeller: SignerWithAddress;
		nftBuyer: SignerWithAddress;
		myNFTWithPermit: MyNFTWithPermit;
		tokenId: BigNumber;
		acceptNFTOfferAttacker: AcceptNFTOfferAttacker;
		acceptNFTOfferWithPermitAttacker: AcceptNFTOfferWithPermitAttacker;
	};

	// Global Variables
	let marketplaceDataForOffers: MarketplaceDataForOffers;

	async function deployNFMarketplaceAndMintTokensFixture(): Promise<MarketplaceDataForOffers> {
		// Contracts are deployed using the first signer/account by default
		const [marketPlaceOwner, feeDestinationAccount, nftSeller, nftBuyer] =
			await ethers.getSigners();

		const NFTMarketplace: NFTMarketplace__factory = await ethers.getContractFactory(
			"NFTMarketplace"
		);
		const nftMarketplace: NFTMarketplace = await NFTMarketplace.deploy();

		const MyNFTWithPermit: MyNFTWithPermit__factory = await ethers.getContractFactory(
			"MyNFTWithPermit"
		);
		const myNFTWithPermit: MyNFTWithPermit = await MyNFTWithPermit.deploy();

		await myNFTWithPermit.connect(nftSeller).mint();
		const tokenId: BigNumber = BigNumber.from(1);

		// Deploy contract to attack AcceptNFTOffer function
		const AcceptNFTOfferAttacker: AcceptNFTOfferAttacker__factory =
			await ethers.getContractFactory("AcceptNFTOfferAttacker");
		const acceptNFTOfferAttacker: AcceptNFTOfferAttacker = await AcceptNFTOfferAttacker.deploy(
			nftMarketplace.address
		);

		// Deploy contract to attack AcceptNFTOfferWithPermit
		const AcceptNFTOfferWithPermitAttacker: AcceptNFTOfferWithPermitAttacker__factory =
			await ethers.getContractFactory("AcceptNFTOfferWithPermitAttacker");
		const acceptNFTOfferWithPermitAttacker: AcceptNFTOfferWithPermitAttacker = await AcceptNFTOfferWithPermitAttacker.deploy(
			nftMarketplace.address
		);

		return {
			nftMarketplace,
			marketPlaceOwner,
			feeDestinationAccount,
			nftSeller,
			nftBuyer,
			myNFTWithPermit,
			tokenId,
			acceptNFTOfferAttacker,
			acceptNFTOfferWithPermitAttacker,
		};
	}

	describe("NFTOffers", function () {
		describe("Create NFT  Offers", function () {
			const offeredPrice: BigNumber = ethers.utils.parseEther("0.00001");

			this.beforeEach(async function () {
				marketplaceDataForOffers = await loadFixture(
					deployNFMarketplaceAndMintTokensFixture
				);
			});

			it("Should create a new NFT offer with the expected values and emit the NewNFTOffer event", async function () {
				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;

				await expect(
					marketplaceDataForOffers.nftMarketplace
						.connect(marketplaceDataForOffers.nftBuyer)
						.createNFTOffer(
							marketplaceDataForOffers.myNFTWithPermit.address,
							marketplaceDataForOffers.tokenId,
							{
								value: offeredPrice,
							}
						)
				)
					.to.emit(marketplaceDataForOffers.nftMarketplace, "NewNFTOffer")
					.withArgs(
						marketplaceDataForOffers.myNFTWithPermit.address,
						marketplaceDataForOffers.tokenId,
						marketplaceDataForOffers.nftSeller.address,
						marketplaceDataForOffers.nftBuyer.address,
						offeredPrice,
						BigNumber.from(blockTimestamp).add(1)
					);

				// Calculate listing key
				const nft1Key: BytesLike = ethers.utils.solidityKeccak256(
					["address", "uint256"],
					[marketplaceDataForOffers.myNFTWithPermit.address, 1]
				);

				// Retrieve the offer and validate that the offer value is correct
				const nftOffer = await marketplaceDataForOffers.nftMarketplace.nftOffers(
					nft1Key,
					marketplaceDataForOffers.nftBuyer.address
				);

				expect(nftOffer).to.equal(offeredPrice);
			});

			it("Should revert if the owner of the NFT tries to create an offer", async function () {
				await expect(
					marketplaceDataForOffers.nftMarketplace
						.connect(marketplaceDataForOffers.nftSeller)
						.createNFTOffer(
							marketplaceDataForOffers.myNFTWithPermit.address,
							marketplaceDataForOffers.tokenId,
							{
								value: offeredPrice,
							}
						)
				).to.be.revertedWith("NFT owner can't call this function");
			});

			it("Should revert if the NFT is listed in the marketplace", async function () {
				// Before creating the listing we need to approve the marketplace
				await marketplaceDataForOffers.myNFTWithPermit
					.connect(marketplaceDataForOffers.nftSeller)
					.approve(
						marketplaceDataForOffers.nftMarketplace.address,
						marketplaceDataForOffers.tokenId
					);

				// Now we create a listing for the NFT
				await marketplaceDataForOffers.nftMarketplace
					.connect(marketplaceDataForOffers.nftSeller)
					.createListing(
						marketplaceDataForOffers.myNFTWithPermit.address,
						marketplaceDataForOffers.tokenId,
						ethers.utils.parseEther("0.001") // could be any price
					);

				await expect(
					marketplaceDataForOffers.nftMarketplace
						.connect(marketplaceDataForOffers.nftBuyer)
						.createNFTOffer(
							marketplaceDataForOffers.myNFTWithPermit.address,
							marketplaceDataForOffers.tokenId,
							{
								value: offeredPrice,
							}
						)
				).to.be.revertedWith("NFT is already listed");
			});
		});

		describe("Cancel NFT  Offers", function () {
			const offeredPrice: BigNumber = ethers.utils.parseEther("0.00001");

			this.beforeEach(async function () {
				marketplaceDataForOffers = await loadFixture(
					deployNFMarketplaceAndMintTokensFixture
				);

				// Create an offer
				await marketplaceDataForOffers.nftMarketplace
					.connect(marketplaceDataForOffers.nftBuyer)
					.createNFTOffer(
						marketplaceDataForOffers.myNFTWithPermit.address,
						marketplaceDataForOffers.tokenId,
						{
							value: offeredPrice,
						}
					);
			});

			it("Should allow the offer creator to cancel an offer", async function () {
				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;

				await expect(
					marketplaceDataForOffers.nftMarketplace
						.connect(marketplaceDataForOffers.nftBuyer)
						.cancelNFTOffer(
							marketplaceDataForOffers.myNFTWithPermit.address,
							marketplaceDataForOffers.tokenId
						)
				)
					.to.emit(marketplaceDataForOffers.nftMarketplace, "NFTOfferCancelled")
					.withArgs(
						marketplaceDataForOffers.myNFTWithPermit.address,
						marketplaceDataForOffers.tokenId,
						await marketplaceDataForOffers.nftSeller.getAddress(),
						await marketplaceDataForOffers.nftBuyer.getAddress(),
						BigNumber.from(blockTimestamp).add(1)
					);

				// Check that the offer was deleted
				// Calculate listing key
				const nft1Key: BytesLike = ethers.utils.solidityKeccak256(
					["address", "uint256"],
					[marketplaceDataForOffers.myNFTWithPermit.address, 1]
				);

				const offer = await marketplaceDataForOffers.nftMarketplace.nftOffers(
					nft1Key,
					marketplaceDataForOffers.nftBuyer.address
				);

				// If the offer was deleted the value will be zero
				expect(offer).to.equal(ethers.constants.Zero);
			});

			it("Should revert if there's no offer created by the caller", async function () {
				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;

				await expect(
					marketplaceDataForOffers.nftMarketplace
						.connect(marketplaceDataForOffers.marketPlaceOwner)
						.cancelNFTOffer(
							marketplaceDataForOffers.myNFTWithPermit.address,
							marketplaceDataForOffers.tokenId
						)
				).to.be.revertedWith("Offer does not exist");
			});
		});

		describe("Accept NFT  Offers with previous approval", function () {
			let deadline: BigNumber;
			const offeredPrice: BigNumber = ethers.utils.parseEther("0.00001");


			this.beforeEach(async function () {
				marketplaceDataForOffers = await loadFixture(
					deployNFMarketplaceAndMintTokensFixture
				);

				deadline = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).add(
					86400 * 10
				);

				// Create an offer
				await marketplaceDataForOffers.nftMarketplace
					.connect(marketplaceDataForOffers.nftBuyer)
					.createNFTOffer(
						marketplaceDataForOffers.myNFTWithPermit.address,
						marketplaceDataForOffers.tokenId,
						{
							value: offeredPrice,
						}
					);
			});

			it("Should be able to accept an NFT offer with a previous approval and emit an NFTOfferAccepted event", async function () {
				const sellerPreviousBalance = await ethers.provider.getBalance(
					marketplaceDataForOffers.nftSeller.address
				);

				// Approve the MarketPlace for token 1 so it can transfer the NFT to the buyer
				await marketplaceDataForOffers.myNFTWithPermit
					.connect(marketplaceDataForOffers.nftSeller)
					.approve(
						marketplaceDataForOffers.nftMarketplace.address,
						marketplaceDataForOffers.tokenId
					);

				// Get timestamp before accepting the offer
				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;

				// Expect acceptNFTOffer to emit an event
				const acceptOfferTxPromise = marketplaceDataForOffers.nftMarketplace
					.connect(marketplaceDataForOffers.nftSeller)
					.acceptNFTOffer(
						marketplaceDataForOffers.myNFTWithPermit.address,
						marketplaceDataForOffers.tokenId,
						marketplaceDataForOffers.nftBuyer.address
					);

				// Trying another form of validating events an their values
				await expect(acceptOfferTxPromise).to.emit(
					marketplaceDataForOffers.nftMarketplace,
					"NFTOfferAccepted"
				);

				const txReceipt = await (await acceptOfferTxPromise).wait();

				const eventInterface = new ethers.utils.Interface([
					"event NFTOfferAccepted(address indexed nftAddress, uint256 tokenId, address indexed seller, address indexed buyer, uint256 offeredPrice, uint256 offerAcceptedTimestamp)",
				]);
				// The function call emits two events Transfer and NFTOfferAccepted so we take the 2nd event
				const data = txReceipt.logs[1].data;
				const topics = txReceipt.logs[1].topics;
				const event = eventInterface.decodeEventLog("NFTOfferAccepted", data, topics);
				expect(event.nftAddress).to.equal(marketplaceDataForOffers.myNFTWithPermit.address);
				expect(event.tokenId).to.equal(marketplaceDataForOffers.tokenId);
				expect(event.seller).to.equal(
					await marketplaceDataForOffers.nftSeller.getAddress()
				);
				expect(event.buyer).to.equal(await marketplaceDataForOffers.nftBuyer.getAddress());
				expect(event.offeredPrice).to.equal(offeredPrice);
				expect(event.offerAcceptedTimestamp).to.equal(
					BigNumber.from(blockTimestamp).add(1)
				);

				// NFT should be transferred to the buyer
				expect(
					await marketplaceDataForOffers.myNFTWithPermit.ownerOf(
						marketplaceDataForOffers.tokenId
					)
				).to.equal(await marketplaceDataForOffers.nftBuyer.getAddress());

				// Check that the offeredPrice in ether was transferred to the seller. We have a tolerance to consider gas
				expect(
					await ethers.provider.getBalance(marketplaceDataForOffers.nftSeller.address)
				).to.be.closeTo(sellerPreviousBalance.add(offeredPrice), 1000000000000000);

				// Check that the offer was deleted
				// Calculate listing key
				const nft1Key: BytesLike = ethers.utils.solidityKeccak256(
					["address", "uint256"],
					[marketplaceDataForOffers.myNFTWithPermit.address, 1]
				);

				const offer = await marketplaceDataForOffers.nftMarketplace.nftOffers(
					nft1Key,
					marketplaceDataForOffers.nftBuyer.address
				);

				// If the offer was deleted the value will be zero
				expect(offer).to.equal(ethers.constants.Zero);
			});

			it("Should revert if an account different than the NFT owner tries to accept an offer even with a previous approval", async function () {
				// Approve the MarketPlace for token 1 so it can transfer the NFT to the buyer
				await marketplaceDataForOffers.myNFTWithPermit
					.connect(marketplaceDataForOffers.nftSeller)
					.approve(
						marketplaceDataForOffers.nftMarketplace.address,
						marketplaceDataForOffers.tokenId
					);

				// Get timestamp before accepting the offer
				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;

				// Expect acceptNFTOffer to emit an event
				await expect(
					marketplaceDataForOffers.nftMarketplace
						.connect(marketplaceDataForOffers.marketPlaceOwner)
						.acceptNFTOffer(
							marketplaceDataForOffers.myNFTWithPermit.address,
							marketplaceDataForOffers.tokenId,
							marketplaceDataForOffers.nftBuyer.address
						)
				).to.be.revertedWith("Not the NFT owner");
			});

			it("Should revert when trying to reenter the AcceptNFTOffer function", async function () {
				await hre.network.provider.request({
					method: "hardhat_impersonateAccount",
					params: [marketplaceDataForOffers.acceptNFTOfferAttacker.address],
				});

				const nftAttackerSigner = await ethers.getSigner(
					marketplaceDataForOffers.acceptNFTOfferAttacker.address
				);

				// Send funds to the attacker contract so it can call functions
				await marketplaceDataForOffers.nftSeller.sendTransaction({
					to: marketplaceDataForOffers.acceptNFTOfferAttacker.address,
					value: ethers.utils.parseEther("10.0"),
				});

				// Create an offer for the NFT
				await marketplaceDataForOffers.nftMarketplace
					.connect(nftAttackerSigner)
					.createNFTOffer(
						marketplaceDataForOffers.myNFTWithPermit.address,
						marketplaceDataForOffers.tokenId,
						{
							value: offeredPrice,
						}
					);

				// The seller should approve the marketplace before accepting the offer
				await marketplaceDataForOffers.myNFTWithPermit
					.connect(marketplaceDataForOffers.nftSeller)
					.approve(
						marketplaceDataForOffers.nftMarketplace.address,
						marketplaceDataForOffers.tokenId
					);

				// The seller accepts the offer and the buyer/attacker will try to reenter
				await expect(
					marketplaceDataForOffers.nftMarketplace
						.connect(marketplaceDataForOffers.nftSeller)
						.acceptNFTOffer(
							marketplaceDataForOffers.myNFTWithPermit.address,
							marketplaceDataForOffers.tokenId,
							marketplaceDataForOffers.acceptNFTOfferAttacker.address
						)
				).to.be.revertedWith("ReentrancyGuard: reentrant call");
			});
		});

		describe("Accept NFT  Offers with permit", function () {
			// set deadline in 10 days
			let deadline: BigNumber;
			let offeredPrice: BigNumber;

			this.beforeEach(async function () {
				marketplaceDataForOffers = await loadFixture(
					deployNFMarketplaceAndMintTokensFixture
				);

				deadline = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).add(
					86400 * 10
				);

				offeredPrice = ethers.utils.parseEther("0.00001");

				// Create an offer
				await marketplaceDataForOffers.nftMarketplace
					.connect(marketplaceDataForOffers.nftBuyer)
					.createNFTOffer(
						marketplaceDataForOffers.myNFTWithPermit.address,
						marketplaceDataForOffers.tokenId,
						{
							value: offeredPrice,
						}
					);
			});

			it("Should accept an NFT offer using a permit and emit an NFTOfferAccepted event", async function () {
				// Sign Permit
				const signature = await sign(
					marketplaceDataForOffers.myNFTWithPermit,
					marketplaceDataForOffers.nftSeller,
					await marketplaceDataForOffers.nftMarketplace.address,
					marketplaceDataForOffers.tokenId,
					await marketplaceDataForOffers.myNFTWithPermit.nonces(
						marketplaceDataForOffers.tokenId
					),
					deadline
				);

				const blockTimestamp: number = (await ethers.provider.getBlock("latest")).timestamp;
				const sellerPreviousBalance = await ethers.provider.getBalance(
					marketplaceDataForOffers.nftSeller.address
				);

				// Expect transfer with permit to emit an event
				await expect(
					marketplaceDataForOffers.nftMarketplace
						.connect(marketplaceDataForOffers.nftSeller)
						.acceptNFTOfferWithPermit(
							marketplaceDataForOffers.myNFTWithPermit.address,
							marketplaceDataForOffers.tokenId,
							marketplaceDataForOffers.nftBuyer.address,
							deadline,
							signature
						)
				)
					.to.emit(marketplaceDataForOffers.nftMarketplace, "NFTOfferAccepted")
					.withArgs(
						marketplaceDataForOffers.myNFTWithPermit.address,
						marketplaceDataForOffers.tokenId,
						await marketplaceDataForOffers.nftSeller.getAddress(),
						await marketplaceDataForOffers.nftBuyer.getAddress(),
						offeredPrice,
						BigNumber.from(blockTimestamp).add(1)
					);

				// NFT should be transferred to the buyer
				expect(
					await marketplaceDataForOffers.myNFTWithPermit.ownerOf(
						marketplaceDataForOffers.tokenId
					)
				).to.equal(await marketplaceDataForOffers.nftBuyer.getAddress());

				// Check that the offeredPrice in ether was transferred to the seller. We have a tolerance to consider gas
				expect(
					await ethers.provider.getBalance(marketplaceDataForOffers.nftSeller.address)
				).to.be.closeTo(sellerPreviousBalance.add(offeredPrice), 1000000000000000);

				// Check that the offer was deleted
				// Calculate listing key
				const nft1Key: BytesLike = ethers.utils.solidityKeccak256(
					["address", "uint256"],
					[marketplaceDataForOffers.myNFTWithPermit.address, 1]
				);

				const offer = await marketplaceDataForOffers.nftMarketplace.nftOffers(
					nft1Key,
					marketplaceDataForOffers.nftBuyer.address
				);

				// If the offer was deleted the value will be zero
				expect(offer).to.equal(ethers.constants.Zero);
			});

			it("Should revert if the caller is not the NFT owner", async function () {
				// Sign Permit
				const signature = await sign(
					marketplaceDataForOffers.myNFTWithPermit,
					marketplaceDataForOffers.nftBuyer,
					await marketplaceDataForOffers.nftMarketplace.address,
					marketplaceDataForOffers.tokenId,
					await marketplaceDataForOffers.myNFTWithPermit.nonces(
						marketplaceDataForOffers.tokenId
					),
					deadline
				);

				// Expect transfer with permit to emit an event
				await expect(
					marketplaceDataForOffers.nftMarketplace
						.connect(marketplaceDataForOffers.nftBuyer) // Connecting with an account that doesn't own the nft
						.acceptNFTOfferWithPermit(
							marketplaceDataForOffers.myNFTWithPermit.address,
							marketplaceDataForOffers.tokenId,
							marketplaceDataForOffers.nftBuyer.address,
							deadline,
							signature
						)
				).to.be.revertedWith("Not the NFT owner");
			});

			it("Should revert if the receiver of the token is address 0x", async function () {
				// Sign Permit
				const signature = await sign(
					marketplaceDataForOffers.myNFTWithPermit,
					marketplaceDataForOffers.nftSeller,
					ethers.constants.AddressZero,
					//await marketplaceDataForOffers.nftMarketplace.address,
					marketplaceDataForOffers.tokenId,
					await marketplaceDataForOffers.myNFTWithPermit.nonces(
						marketplaceDataForOffers.tokenId
					),
					deadline
				);

				// Expect transfer with permit to emit an event
				await expect(
					marketplaceDataForOffers.nftMarketplace
						.connect(marketplaceDataForOffers.nftSeller) // Connecting with an account that doesn't own the nft
						.acceptNFTOfferWithPermit(
							marketplaceDataForOffers.myNFTWithPermit.address,
							marketplaceDataForOffers.tokenId,
							ethers.constants.AddressZero, // Receiver is zero address
							deadline,
							signature
						)
				).to.be.revertedWith("Receiver can't be Zero address");
			});

			it("Should revert when trying to reenter the AcceptNFTOfferWithPermit function", async function () {
				await hre.network.provider.request({
					method: "hardhat_impersonateAccount",
					params: [marketplaceDataForOffers.acceptNFTOfferWithPermitAttacker.address],
				});

				const nftAttackerSigner = await ethers.getSigner(
					marketplaceDataForOffers.acceptNFTOfferWithPermitAttacker.address
				);

				// Send funds to the attacker contract so it can call functions
				await marketplaceDataForOffers.nftSeller.sendTransaction({
					to: marketplaceDataForOffers.acceptNFTOfferWithPermitAttacker.address,
					value: ethers.utils.parseEther("10.0"),
				});

				// Create an offer for the NFT
				await marketplaceDataForOffers.nftMarketplace
					.connect(nftAttackerSigner)
					.createNFTOffer(
						marketplaceDataForOffers.myNFTWithPermit.address,
						marketplaceDataForOffers.tokenId,
						{
							value: offeredPrice,
						}
					);

				// Sign Permit
				const signature = await sign(
					marketplaceDataForOffers.myNFTWithPermit,
					marketplaceDataForOffers.nftSeller,
					await marketplaceDataForOffers.nftMarketplace.address,
					marketplaceDataForOffers.tokenId,
					await marketplaceDataForOffers.myNFTWithPermit.nonces(
						marketplaceDataForOffers.tokenId
					),
					deadline
				);

				// The seller accepts the offer and the buyer/attacker will try to reenter
				await expect(
					marketplaceDataForOffers.nftMarketplace
						.connect(marketplaceDataForOffers.nftSeller)
						.acceptNFTOfferWithPermit(
							marketplaceDataForOffers.myNFTWithPermit.address,
							marketplaceDataForOffers.tokenId,
							marketplaceDataForOffers.acceptNFTOfferWithPermitAttacker.address,
							deadline,
							signature
						)
				).to.be.revertedWith("ReentrancyGuard: reentrant call");
			});
		});
	});
});
