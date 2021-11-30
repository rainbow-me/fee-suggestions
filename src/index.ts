import { JsonRpcProvider } from '@ethersproject/providers';
import { ema } from 'moving-averages';
import {
  FeeHistoryResponse,
  MaxFeeSuggestions,
  MaxPriorityFeeSuggestions,
  Suggestions,
} from './entities';
import {
  getOutlierBlocksToRemove,
  gweiToWei,
  linearRegression,
  rewardsFilterOutliers,
  suggestBaseFee,
  weiToGweiNumber,
  weiToString,
} from './utils';
export const suggestMaxBaseFee = async (
  provider: JsonRpcProvider,
  fromBlock = 'latest',
  blockCountHistory = 100
): Promise<MaxFeeSuggestions> => {
  const feeHistory: FeeHistoryResponse = await provider.send('eth_feeHistory', [
    blockCountHistory,
    fromBlock,
    [],
  ]);
  const currentBaseFee = weiToString(
    feeHistory?.baseFeePerGas[feeHistory?.baseFeePerGas.length - 1]
  );
  const baseFees: number[] = [];
  const order = [];
  for (let i = 0; i < feeHistory.baseFeePerGas.length; i++) {
    baseFees.push(weiToGweiNumber(feeHistory.baseFeePerGas[i]));
    order.push(i);
  }
  // calculate max, min and median
  const calc = (baseFees: number[]) => {
    const sortedBaseFees = baseFees.sort((a, b) => a - b);
    const min = sortedBaseFees[0];
    const max = sortedBaseFees[sortedBaseFees.length - 1];
    const median = sortedBaseFees[Math.floor(sortedBaseFees.length / 2)];
    return { max, median, min };
  };
  const createSubsets = (numbers: number[], n: number) => {
    const subsets = [];
    for (let i = 0; i < numbers.length; i = i + n) {
      subsets.push(numbers.slice(i, i + n));
    }
    return subsets;
  };
  const getSubsetsData = (numbers: number[], n: number) => {
    const subsets = createSubsets(numbers, n);
    const subsetsInfo = subsets.map((subset) => calc(subset));
    return subsetsInfo;
  };
  const getData = (numbers: number[], n: number) => {
    const subsetsData = getSubsetsData(numbers, n);
    const maxData = subsetsData.map((data) => data.max);
    const minData = subsetsData.map((data) => data.min);
    const medianData = subsetsData.map((data) => data.median);
    const maxLR = linearRegression(maxData);
    const minLR = linearRegression(minData);
    const medianLR = linearRegression(medianData);
    return {
      max: maxData[maxData.length - 1],
      maxLR,
      median: medianData[medianData.length - 1],
      medianLR,
      min: minData[minData.length - 1],
      minLR,
    };
  };
  const baseFees5Blocks = baseFees.slice(blockCountHistory - 5 + 1);
  const n5 = {
    g1: getData(baseFees5Blocks, 1),
    g5: getData(baseFees5Blocks, 5),
  };
  const baseFees25Blocks = baseFees.slice(blockCountHistory - 25 + 1);
  const n25 = {
    g1: getData(baseFees25Blocks, 1),
    g5: getData(baseFees25Blocks, 5),
  };
  // blocks 50
  const baseFees50Blocks = baseFees.slice(blockCountHistory - 50 + 1);
  // groups 1, 5, 10
  const n50 = {
    g1: getData(baseFees50Blocks, 1),
    g10: getData(baseFees50Blocks, 10),
    g5: getData(baseFees50Blocks, 5),
  };
  // blocks 100
  const baseFees100Blocks = baseFees.slice(1);
  // groups 1, 5, 10
  const n100 = {
    g1: getData(baseFees100Blocks, 1),
    g10: getData(baseFees100Blocks, 10),
    g25: getData(baseFees100Blocks, 25),
    g5: getData(baseFees100Blocks, 5),
    g50: getData(baseFees100Blocks, 50),
  };
  // /////////////
  const maxByMedian = n100.g25.max / n100.g25.median;
  const minByMedian = n100.g25.min / n100.g25.median;
  let trend = 0;
  // surging
  if (maxByMedian > 1.5) {
    trend = 2;
  } else if (maxByMedian > 1.275 && minByMedian > 0.725) {
    trend = 1;
  } else if (maxByMedian < 1.275 && minByMedian > 0.725) {
    if (n50.g5.medianLR < -5) {
      trend = -1;
    } else {
      trend = 0;
    }
  } else if (maxByMedian < 1.275 && minByMedian < 0.725) {
    trend = -1;
  } else {
    // if none is on the threshold
    if (weiToGweiNumber(currentBaseFee) > n100.g25.median) {
      trend = 1;
    } else {
      trend = -1;
    }
  }
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
  for (let timeFactor = 15; timeFactor >= 0; timeFactor--) {
    let bf = suggestBaseFee(baseFees, order, timeFactor, 0.1, 0.3);
    if (bf > maxBaseFee) {
      maxBaseFee = bf;
    } else {
      bf = maxBaseFee;
    }
    result[timeFactor] = bf;
  }
  const suggestedMaxBaseFee = Math.max(...result);
  return {
    baseFeeTrend: trend,
    currentBaseFee,
    maxBaseFeeSuggestion: gweiToWei(suggestedMaxBaseFee),
    trends: {
      n100,
      n25,
      n5,
      n50,
    },
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

  const outlierBlocks = getOutlierBlocksToRemove(blocksRewards, 0);

  const blocksRewardsPerc10 = rewardsFilterOutliers(
    blocksRewards,
    outlierBlocks,
    0
  );
  const blocksRewardsPerc15 = rewardsFilterOutliers(
    blocksRewards,
    outlierBlocks,
    1
  );
  const blocksRewardsPerc30 = rewardsFilterOutliers(
    blocksRewards,
    outlierBlocks,
    2
  );
  const blocksRewardsPerc45 = rewardsFilterOutliers(
    blocksRewards,
    outlierBlocks,
    3
  );

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
      urgent: gweiToWei(Math.max(emaPerc45, 2)),
    },
  };
};
export const suggestFees = async (
  provider: JsonRpcProvider
): Promise<Suggestions> => {
  const { maxBaseFeeSuggestion, trends, baseFeeTrend, currentBaseFee } =
    await suggestMaxBaseFee(provider);
  const { maxPriorityFeeSuggestions, confirmationTimeByPriorityFee } =
    await suggestMaxPriorityFee(provider);
  return {
    baseFeeTrend,
    confirmationTimeByPriorityFee,
    currentBaseFee,
    maxBaseFeeSuggestion,
    maxPriorityFeeSuggestions,
    trends,
  };
};
