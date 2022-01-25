# 🔥 EIP-1559 Fee Suggestions 🔥

The function `suggestFees()` is a utility function written in Javascript and it's intended to use with an [ethers.js](https://docs.ethers.io/v5/) provider.
 
It returns an object containing:
- `maxBaseFee` and `maxPriorityFee` suggestions
- `baseFeeTrend` indicator
- `currentBaseFee` which is the current block base fee
- `confirmationTimeByPriorityFee` an object containing estimated times of confirmation by priority fee chosen
- `blocksToConfirmationByPriorityFee` an object containing estimated blocks of wait for a confirmation by priority fee chosen
- `blocksToConfirmationByBaseFee` an object containing estimated blocks of wait for a confirmation by base fee chosen

### Usage

```
import { JsonRpcProvider } from '@ethersproject/providers';
import { suggestFees } from './src';

const main = async() => {
    const provider = new JsonRpcProvider(`https://ropsten.infura.io/v3/${YOUR_API_KEY}`);
    const ret = await suggestFees(provider);
    console.log('Result: ', ret);
}

main();
```

In addition, you can use specific methods to get `maxBaseFee` and `maxPriorityFee` specific data.

```
import { JsonRpcProvider } from '@ethersproject/providers';
import { suggestFees } from './src';

const main = async() => {
    const provider = new JsonRpcProvider(`https://ropsten.infura.io/v3/${YOUR_API_KEY}`);
    const fromBlock = 'latest' // the block that you want to run the estimations from
    const blockCountHistory = 100 // the quantity of blocks you want to take in account for the estimation
    const ret = await suggestMaxBaseFee(provider, fromBlock, blockCountHistory);
    console.log('Result: ', ret);
}

main();
```

```
import { JsonRpcProvider } from '@ethersproject/providers';
import { suggestFees } from './src';

const main = async() => {
    const provider = new JsonRpcProvider(`https://ropsten.infura.io/v3/${YOUR_API_KEY}`);
    const fromBlock = 'latest' // the block that you want to run the estimations from
    const ret = await suggestMaxPriorityFee(provider, fromBlock, blockCountHistory);
    console.log('Result: ', ret);
}

main();
```

### Credits

The `suggestMaxBaseFee` estimations code is 100% based on the work of [@zsfelfoldi](https://github.com/zsfelfoldi) published at https://github.com/zsfelfoldi/feehistory/