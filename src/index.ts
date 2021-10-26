import { JsonRpcProvider } from '@ethersproject/providers';
import { ema } from 'moving-averages';
import {
  FeeHistoryResponse,
  MaxFeeSuggestions,
  MaxPriorityFeeSuggestions,
  Suggestions,
} from './entities';
import { toGwei } from './utils';

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

const linearRegression = (y: number[], x: number[]) => {
  const n = y.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < y.length; i++) {
    const cY = Number(y[i]);
    const cX = Number(x[i]);
    sumX += cX;
    sumY += cY;
    sumXY += cX * cY;
    sumXX += cX * cX;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  return slope;
};

const suggestBaseFee = (
  baseFee: number[],
  order: number[],
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
  for (let or of order) {
    sumWeight +=
      pendingWeight * Math.exp((or - baseFee.length + 1) / timeFactor);
    const samplingCurveValue = samplingCurve(sumWeight, sampleMin, sampleMax);
    result += (samplingCurveValue - samplingCurveLast) * baseFee[or];
    if (samplingCurveValue >= 1) {
      return result;
    }
    samplingCurveLast = samplingCurveValue;
  }
  return result;
};

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
    baseFees.push(toGwei(feeHistory.baseFeePerGas[i]));
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

  return { baseFeeSuggestion: Math.max(...result), baseFeeTrend: trend };
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
  const blocksRewardsPerc10 = blocksRewards.map((reward) => toGwei(reward[0]));
  const blocksRewardsPerc20 = blocksRewards.map((reward) => toGwei(reward[1]));
  const blocksRewardsPerc25 = blocksRewards.map((reward) => toGwei(reward[2]));
  const blocksRewardsPerc30 = blocksRewards.map((reward) => toGwei(reward[3]));
  const blocksRewardsPerc40 = blocksRewards.map((reward) => toGwei(reward[4]));
  const blocksRewardsPerc50 = blocksRewards.map((reward) => toGwei(reward[5]));

  const emaPerc10: number = ema(
    blocksRewardsPerc10,
    blocksRewardsPerc10.length
  ).at(-1);
  const emaPerc20: number = ema(
    blocksRewardsPerc20,
    blocksRewardsPerc20.length
  ).at(-1);
  const emaPerc25: number = ema(
    blocksRewardsPerc25,
    blocksRewardsPerc25.length
  ).at(-1);
  const emaPerc30: number = ema(
    blocksRewardsPerc30,
    blocksRewardsPerc30.length
  ).at(-1);
  const emaPerc40: number = ema(
    blocksRewardsPerc40,
    blocksRewardsPerc40.length
  ).at(-1);
  const emaPerc50: number = ema(
    blocksRewardsPerc50,
    blocksRewardsPerc50.length
  ).at(-1);

  return {
    confirmationTimeByPriorityFee: {
      15: emaPerc50,
      30: emaPerc40,
      45: emaPerc30,
      60: emaPerc25,
      75: emaPerc10,
    },
    maxPriorityFeeSuggestions: {
      fast: emaPerc30,
      normal: emaPerc20,
      urgent: emaPerc40,
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
