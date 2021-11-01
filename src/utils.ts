import BigNumber from 'bignumber.js';
import { Reward } from './entities';

type BigNumberish = number | string | BigNumber;

const ethUnits = {
  gwei: 1000000000,
};

export const multiply = (
  numberOne: BigNumberish,
  numberTwo: BigNumberish
): BigNumber => new BigNumber(numberOne).times(numberTwo);

export const divide = (
  numberOne: BigNumberish,
  numberTwo: BigNumberish
): BigNumber => {
  if (!(numberOne || numberTwo)) return new BigNumber(0);
  return new BigNumber(numberOne).dividedBy(numberTwo);
};

export const gweiToWei = (gweiAmount: BigNumberish) => {
  const weiAmount = multiply(gweiAmount, ethUnits.gwei).toFixed(0);
  return weiAmount;
};

export const weiToGwei = (weiAmount: BigNumberish) => {
  const gweiAmount = divide(weiAmount, ethUnits.gwei).toFixed();
  return gweiAmount;
};

export const weiToGweiNumber = (weiAmount: BigNumberish) => {
  const gweiAmount = divide(weiAmount, ethUnits.gwei).toNumber();
  return gweiAmount;
};

export const weiToString = (weiAmount: BigNumberish) => {
  return new BigNumber(weiAmount).toString();
};

export const samplingCurve = (
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

export const linearRegression = (y: number[], x: number[]) => {
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

export const suggestBaseFee = (
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

export const getOutlierBlocksToRemove = (
  blocksRewards: Reward[],
  index: number
) => {
  const blocks: number[] = [];
  blocksRewards
    .map((reward) => weiToGweiNumber(reward[index]))
    .forEach((gweiReward, i) => {
      if (gweiReward > 5) {
        blocks.push(i);
      }
    });
  return blocks;
};

export const rewardsFilterOutliers = (
  blocksRewards: Reward[],
  outlierBlocks: number[],
  rewardIndex: number
) =>
  blocksRewards
    .filter((_, index) => !outlierBlocks.includes(index))
    .map((reward) => weiToGweiNumber(reward[rewardIndex]));
