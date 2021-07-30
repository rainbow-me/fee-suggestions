# 🔥🔥🔥 EIP1559 fee suggestions 🔥🔥🔥

This is a utility function in Javascript that returns returns a series of maxFeePerGas / maxPriorityFeePerGas values suggested for different time preferences.
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
\*/

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

2 - Add your infura API_KEY on `demo.ts:5`

3 - `yarn start`

### Credits

This code is 100% based on the work of @zsfelfoldi published at https://github.com/zsfelfoldi/ethereum-docs/blob/master/eip1559/feeHistory_example.js

It only adds compatibility for ethers and some es6 minor changes.
