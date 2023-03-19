import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
	NFTMarketplace,
} from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("NFTMarketplace", function () {
	// Types definition
	type EmptyMarketplaceData = {
		nftMarketplace: NFTMarketplace;
		marketPlaceOwner: SignerWithAddress;
		feeDestinationAccount: SignerWithAddress;
		otherAccount: SignerWithAddress;
	};

	// Global Variables
	const initialFee: number = 100;
	let emptyMarketplaceData: EmptyMarketplaceData;

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
		});
	});
});