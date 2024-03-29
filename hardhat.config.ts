import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();

import { HardhatUserConfig, task, subtask } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const lazyImport = async (module: any) => {
	return await import(module);
};

const config: HardhatUserConfig = {
	solidity: {
		version: "0.8.16",
		settings: {
			optimizer: {
				enabled: true,
				runs: 200,
				details: {
					yul: true,
				},
			},
			viaIR: false,
		},
		compilers: [
			{
				version: "0.8.16",
			},
		],
	},
	networks: {
		// Goerli Testnet
		goerli: {
			url: process.env.INFURA_GOERLI_URL || "",
			chainId: 5,
			accounts: [],
		},
		sepolia: {
			url: process.env.INFURA_SEPOLIA_URL || "",
			chainId: 11155111,
			accounts: [],
		},
	},
	etherscan: {
		// Your API key for Etherscan
		// Obtain one at <https://etherscan.io/>
		apiKey: process.env.ETHERSCAN_API_KEY || "",
	},
};

// Tasks
task("deploy", "Deploys contract to local network").setAction(async () => {
	const { main } = await lazyImport("./scripts/deploy");
	await main();
});

subtask("print", "Prints a message")
	.addParam("message", "The message to print")
	.setAction(async (taskArgs) => {
		console.log(taskArgs.message);
	});

task("deploy-nft-marketplace", "Deploys NFTMarketplace with pk passed as parameter")
	.addParam("privateKey", "Please provide the private key")
	.setAction(async ({ privateKey }) => {
		const { main } = await lazyImport("./scripts/deploy-nft-marketplace");
		await main(privateKey);
	});

task("deploy-nft-test-cars", "Deploys TestCarsNFT with pk passed as parameter")
	.addParam("privateKey", "Please provide the private key")
	.setAction(async ({ privateKey }) => {
		const { main } = await lazyImport("./scripts/deploy-nft-test-cars");
		await main(privateKey);
	});

task("deploy-my-nft-with-permit", "Deploys MyNFTWithPermit with pk passed as parameter")
	.addParam("privateKey", "Please provide the private key")
	.setAction(async ({ privateKey }) => {
		const { main } = await lazyImport("./scripts/deploy-my-nft-with-permit");
		await main(privateKey);
	});

export default config;
