import { JsonRpcProvider } from "@ethersproject/providers";
import { ema } from 'moving-averages';

const toGwei = (wei:number) => {
  return wei * Math.pow(10, -9)
}

type Reward = string[];
type GasUsedRatio = number[];

interface FeeHistoryResponse {
    baseFeePerGas: string[],
    gasUsedRatio: GasUsedRatio,
    oldestBlock: number,
    reward: Reward[],
}

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

const  linearRegression = (y: number[],x: number[]) => {
  let lr = {};
  let n = y.length;
  let sum_x = 0;
  let sum_y = 0;
  let sum_xy = 0;
  let sum_xx = 0;
  let sum_yy = 0;

  for (let i = 0; i < y.length; i++) {
      const cY = Number(y[i])
      const cX = Number(x[i])
      sum_x += cX;
      sum_y += cY;
      sum_xy += (cX*cY);
      sum_xx += (cX*cX);
      sum_yy += (cY*cY);
  } 
  const slope = (n * sum_xy - sum_x * sum_y) / (n*sum_xx - sum_x * sum_x);

  return slope;
}

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

export const suggestMaxBaseFee = async (
  provider: JsonRpcProvider,
  fromBlock = 'latest',
  blockCountHistory = 100,
  sampleMin = 0.1,
  sampleMax = 0.3,
  maxTimeFactor = 15,
) => {
  // feeHistory API call without a reward percentile specified is cheap even with a light client backend because it only needs block headers.
  // Therefore we can afford to fetch a hundred blocks of base fee history in order to make meaningful estimates on variable time scales.
  const feeHistory: FeeHistoryResponse = await provider.send("eth_feeHistory", [blockCountHistory, fromBlock, []]);
  const baseFee: number[] = [];
  const order = [];
  for (let i = 0; i < feeHistory.baseFeePerGas.length; i++) {
    baseFee.push(Number(feeHistory.baseFeePerGas[i]));
    order.push(i);
  }

  const blocksArray = Array.from(Array(blockCountHistory+1).keys())
  const gweiBaseFees = baseFee.map(wei => toGwei(wei))
  const trend = linearRegression(gweiBaseFees, blocksArray)

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

  const result = [];
  let maxBaseFee = 0;
  for (let timeFactor = maxTimeFactor; timeFactor >= 0; timeFactor--) {
    let bf = suggestBaseFee(baseFee, order, timeFactor, sampleMin, sampleMax);
    if (bf > maxBaseFee) {
      maxBaseFee = bf;
    } else {
      bf = maxBaseFee;
    }
    result[timeFactor] = {
      maxFeePerGas: Math.round(bf),
    };
  }
  
  return { baseFeeSuggestions: result, baseFeeTrend: trend };
};

const blockTimeSecs = 15

export const suggestMaxPriorityFee = async (
  provider: JsonRpcProvider,
  fromBlock = 'latest',
) => {
  const feeHistory: FeeHistoryResponse = await provider.send("eth_feeHistory", [10, fromBlock, [10, 20, 25, 30, 40, 50]]);
  const blocksRewards = feeHistory.reward
  const blocksRewardsPerc10 = blocksRewards.map(reward => reward[0])
  const blocksRewardsPerc20 = blocksRewards.map(reward => reward[1])
  const blocksRewardsPerc25 = blocksRewards.map(reward => reward[2])
  const blocksRewardsPerc30 = blocksRewards.map(reward => reward[3])
  const blocksRewardsPerc40 = blocksRewards.map(reward => reward[4])
  const blocksRewardsPerc50 = blocksRewards.map(reward => reward[5])

  const emaPerc10: number = ema(blocksRewardsPerc10, blocksRewardsPerc10.length)
  const emaPerc20: number = ema(blocksRewardsPerc20, blocksRewardsPerc20.length)
  const emaPerc25: number = ema(blocksRewardsPerc25, blocksRewardsPerc25.length)
  const emaPerc30: number = ema(blocksRewardsPerc30, blocksRewardsPerc30.length)
  const emaPerc40: number = ema(blocksRewardsPerc40, blocksRewardsPerc40.length)
  const emaPerc50: number = ema(blocksRewardsPerc50, blocksRewardsPerc50.length)

  return { 
    maxPriorityFeeSuggestions: { urgent: emaPerc40, fast: emaPerc25, normal: emaPerc20 },
    confirmationTimeByPriorityFee: {
      [emaPerc50]: blockTimeSecs,
      [emaPerc40]: blockTimeSecs * 2,
      [emaPerc30]: blockTimeSecs * 3,
      [emaPerc25]: blockTimeSecs * 4,
      [emaPerc10]: blockTimeSecs * 5,
      }
  }
}

export const suggestFees = async (provider: JsonRpcProvider) => {
  const {baseFeeSuggestions, baseFeeTrend } = await suggestMaxBaseFee(provider)
  const { maxPriorityFeeSuggestions, confirmationTimeByPriorityFee } = await suggestMaxPriorityFee(provider)
  return { maxPriorityFeeSuggestions, baseFeeSuggestions, baseFeeTrend, confirmationTimeByPriorityFee }
}