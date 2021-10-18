"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.suggestFees = void 0;
var ethers_1 = require("ethers");
/*
suggestFees returns a series of maxFeePerGas / maxPriorityFeePerGas values suggested for different time preferences.
The first element corresponds to the highest time preference (most urgent transaction).
The basic idea behind the algorithm is similar to the old "gas price oracle" used in Geth;
it takes the prices of recent blocks and makes a suggestion based on a low percentile of those prices.
With EIP-1559 though the base fee of each block provides a less noisy and more reliable price signal.
This allows for more sophisticated suggestions with a variable width (exponentially weighted) base fee time window.
The window width corresponds to the time preference of the user. The underlying assumption is that price fluctuations over a given past time period indicate the probabilty of similar price levels being re-tested by the market over a similar length future time period.
*/
var suggestFees = function (provider, blockCountHistory, sampleMin, sampleMax, maxTimeFactor, extraTipRatio, fallbackTip) {
    if (blockCountHistory === void 0) { blockCountHistory = 100; }
    if (sampleMin === void 0) { sampleMin = 0.1; }
    if (sampleMax === void 0) { sampleMax = 0.3; }
    if (maxTimeFactor === void 0) { maxTimeFactor = 15; }
    if (extraTipRatio === void 0) { extraTipRatio = 0.25; }
    if (fallbackTip === void 0) { fallbackTip = 2e9; }
    return __awaiter(void 0, void 0, void 0, function () {
        var feeHistory, baseFee, order, i, i, tip, result, maxBaseFee, timeFactor, bf, t;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, provider.send("eth_feeHistory", [blockCountHistory, "latest", []])];
                case 1:
                    feeHistory = _a.sent();
                    baseFee = [];
                    order = [];
                    for (i = 0; i < feeHistory.baseFeePerGas.length; i++) {
                        baseFee.push(Number(feeHistory.baseFeePerGas[i]));
                        order.push(i);
                    }
                    // If a block is full then the baseFee of the next block is copied. The reason is that in full blocks the minimal tip might not be enough to get included.
                    // The last (pending) block is also assumed to end up being full in order to give some upwards bias for urgent suggestions.
                    baseFee[baseFee.length - 1] *= 9 / 8;
                    for (i = feeHistory.gasUsedRatio.length - 1; i >= 0; i--) {
                        if (feeHistory.gasUsedRatio[i] > 0.9) {
                            baseFee[i] = baseFee[i + 1];
                        }
                    }
                    order.sort(function (a, b) {
                        var aa = baseFee[a];
                        var bb = baseFee[b];
                        if (aa < bb) {
                            return -1;
                        }
                        if (aa > bb) {
                            return 1;
                        }
                        return 0;
                    });
                    return [4 /*yield*/, suggestTip(feeHistory.oldestBlock, feeHistory.gasUsedRatio, fallbackTip, provider)];
                case 2:
                    tip = _a.sent();
                    result = [];
                    maxBaseFee = 0;
                    for (timeFactor = maxTimeFactor; timeFactor >= 0; timeFactor--) {
                        bf = suggestBaseFee(baseFee, order, timeFactor, sampleMin, sampleMax);
                        t = tip;
                        if (bf > maxBaseFee) {
                            maxBaseFee = bf;
                        }
                        else {
                            // If a narrower time window yields a lower base fee suggestion than a wider window then we are probably in a price dip.
                            // In this case getting included with a low tip is not guaranteed; instead we use the higher base fee suggestion
                            // and also offer extra tip to increase the chance of getting included in the base fee dip.
                            t += (maxBaseFee - bf) * extraTipRatio;
                            bf = maxBaseFee;
                        }
                        result[timeFactor] = {
                            maxFeePerGas: Math.round(bf + t),
                            maxPriorityFeePerGas: Math.round(t)
                        };
                    }
                    return [2 /*return*/, result];
            }
        });
    });
};
exports.suggestFees = suggestFees;
// suggestTip suggests a tip (maxPriorityFeePerGas) value that's usually sufficient for blocks that are not full.
var suggestTip = function (firstBlock, gasUsedRatio, fallbackTip, provider) { return __awaiter(void 0, void 0, void 0, function () {
    var ptr, needBlocks, rewards, blockCount, feeHistory, i;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ptr = gasUsedRatio.length - 1;
                needBlocks = 5;
                rewards = [];
                _a.label = 1;
            case 1:
                if (!(needBlocks > 0 && ptr >= 0)) return [3 /*break*/, 4];
                blockCount = maxBlockCount(gasUsedRatio, ptr, needBlocks);
                if (!(blockCount > 0)) return [3 /*break*/, 3];
                return [4 /*yield*/, provider.send("eth_feeHistory", [
                        blockCount,
                        ethers_1.BigNumber.from(firstBlock).add(ptr).toHexString(),
                        [10],
                    ])];
            case 2:
                feeHistory = _a.sent();
                for (i = 0; i < feeHistory.reward.length; i++) {
                    rewards.push(Number(feeHistory.reward[i][0]));
                }
                if (feeHistory.reward.length < blockCount) {
                    return [3 /*break*/, 4];
                }
                needBlocks -= blockCount;
                _a.label = 3;
            case 3:
                ptr -= blockCount + 1;
                return [3 /*break*/, 1];
            case 4:
                if (rewards.length == 0) {
                    return [2 /*return*/, fallbackTip];
                }
                rewards.sort();
                return [2 /*return*/, rewards[Math.floor(rewards.length / 2)]];
        }
    });
}); };
// maxBlockCount returns the number of consecutive blocks suitable for tip suggestion (gasUsedRatio between 0.1 and 0.9).
var maxBlockCount = function (gasUsedRatio, ptr, needBlocks) {
    var blockCount = 0;
    while (needBlocks > 0 && ptr >= 0) {
        if (gasUsedRatio[ptr] < 0.1 || gasUsedRatio[ptr] > 0.9) {
            break;
        }
        ptr--;
        needBlocks--;
        blockCount++;
    }
    return blockCount;
};
// suggestBaseFee calculates an average of base fees in the sampleMin to sampleMax percentile range of recent base fee history, each block weighted with an exponential time function based on timeFactor.
var suggestBaseFee = function (baseFee, order, timeFactor, sampleMin, sampleMax) {
    if (timeFactor < 1e-6) {
        return baseFee[baseFee.length - 1];
    }
    var pendingWeight = (1 - Math.exp(-1 / timeFactor)) /
        (1 - Math.exp(-baseFee.length / timeFactor));
    var sumWeight = 0;
    var result = 0;
    var samplingCurveLast = 0;
    for (var i = 0; i < order.length; i++) {
        sumWeight +=
            pendingWeight * Math.exp((order[i] - baseFee.length + 1) / timeFactor);
        var samplingCurveValue = samplingCurve(sumWeight, sampleMin, sampleMax);
        result += (samplingCurveValue - samplingCurveLast) * baseFee[order[i]];
        if (samplingCurveValue >= 1) {
            return result;
        }
        samplingCurveLast = samplingCurveValue;
    }
    return result;
};
// samplingCurve is a helper function for the base fee percentile range calculation.
var samplingCurve = function (sumWeight, sampleMin, sampleMax) {
    if (sumWeight <= sampleMin) {
        return 0;
    }
    if (sumWeight >= sampleMax) {
        return 1;
    }
    return ((1 -
        Math.cos(((sumWeight - sampleMin) * 2 * Math.PI) / (sampleMax - sampleMin))) /
        2);
};
