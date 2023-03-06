import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { expect } from "chai"
import { ethers } from "hardhat"

describe("NFTMarketplace", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployCleanNFMarketplaceFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners()

        const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace")
        const nftMarketplace = await NFTMarketplace.deploy()

        return { owner, otherAccount }
    }

    async function deployNFMarketplaceWithDataFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners()

        const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace")
        const nftMarketplace = await NFTMarketplace.deploy()

        return { owner, otherAccount }
    }

    describe("Deployment", function () {})
})