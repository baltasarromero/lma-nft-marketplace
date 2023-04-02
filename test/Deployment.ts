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
	};

	// Global Variables
	let emptyMarketplaceData: EmptyMarketplaceData;

	// We define a fixture to reuse the same setup in every test.
	// We use loadFixture to run this setup once, snapshot that state,
	// and reset Hardhat Network to that snapshot in every test.
	async function deployCleanNFMarketplaceFixture(): Promise<{
		nftMarketplace: NFTMarketplace;
		marketPlaceOwner: SignerWithAddress;
	}> {
		// Contracts are deployed using the first signer/account by default
		const [marketPlaceOwner] =
			await ethers.getSigners();

		const NFTMarketplace = await ethers.getContractFactory(
			"NFTMarketplace"
		);
		const nftMarketplace = await NFTMarketplace.deploy();

		return {
			nftMarketplace,
			marketPlaceOwner
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
	});
});