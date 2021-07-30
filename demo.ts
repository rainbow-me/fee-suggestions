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