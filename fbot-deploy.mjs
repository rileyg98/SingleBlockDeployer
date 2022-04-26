// Hardhat SingleBlockDeployer script 
// Built by Riley of Two Brothers Crypto
// SPDX-License-Identifier: GPL-3.0-only 

// You will need ethers (required for hardhat) and @flashbots/ethers-provider-bundle as well as @ethersproject/address
// Install via npm install --save-dev @ethersproject/address @flashbots/ethers-provider-bundle


// Flashbots deployer script
import hre from "hardhat";
import { providers, Wallet, ethers } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import { getContractAddress } from "@ethersproject/address";

// Config details

// An RPC url (NOT FLASHBOTS) that we can use for gas estimation and nonce calculation
// Alchemy or Infura do good free ones
// We can use the default, otherwise, but I'd recommend one of the above.
const ETHEREUM_RPC_URL = "";
// The name of your contract (not the .sol file, the contract!)
const CAName = "";
// An optional private key to allow you to get reputation on Flashbots. If you don't provide one, we'll generate a random one.
// Don't put one you use anywhere else in here, it's just a signing key - doesn't need ETH. 
const signerPK = "";
// The deployer private key. You actually do need to put one of these in, and it needs money. I recommend you generate a new one for each contract.
const PRIVATE_KEY = "";
// Network: only supports "mainnet" or "goerli" due to flashbots
// Defaults to mainnet if you don't fill it in right
const nw = "goerli";

// How many tokens to send to the contract excluding decimals
const tokSend = "500000000000000000"; 
// How many decimals
const decimals = 9;
// How much ether to send, with the decimals
const ethSend = "0.01";

// Maximum base fee you're willing to pay, in gwei
// If gas goes above this, your launch will be submitted and fail to be included until it drops back under (delay, not failure)
const maxBase = 10;
// Priority fee (miner tip) you're willing to pay, in gwei - worth putting this a little higher than normal for flashbots
const prio = 2;

async function main() {
// Standard json rpc provider directly from ethers.js (NOT Flashbots)
var provider;
var authSigner;
if(signerPK == "") {
  authSigner = Wallet.createRandom();
} else {
  authSigner = new Wallet(signerPK);
}
console.log("Signer wallet: ", authSigner.address)

var flashbotsProvider;
if(ETHEREUM_RPC_URL == "") {
  // Use a default
  if(nw == "goerli") {
    provider = new providers.getDefaultProvider("goerli");
    flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner, 'https://relay-goerli.flashbots.net/', 'goerli');
  } else {
    provider = new providers.getDefaultProvider("mainnet");
    flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner, 'https://relay.flashbots.net/', 'mainnet');
  }
  
} else {
  if(nw == "goerli") {
    provider = new providers.JsonRpcProvider({ url: ETHEREUM_RPC_URL, network: "goerli" });
    flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner, 'https://relay-goerli.flashbots.net/', 'goerli');

  } else {
    provider = new providers.JsonRpcProvider({ url: ETHEREUM_RPC_URL, network: "mainnet" });
    flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner, 'https://relay.flashbots.net/', 'mainnet');
  }
  
}

console.log("Provider: ", provider)
await provider.ready;

const wallet = new Wallet(PRIVATE_KEY);
console.log("Privkey loaded");

const toDeploy = await hre.ethers.getContractFactory(CAName);
console.log("Size: " + toDeploy.bytecode.length);
const deployTx = toDeploy.getDeployTransaction();
// Amount to set
const sendAmtTok = ethers.utils.parseUnits(tokSend, decimals);
const sendAmt = ethers.utils.parseEther(ethSend);
var conWal = await wallet.connect(provider);
var nonce = await conWal.getTransactionCount();
console.log("Nonce: ", nonce);
if(nonce == null) {
  nonce = 0;
}

// Get chainId;
var chainId = (await provider.getNetwork()).chainId;

// Read the max possible base fee 3 blocks in future - should give us enough buffer
var block = await provider.getBlock(await provider.getBlockNumber());
var maxPossibleBaseFee = FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(block.baseFeePerGas, 3);
var baseFee;
// Only set up to the maximum base fee
if(maxPossibleBaseFee > maxBase) {
  baseFee = maxBase;
} else {
  baseFee = maxPossibleBaseFee;
}
deployTx.type = 2;
deployTx.chainId = chainId;
deployTx.maxFeePerGas = baseFee + prio;
deployTx.maxPriorityFeePerGas = prio;
// Valid gas estimation
deployTx.gasLimit = parseInt((await conWal.estimateGas(deployTx)) * 1.5);

const ca = getContractAddress({from: await conWal.getAddress(), nonce: nonce});
console.log("CA: ", ca);
const artifact = await hre.artifacts.readArtifact(CAName);
const abi = artifact.abi;
const greeterCA = new ethers.Contract(ca, abi, provider);

var tokenTx = await greeterCA.populateTransaction['transfer'](ca, sendAmtTok);

// Gas simulations fail in this, use guides
tokenTx.gasLimit = parseInt(200000);
tokenTx.maxFeePerGas = baseFee + prio;
tokenTx.maxPriorityFeePerGas = prio;
tokenTx.type = 2;
tokenTx.chainId = chainId;
console.log("Token TX: ", tokenTx);
const ethTx = {to: ca,
  // The value of ETH to send
  value: sendAmt,
  gasLimit: 25000,
  type: 2,
  chainId: chainId,
  maxFeePerGas: baseFee + prio,
  maxPriorityFeePerGas: prio};
console.log("Eth TX: ", ethTx);

var openTradeTx = await greeterCA.populateTransaction['openTrading']();
openTradeTx.maxFeePerGas = baseFee + prio;
openTradeTx.maxPriorityFeePerGas = prio;
openTradeTx.type = 2;
openTradeTx.chainId = chainId;
// Work out why sim doesn't work here?
openTradeTx.gasLimit = parseInt(4000000);
console.log("Open TX: ", openTradeTx);

const transactionBundle = [
    {
        signer: conWal,
        transaction: deployTx
    },
    {
        signer: conWal,
        transaction: tokenTx
    },
    {
        signer: conWal,
        transaction: ethTx
    },
    {
        signer: conWal,
        transaction: openTradeTx
    }
  ]
var signedTransactions = await flashbotsProvider.signBundle(transactionBundle);
//console.log("txns: ", signedTransactions);
console.log("Simulating.");
var simResp = await flashbotsProvider.simulate(signedTransactions, await provider.getBlockNumber() + 1);
console.log("Sim result: ", simResp);
// Use the simulation results to tune the gas
tokenTx.gasLimit = parseInt(simResp.results[1].gasUsed * 1.5);
openTradeTx.gasLimit = parseInt(simResp.results[3].gasUsed * 1.5);
// Re-sim
console.log("Re-simulating.");
//console.log("TX bundle: ", transactionBundle);

signedTransactions = await flashbotsProvider.signBundle(transactionBundle);
simResp = await flashbotsProvider.simulate(signedTransactions, await provider.getBlockNumber() + 1);
console.log("Re-sim result: ", simResp);
/*
console.log("Sending bundle.");
// Target block number
var txResp = await flashbotsProvider.sendBundle(transactionBundle, await provider.getBlockNumber() + 1);
var waitRes = await txResp.wait();
while(waitRes != 0) {
  var blockNum = await provider.getBlockNumber();
  console.log("Trying block ", blockNum+1);
  txResp = await flashbotsProvider.sendBundle(transactionBundle, blockNum + 1);
  var txHash = txResp.bundleTransactions[0].txHash
  waitRes = await txResp.wait();
  console.log(waitRes);
}
*/
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
