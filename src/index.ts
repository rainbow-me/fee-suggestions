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
    [10, 15, 30, 45],
  ]);
  const blocksRewards = feeHistory.reward;

  if (!blocksRewards.length) throw new Error('Error: block reward was empty');

  const blocksRewardsPerc10 = rewardsFilterOutliers(blocksRewards, 0);
  const blocksRewardsPerc15 = rewardsFilterOutliers(blocksRewards, 1);
  const blocksRewardsPerc30 = rewardsFilterOutliers(blocksRewards, 2);
  const blocksRewardsPerc45 = rewardsFilterOutliers(blocksRewards, 3);

  const emaPerc10 = ema(blocksRewardsPerc10, blocksRewardsPerc10.length).at(-1);
  const emaPerc15 = ema(blocksRewardsPerc15, blocksRewardsPerc15.length).at(-1);
  const emaPerc30 = ema(blocksRewardsPerc30, blocksRewardsPerc30.length).at(-1);
  const emaPerc45 = ema(blocksRewardsPerc45, blocksRewardsPerc45.length).at(-1);

  if (
    emaPerc10 === undefined ||
    emaPerc15 === undefined ||
    emaPerc30 === undefined ||
    emaPerc45 === undefined
  )
    throw new Error('Error: ema was undefined');

  return {
    confirmationTimeByPriorityFee: {
      15: gweiToWei(emaPerc45),
      30: gweiToWei(emaPerc30),
      45: gweiToWei(emaPerc15),
      60: gweiToWei(emaPerc10),
    },
    maxPriorityFeeSuggestions: {
      fast: gweiToWei(Math.max(emaPerc30, 1.5)),
      normal: gweiToWei(Math.max(emaPerc15, 1)),
      urgent: gweiToWei(emaPerc45),
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
