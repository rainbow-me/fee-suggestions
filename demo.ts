import { JsonRpcProvider } from '@ethersproject/providers';
import { suggestFees } from './src';

const YOUR_API_KEY = '';

const main = async () => {
  const provider = new JsonRpcProvider(
    `https://ropsten.infura.io/v3/${YOUR_API_KEY}`
  );
  await suggestFees(provider);
};

main();
