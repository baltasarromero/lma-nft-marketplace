import { ethers } from "hardhat";
import hre from 'hardhat';

export async function main( _privateKey: string, _feeDestinationAccount: string, _feeAmount: BigInteger) {
  await hre.run('print', { message: `Private Key:  ${_privateKey}` });
  const selectedNetwork: string = hre.network.name;
  await hre.run('print', { message: `Deploying to network:  ${selectedNetwork}` });
  const wallet = new ethers.Wallet(_privateKey, ethers.provider); // New wallet with the privateKey passed from CLI as param
  await hre.run('print', { message: `Deploying contract with account: ${wallet.address}` });
  const NFT_MARKETPLACE_FACTORY = await ethers.getContractFactory("NFTMarketplace");
  const nftMarketplace = await NFT_MARKETPLACE_FACTORY.connect(wallet).deploy(_feeDestinationAccount, _feeAmount);
  await nftMarketplace.deployed();
  await hre.run('print', { message: `The NFTMarketplace contract is deployed to ${nftMarketplace.address}` });  
  const owner = await nftMarketplace.owner();
  await hre.run('print', { message: `The NFTMarketplace contract owner is ${owner}` });
}