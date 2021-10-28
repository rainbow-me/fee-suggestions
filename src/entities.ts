export type Reward = string[];
export type GasUsedRatio = number[];

export interface FeeHistoryResponse {
  baseFeePerGas: string[];
  gasUsedRatio: GasUsedRatio;
  oldestBlock: number;
  reward: Reward[];
}

export interface MaxFeeSuggestions {
  baseFeeSuggestion: string;
  baseFeeTrend: number;
}

export interface MaxPriorityFeeSuggestions {
  maxPriorityFeeSuggestions: { urgent: string; fast: string; normal: string };
  confirmationTimeByPriorityFee: {
    15: string;
    30: string;
    45: string;
    60: string;
    75: string;
  };
}

export interface Suggestions
  extends MaxFeeSuggestions,
    MaxPriorityFeeSuggestions {}
