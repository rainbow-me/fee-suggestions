import { JsonRpcProvider } from '@ethersproject/providers';
import { ema } from 'moving-averages';
import {
  FeeHistoryResponse,
  MaxFeeSuggestions,
  MaxPriorityFeeSuggestions,
  Suggestions,
} from './entities';
import {
  gweiToWei,
  linearRegression,
  rewardsFilterOutliers,
  suggestBaseFee,
  weiToGweiNumber,
} from './utils';

export const suggestMaxBaseFee = async (
  provider: JsonRpcProvider,
  fromBlock = 'latest',
  blockCountHistory = 100,
  sampleMin = 0.1,
  sampleMax = 0.3,
  maxTimeFactor = 15
): Promise<MaxFeeSuggestions> => {
  // feeHistory API call without a reward percentile specified is cheap even with a light client backend because it only needs block headers.
  // Therefore we can afford to fetch a hundred blocks of base fee history in order to make meaningful estimates on variable time scales.
  const feeHistory: FeeHistoryResponse = await provider.send('eth_feeHistory', [
    blockCountHistory,
    fromBlock,
    [],
  ]);
  const baseFees: number[] = [];
  const order = [];
  for (let i = 0; i < feeHistory.baseFeePerGas.length; i++) {
    baseFees.push(weiToGweiNumber(feeHistory.baseFeePerGas[i]));
    order.push(i);
  }

  const blocksArray = Array.from(Array(blockCountHistory + 1).keys());
  const trend = linearRegression(baseFees, blocksArray);

  // If a block is full then the baseFee of the next block is copied. The reason is that in full blocks the minimal tip might not be enough to get included.
  // The last (pending) block is also assumed to end up being full in order to give some upwards bias for urgent suggestions.
  baseFees[baseFees.length - 1] *= 9 / 8;
  for (let i = feeHistory.gasUsedRatio.length - 1; i >= 0; i--) {
    if (feeHistory.gasUsedRatio[i] > 0.9) {
      baseFees[i] = baseFees[i + 1];
    }
  }

  order.sort((a, b) => {
    const aa = baseFees[a];
    const bb = baseFees[b];
    if (aa < bb) {
      return -1;
    }
    if (aa > bb) {
      return 1;
    }
    return 0;
  });

  const result = [];
  let maxBaseFee = 0;
  for (let timeFactor = maxTimeFactor; timeFactor >= 0; timeFactor--) {
    let bf = suggestBaseFee(baseFees, order, timeFactor, sampleMin, sampleMax);
    if (bf > maxBaseFee) {
      maxBaseFee = bf;
    } else {
      bf = maxBaseFee;
    }
    result[timeFactor] = bf;
  }
  const suggestedMaxBaseFee = Math.max(...result);

  return {
    baseFeeSuggestion: gweiToWei(suggestedMaxBaseFee),
    baseFeeTrend: trend,
  };
};

export const suggestMaxPriorityFee = async (
  provider: JsonRpcProvider,
  fromBlock = 'latest'
): Promise<MaxPriorityFeeSuggestions> => {
  const feeHistory: FeeHistoryResponse = await provider.send('eth_feeHistory', [
    10,
    fromBlock,
    [10, 20, 25, 30, 40, 50],
  ]);
  const blocksRewards = feeHistory.reward;

  if (!blocksRewards.length) throw new Error('Error: block reward was empty');

  const blocksRewardsPerc10 = rewardsFilterOutliers(blocksRewards, 0);
  const blocksRewardsPerc20 = rewardsFilterOutliers(blocksRewards, 1);
  const blocksRewardsPerc25 = rewardsFilterOutliers(blocksRewards, 2);
  const blocksRewardsPerc30 = rewardsFilterOutliers(blocksRewards, 3);
  const blocksRewardsPerc40 = rewardsFilterOutliers(blocksRewards, 4);
  const blocksRewardsPerc50 = rewardsFilterOutliers(blocksRewards, 5);

  const emaPerc10 = ema(blocksRewardsPerc10, blocksRewardsPerc10.length).at(-1);
  const emaPerc20 = ema(blocksRewardsPerc20, blocksRewardsPerc20.length).at(-1);
  const emaPerc25 = ema(blocksRewardsPerc25, blocksRewardsPerc25.length).at(-1);
  const emaPerc30 = ema(blocksRewardsPerc30, blocksRewardsPerc30.length).at(-1);
  const emaPerc40 = ema(blocksRewardsPerc40, blocksRewardsPerc40.length).at(-1);
  const emaPerc50 = ema(blocksRewardsPerc50, blocksRewardsPerc50.length).at(-1);

  if (
    emaPerc10 === undefined ||
    emaPerc20 === undefined ||
    emaPerc25 === undefined ||
    emaPerc30 === undefined ||
    emaPerc40 === undefined ||
    emaPerc50 === undefined
  )
    throw new Error('Error: ema was undefined');

  return {
    confirmationTimeByPriorityFee: {
      15: gweiToWei(emaPerc50),
      30: gweiToWei(emaPerc40),
      45: gweiToWei(emaPerc30),
      60: gweiToWei(emaPerc25),
      75: gweiToWei(emaPerc10),
    },
    maxPriorityFeeSuggestions: {
      fast: gweiToWei(emaPerc30),
      normal: gweiToWei(emaPerc20),
      urgent: gweiToWei(emaPerc40),
    },
  };
};

export const suggestFees = async (
  provider: JsonRpcProvider
): Promise<Suggestions> => {
  const { baseFeeSuggestion, baseFeeTrend } = await suggestMaxBaseFee(provider);
  const { maxPriorityFeeSuggestions, confirmationTimeByPriorityFee } =
    await suggestMaxPriorityFee(provider);
  return {
    baseFeeSuggestion,
    baseFeeTrend,
    confirmationTimeByPriorityFee,
    maxPriorityFeeSuggestions,
  };
};
