
export type Reward = string[];
export type GasUsedRatio = number[];

export interface FeeHistoryResponse {
    baseFeePerGas: string[],
    gasUsedRatio: GasUsedRatio,
    oldestBlock: number,
    reward: Reward[],
}

export interface MaxFeeSuggestions {
    baseFeeSuggestion: number,
    baseFeeTrend: number
}

export interface MaxPriorityFeeSuggestions {
    maxPriorityFeeSuggestions: {urgent: number, fast: number, normal: number},
    confirmationTimeByPriorityFee: { 15: number, 30: number, 45: number, 60: number, 75: number }
}

export interface Suggestions extends MaxFeeSuggestions, MaxPriorityFeeSuggestions {}
