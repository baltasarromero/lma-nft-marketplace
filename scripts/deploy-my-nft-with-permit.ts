import { ethers } from "hardhat";
import hre from 'hardhat';

export async function main( _privateKey: string) {
  await hre.run('print', { message: `Private Key:  ${_privateKey}` });
  const selectedNetwork: string = hre.network.name;
  await hre.run('print', { message: `Deploying to network:  ${selectedNetwork}` });
  const wallet = new ethers.Wallet(_privateKey, ethers.provider); // New wallet with the privateKey passed from CLI as param
  await hre.run('print', { message: `Deploying MyNFTWithPermit contract with account: ${wallet.address}` });
  const MY_NFT_WITH_PERMIT = await ethers.getContractFactory("MyNFTWithPermit");
  const myNFTWithPermit = await MY_NFT_WITH_PERMIT.connect(wallet).deploy();
  await myNFTWithPermit.deployed();
  await hre.run('print', { message: `The MyNFTWithPermit contract is deployed to ${myNFTWithPermit.address}` });  
}