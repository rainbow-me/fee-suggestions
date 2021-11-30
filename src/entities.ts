export type Reward = string[];
export type GasUsedRatio = number[];

/**
 * Response interface from `eth_feeHistory` RPC call
 *
 * @member baseFeePerGas - Array containing base fee per gas of the last BLOCKCOUNT blocks
 * @member gasUsedRatio - Array containing gas used ratio of the last BLOCKCOUNT blocks
 * @member gasUsedRatio - Lowest number block of the returned range
 * @member reward - Array of effective priority fee per gas data points from a single block
 */
export interface FeeHistoryResponse {
  baseFeePerGas: string[];
  gasUsedRatio: GasUsedRatio;
  oldestBlock: number;
  reward: Reward[];
}

/**
 * Max base fee related suggestions
 *
 * @member baseFeeTrend - Estimated trend
 * @member currentBaseFee - Current block base fee in wei string
 * @member maxBaseFeeSuggestion - Base fee suggestion in wei string
 */
export interface MaxFeeSuggestions {
  baseFeeTrend: number;
  currentBaseFee: string;
  maxBaseFeeSuggestion: string;
}

/**
 * Max fee priority fee related suggestions
 *
 * @member maxPriorityFeeSuggestions - Object containing max priority fee in wei string per speeds, `urgent`, `fast` and `normal`
 * @member confirmationTimeByPriorityFee - Object containing estimated seconds that a confirmation is going to happen if `confirmationTimeByPriorityFee[secs]` is used as `maxPriorityfee`, in wei string
 */
export interface MaxPriorityFeeSuggestions {
  confirmationTimeByPriorityFee: {
    15: string;
    30: string;
    45: string;
    60: string;
  };
  maxPriorityFeeSuggestions: { urgent: string; fast: string; normal: string };
}

export interface Suggestions
  extends MaxFeeSuggestions,
    MaxPriorityFeeSuggestions {}
