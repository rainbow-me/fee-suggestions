# 🔥🔥🔥 EIP1559 fee suggestions 🔥🔥🔥

 The function suggestFees() is a utility function written in Javascript and it's intended to use with an [ethers.js](https://docs.ethers.io/v5/) provider. It returns a list of suggested maxFeePerGas / maxPriorityFeePerGas pairs where the index of the list is the timeFactor. A low timeFactor should be used for urgent transactions while higher values yield more economical suggestions that are expected to require more blocks to get included with a given chance. Note that the relationship between timeFactor and inclusion chance in future blocks is not exactly determined but depends on the market behavior. Some rough estimates for this relationship might be calculated once we have actual market data to analyze.

The application frontend might display the fees vs time factor as a bar graph or curve. The steepness of this curve might also give a hint to users on whether there is currently a local congestion.

The return value is an array that looks like this:

```
[
  { maxFeePerGas: 1026172753, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172752, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172752, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172752, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172752, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172752, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172752, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172752, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172752, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172752, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172752, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172752, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172752, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172752, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172752, maxPriorityFeePerGas: 1026172744 },
  { maxFeePerGas: 1026172751, maxPriorityFeePerGas: 1026172744 }
]
```

The first element corresponds to the highest time preference (most urgent transaction).
The basic idea behind the algorithm is similar to the old "gas price oracle" used in Geth; it takes the prices of recent blocks and makes a suggestion based on a low percentile of those prices. With EIP-1559 though the base fee of each block provides a less noisy and more reliable price signal. This allows for more sophisticated suggestions with a variable width (exponentially weighted) base fee time window. The window width corresponds to the time preference of the user. The underlying assumption is that price fluctuations over a given past time period indicate the probabilty of similar price levels being re-tested by the market over a similar length future time period.

### Usage

```
import { JsonRpcProvider } from '@ethersproject/providers';
import { suggestFees } from './src';

const main = async() => {
    const provider = new JsonRpcProvider(`https://ropsten.infura.io/v3/${YOUR_API_KEY}`);
    const ret = await suggestFees(provider);
    console.log('Result');
    console.log(ret);
    console.log('done');
}

main();
```

### To test it locally

1 - Install deps via `yarn`

2 - Add your Infura API_KEY on `demo.ts:4`

3 - `yarn start`

### Credits

This code is 100% based on the work of [@zsfelfoldi](https://github.com/zsfelfoldi) published at https://github.com/zsfelfoldi/feehistory/

It only adds compatibility for ethers and some JS related minor changes.
