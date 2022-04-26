# SingleBlockDeployer

This is a script written to deploy Ethereum coins in a single block. It uses Flashbots to submit the transactions as a bundle. 

This is based around specifically the Shibrobi contract (https://etherscan.io/token/0x372c95ce229a7af37d141f627d09f6df1dbaa741), and you'll need to make changes if your contract doesn't comply to this standard - but this gives you a good base concept of how each transaction is bundled. There's also some simulations that allow you to estimate gas limits well, as this type of bundling makes it difficult to estimate gas.  

Contact me on @rileytbc on Telegram, or put issues/PRs here. 
