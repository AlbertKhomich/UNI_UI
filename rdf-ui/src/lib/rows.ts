import type { Row } from "./types";

export function packTailIntoOther(
    rows: Row[],
    opts?: {
        otherLabel?: string;
        otherColor?: string;
        minItemsKeep?: number;
    }
): Row[] {
    const otherLabel = opts?.otherLabel ?? "🌍 Other";
    const otherColor = opts?.otherColor ?? "rgba(255,255,255,0.35)";
    const minItemsKeep = opts?.minItemsKeep ?? 2;

    if (rows.length <= minItemsKeep) return rows;

    const sorted = [...rows].sort((a, b) => b.value - a.value);

    const tailSumAt = new Array(sorted.length + 1).fill(0);
    for (let i = sorted.length - 1; i >= 0; i--) {
        tailSumAt[i] = tailSumAt[i + 1] + sorted[i].value;
    }

    let cut = -1;
    for (let k = minItemsKeep; k < sorted.length; k++) {
        const tailSum = tailSumAt[k];
        const prevVal = sorted[k - 1].value;
        if (tailSum > 0 && tailSum < prevVal) {
            cut = k;
            break;
        }
    }

    if (cut === -1) return sorted;

    const head = sorted.slice(0, cut);
    const tailSum = tailSumAt[cut];
    return [...head, { name: otherLabel, value: tailSum, color: otherColor }];
}