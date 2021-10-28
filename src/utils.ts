import BigNumber from 'bignumber.js';

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
  const weiAmount = multiply(gweiAmount, ethUnits.gwei).toFixed();
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
