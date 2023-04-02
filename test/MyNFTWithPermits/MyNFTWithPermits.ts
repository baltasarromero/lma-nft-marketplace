import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
	MyNFTWithPermit,
	MyNFTWithPermit__factory
} from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "@ethersproject/bignumber";

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

describe("MY NFT With Permits", function () {
	// Types definition
	type NFTWithPermitsFixtureData = {
		nftSeller: SignerWithAddress;
		nftBuyer: SignerWithAddress;
        otherSigner: SignerWithAddress;
        myNFTWithPermit: MyNFTWithPermit;
        tokenId: BigNumber;
	};

	// Global Variables
	let nFTWithPermitsFixtureData: NFTWithPermitsFixtureData;

	async function deployNFTWithPermitsFixture(): Promise<NFTWithPermitsFixtureData> {
		// Contracts are deployed using the first signer/account by default
		const [nftSeller, nftBuyer, otherSigner] =
			await ethers.getSigners();

		const MyNFTWithPermit: MyNFTWithPermit__factory = await ethers.getContractFactory(
			"MyNFTWithPermit"
		);
		const myNFTWithPermit: MyNFTWithPermit = await MyNFTWithPermit.deploy();

		await myNFTWithPermit.connect(nftSeller).mint();
		const tokenId: BigNumber = BigNumber.from(1);

		return {
			nftSeller,
			nftBuyer,
            otherSigner,
			myNFTWithPermit,
            tokenId
		};
	}

    describe("My NFT with Permits", function () {
        let tokenContract: MyNFTWithPermit;
        let seller: SignerWithAddress;
        let  buyer: SignerWithAddress;
        let otherSigner: SignerWithAddress;
        let tokenId: BigNumber;
        let deadline: BigNumber; 
        
       
        this.beforeEach(async function () {
            nFTWithPermitsFixtureData = await loadFixture(
                deployNFTWithPermitsFixture
            );     

            tokenContract = nFTWithPermitsFixtureData.myNFTWithPermit;
            seller = nFTWithPermitsFixtureData.nftSeller;
            buyer = nFTWithPermitsFixtureData.nftBuyer;
            otherSigner = nFTWithPermitsFixtureData.otherSigner;
            tokenId = nFTWithPermitsFixtureData.tokenId;
            
            // set deadline in 10 days
            deadline = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).add(
                86400 * 10
            );
        });

        describe("Interfaces", async function () {
            it("has all the right interfaces", async function () {
                const interfaces = [
                    _INTERFACE_ID_ERC721,
                    _INTERFACE_ID_ERC721_METADATA,
                    _INTERFACE_ID_ERC165,
                    _INTERFACE_WITH_PERMIT,
                ];
                for (const i of interfaces) {
                    expect(await tokenContract.supportsInterface(i))
                        .to.be.true;
                }
            });
        });

        describe("Permit", async function () {
            it("Increments nonce after each transfer", async function () {
                expect(await tokenContract.nonces(tokenId)).to.be.equal(0);

                await tokenContract
                    .connect(seller)
                    .transferFrom(await seller.getAddress(), await buyer.getAddress(), tokenId);

                expect(await tokenContract.nonces(tokenId)).to.be.equal(1);

                await tokenContract
                    .connect(buyer)
                    .transferFrom(await buyer.getAddress(), await seller.getAddress(), tokenId);

                expect(await tokenContract.nonces(tokenId)).to.be.equal(2);
            });
        });

        it("Can use permit to get approved", async function () {
            // sign Permit for bob
            const signature = await sign(
                tokenContract,
                seller,
                await buyer.getAddress(),
                tokenId, // tokenId that we want to approve
                await tokenContract.nonces(tokenId),
                BigNumber.from(deadline)
            );

            // verify that bob is not approved before permit is used
            expect(await tokenContract.getApproved(tokenId)).to.not.equal(
                await buyer.getAddress()
            );

            // use permit. We connect with an account different than the signer to validate that permit can be used by anyone
            await tokenContract
                .connect(buyer)
                .permit(await buyer.getAddress(), tokenId, deadline, signature);

            // verify that now bob is approved
            expect(await tokenContract.getApproved(tokenId)).to.be.equal(
                await buyer.getAddress()
            );
        });

        it("Can not use a permit after a transfer (cause nonce does not match)", async function () {
            // sign Permit for bob
            const signature = await sign(
                tokenContract,
                seller,
                await buyer.getAddress(),
                tokenId, 
                await tokenContract.nonces(tokenId),
                deadline
            );

            // First transfer NFT to buyer to increase the nonce once
            await tokenContract
                .connect(seller)
                .transferFrom(await seller.getAddress(), await buyer.getAddress(), 1);

            // then send back to the seller so we have the same owner as the signature (but nonce won't be correct)
            await tokenContract
                .connect(buyer)
                .transferFrom(await buyer.getAddress(), await seller.getAddress(), 1);

            // Try to use permit, should throw because nonce is not valid anymore
            await expect(
                tokenContract
                    .connect(buyer)
                    .permit(await buyer.getAddress(), tokenId, deadline, signature)
            ).to.be.revertedWith("ERC721WithPermit: INVALID_PERMIT_SIGNATURE!");
        });

        it("Can not use a permit with correct nonce but wrong owner", async function () {
            // first transfer to otherSigner
            await tokenContract
                .connect(seller)
                .transferFrom(
                    await seller.getAddress(),
                    await otherSigner.getAddress(),
                    1
                );

            // sign Permit for buyer
            // Permit will be signed using seller account, so nonce is right, but owner isn't
            const signature = await sign(
                tokenContract,
                seller,
                await buyer.getAddress(),
                tokenId,
                BigNumber.from(1), // nonce is one here
                deadline
            );

            // then try to use permit, should throw because owner is wrong
            await expect(
                tokenContract
                    .connect(buyer)
                    .permit(await buyer.getAddress(), tokenId, deadline, signature)
            ).to.be.revertedWith("ERC721WithPermit: INVALID_PERMIT_SIGNATURE!");
        });

        it("Can not use an expired permit ", async function () {
            // Set deadline 10 days in the past
            deadline = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).sub(
                86400 * 10
            );

            // Sign Permit for buyer
            // this Permit is expired as deadline is in the past
            const signature = await sign(
                tokenContract,
                buyer,
                await buyer.getAddress(),
                tokenId, // Token ID is 1
                await tokenContract.nonces(tokenId),
                deadline
            );

            await expect(
                tokenContract
                    .connect(buyer)
                    .permit(await buyer.getAddress(), tokenId, deadline, signature)
            ).to.be.revertedWith("ERC721WithPermit: PERMIT_DEADLINE_EXPIRED!");
        });

        it("Approved / approvedForAll accounts can create valid permits", async function () {
            // first send token to otherSigner
            await tokenContract
                .connect(seller)
                .transferFrom(
                    await seller.getAddress(),
                    await otherSigner.getAddress(),
                    tokenId
                );

            // Get a signature from seller for the buyer
            // sign Permit for the buyer
            const signature = await sign(
                tokenContract,
                seller,
                await buyer.getAddress(),
                tokenId,
                await tokenContract.nonces(tokenId),
                deadline
            );

            // Buyer tries to use signature, it should fail because deployer is not approved
            await expect(
                tokenContract
                    .connect(buyer)
                    .permit(await buyer.getAddress(), tokenId, deadline, signature)
            ).to.be.revertedWith("ERC721WithPermit: INVALID_PERMIT_SIGNATURE!");

            // otherSigner owner approves seller
            await tokenContract
                .connect(otherSigner)
                .setApprovalForAll(await seller.getAddress(), true);

            // now using the permit should work because the seller is approvedForAll on MarketplaceOwner's tokens
            await tokenContract
                .connect(buyer)
                .permit(await buyer.getAddress(), tokenId, deadline, signature);

            // Buyer should now be approved on tokenId one
            expect(await tokenContract.getApproved(tokenId)).to.be.equal(
                await buyer.getAddress()
            );
        });

        it("Can use permit to get approved and transfer in the same tx (safeTransferFromWithPermit)", async function () {
            // sign Permit for bob
            const signature = await sign(
                tokenContract,
                seller,
                await buyer.getAddress(),
                tokenId,
                await tokenContract.nonces(tokenId),
                deadline
            );

            expect(await tokenContract.getApproved(tokenId)).to.not.equal(
                await buyer.getAddress()
            );

            await tokenContract
                .connect(buyer)
                .safeTransferFromWithPermit(
                    await seller.getAddress(),
                    await buyer.getAddress(),
                    tokenId,
                    [],
                    deadline,
                    signature
                );

            expect(await tokenContract.ownerOf(tokenId)).to.be.equal(await buyer.getAddress());
        });

        it("Can not use permit to get approved and transfer in the same tx if wrong sender", async function () {
            // Sign Permit for buyer
            const signature = await sign(
                tokenContract,
                seller,
                await buyer.getAddress(),
                tokenId,
                await tokenContract.nonces(tokenId),
                deadline
            );

            // try to use permit for buyer with otherSigner's account
            await expect(
                tokenContract
                    .connect(otherSigner)
                    .safeTransferFromWithPermit(
                        await seller.getAddress(),
                        await buyer.getAddress(),
                        tokenId,
                        [],
                        deadline,
                        signature
                    )
            ).to.be.revertedWith("ERC721WithPermit: INVALID_PERMIT_SIGNATURE!");
        });
    });
});
