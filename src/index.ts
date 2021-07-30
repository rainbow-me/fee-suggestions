import { BigNumber } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";

type Reward = string[];
type GasUsedRatio = number[];

interface FeeHistoryResponse {
    baseFeePerGas: string[],
    gasUsedRatio: GasUsedRatio,
    oldestBlock: number,
    reward: Reward[],
}

/*
suggestFees returns a series of maxFeePerGas / maxPriorityFeePerGas values suggested for different time preferences. 
The first element corresponds to the highest time preference (most urgent transaction).
The basic idea behind the algorithm is similar to the old "gas price oracle" used in Geth; 
it takes the prices of recent blocks and makes a suggestion based on a low percentile of those prices. 
With EIP-1559 though the base fee of each block provides a less noisy and more reliable price signal.
This allows for more sophisticated suggestions with a variable width (exponentially weighted) base fee time window.
The window width corresponds to the time preference of the user. The underlying assumption is that price fluctuations over a given past time period indicate the probabilty of similar price levels being re-tested by the market over a similar length future time period.
*/
export const suggestFees = async (
  provider: JsonRpcProvider,
  sampleMin = 0.1,
  sampleMax = 0.3,
  maxTimeFactor = 15,
  extraTipRatio = 0.25,
  fallbackTip = 5e9
) => {
  // feeHistory API call without a reward percentile specified is cheap even with a light client backend because it only needs block headers.
  // Therefore we can afford to fetch a hundred blocks of base fee history in order to make meaningful estimates on variable time scales.
  const feeHistory: FeeHistoryResponse = await provider.send("eth_feeHistory", [100, "latest", []]);
  const baseFee: number[] = [];
  const order = [];
  for (let i = 0; i < feeHistory.baseFeePerGas.length; i++) {
    baseFee.push(Number(feeHistory.baseFeePerGas[i]));
    order.push(i);
  }

  // If a block is full then the baseFee of the next block is copied. The reason is that in full blocks the minimal tip might not be enough to get included.
  // The last (pending) block is also assumed to end up being full in order to give some upwards bias for urgent suggestions.
  baseFee[baseFee.length - 1] *= 9 / 8;
  for (let i = feeHistory.gasUsedRatio.length - 1; i >= 0; i--) {
    if (feeHistory.gasUsedRatio[i] > 0.9) {
      baseFee[i] = baseFee[i + 1];
    }
  }

  order.sort((a, b) => {
    let aa = baseFee[a];
    let bb = baseFee[b];
    if (aa < bb) {
      return -1;
    }
    if (aa > bb) {
      return 1;
    }
    return 0;
  });

  const tip = await suggestTip(
    feeHistory.oldestBlock,
    feeHistory.gasUsedRatio,
    fallbackTip,
    provider
  );
  const result = [];
  let maxBaseFee = 0;
  for (let timeFactor = maxTimeFactor; timeFactor >= 0; timeFactor--) {
    let bf = suggestBaseFee(baseFee, order, timeFactor, sampleMin, sampleMax);
    let t = tip;
    if (bf > maxBaseFee) {
      maxBaseFee = bf;
    } else {
      // If a narrower time window yields a lower base fee suggestion than a wider window then we are probably in a price dip.
      // In this case getting included with a low tip is not guaranteed; instead we use the higher base fee suggestion
      // and also offer extra tip to increase the chance of getting included in the base fee dip.
      t += (maxBaseFee - bf) * extraTipRatio;
      bf = maxBaseFee;
    }
    result[timeFactor] = {
      maxFeePerGas: Math.round(bf + t),
      maxPriorityFeePerGas: Math.round(t),
    };
  }
  
  return result;
};

// suggestTip suggests a tip (maxPriorityFeePerGas) value that's usually sufficient for blocks that are not full.
const suggestTip = async (
  firstBlock: number,
  gasUsedRatio: GasUsedRatio,
  fallbackTip: number,
  provider: JsonRpcProvider
) => {
  let ptr = gasUsedRatio.length - 1;
  let needBlocks = 5;
  const rewards = [];
  while (needBlocks > 0 && ptr >= 0) {
    const blockCount = maxBlockCount(gasUsedRatio, ptr, needBlocks);
    if (blockCount > 0) {
      // feeHistory API call with reward percentile specified is expensive and therefore is only requested for a few non-full recent blocks.
      const feeHistory: FeeHistoryResponse = await provider.send("eth_feeHistory", [
        blockCount,
        BigNumber.from(firstBlock + ptr).toHexString(),
        [10],
      ]);
      for (let i = 0; i < feeHistory.reward.length; i++) {
        rewards.push(Number(feeHistory.reward[i][0]));
      }
      if (feeHistory.reward.length < blockCount) {
        break;
      }
      needBlocks -= blockCount;
    }
    ptr -= blockCount + 1;
  }

  if (rewards.length == 0) {
    return fallbackTip;
  }
  rewards.sort();
  return rewards[Math.floor(rewards.length / 2)];
};

// maxBlockCount returns the number of consecutive blocks suitable for tip suggestion (gasUsedRatio between 0.1 and 0.9).
const maxBlockCount = (
  gasUsedRatio: GasUsedRatio,
  ptr: number,
  needBlocks: number
) => {
  let blockCount = 0;
  while (needBlocks > 0 && ptr >= 0) {
    if (gasUsedRatio[ptr] < 0.1 || gasUsedRatio[ptr] > 0.9) {
      break;
    }
    ptr--;
    needBlocks--;
    blockCount++;
  }
  return blockCount;
};

// suggestBaseFee calculates an average of base fees in the sampleMin to sampleMax percentile range of recent base fee history, each block weighted with an exponential time function based on timeFactor.
const suggestBaseFee = (
  baseFee: string | any[],
  order: string | any[],
  timeFactor: number,
  sampleMin: number,
  sampleMax: number
) => {
  if (timeFactor < 1e-6) {
    return baseFee[baseFee.length - 1];
  }
  const pendingWeight =
    (1 - Math.exp(-1 / timeFactor)) /
    (1 - Math.exp(-baseFee.length / timeFactor));
  let sumWeight = 0;
  let result = 0;
  let samplingCurveLast = 0;
  for (let i = 0; i < order.length; i++) {
    sumWeight +=
      pendingWeight * Math.exp((order[i] - baseFee.length + 1) / timeFactor);
    const samplingCurveValue = samplingCurve(sumWeight, sampleMin, sampleMax);
    result += (samplingCurveValue - samplingCurveLast) * baseFee[order[i]];
    if (samplingCurveValue >= 1) {
      return result;
    }
    samplingCurveLast = samplingCurveValue;
  }
  return result;
};

// samplingCurve is a helper function for the base fee percentile range calculation.
const samplingCurve = (
  sumWeight: number,
  sampleMin: number,
  sampleMax: number
) => {
  if (sumWeight <= sampleMin) {
    return 0;
  }
  if (sumWeight >= sampleMax) {
    return 1;
  }
  return (
    (1 -
      Math.cos(
        ((sumWeight - sampleMin) * 2 * Math.PI) / (sampleMax - sampleMin)
      )) /
    2
  );
};
