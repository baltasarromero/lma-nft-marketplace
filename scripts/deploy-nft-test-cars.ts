import { ethers } from "hardhat";
import hre from 'hardhat';

export async function main( _privateKey: string) {
  await hre.run('print', { message: `Private Key:  ${_privateKey}` });
  const selectedNetwork: string = hre.network.name;
  await hre.run('print', { message: `Deploying to network:  ${selectedNetwork}` });
  const wallet = new ethers.Wallet(_privateKey, ethers.provider); // New wallet with the privateKey passed from CLI as param
  await hre.run('print', { message: `Deploying contract with account: ${wallet.address}` });
  const TEST_CARS_NFT_FACTORY = await ethers.getContractFactory("TestCarsNFT");
  const testCarsNFT = await TEST_CARS_NFT_FACTORY.connect(wallet).deploy();
  await testCarsNFT.deployed();
  await hre.run('print', { message: `The TestCarsNFT contract is deployed to ${testCarsNFT.address}` });  
}