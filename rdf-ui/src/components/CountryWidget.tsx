import React from "react"
import CountryPopularityMap from "@/components/CountryPopularityMap";
import { Row } from "@/lib/types";
type Theme = "dark" | "light";

function formatCompact(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    return `${n}`;
}

function darkenColorSlightly(input: string): string {
    const m = input.match(
        /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i
    );
    if (!m) return input;

    const r = Math.max(0, Math.min(255, Math.round(Number(m[1]) * 0.82)));
    const g = Math.max(0, Math.min(255, Math.round(Number(m[2]) * 0.82)));
    const b = Math.max(0, Math.min(255, Math.round(Number(m[3]) * 0.82)));
    const a = m[4] !== undefined ? Math.max(0, Math.min(1, Number(m[4]))) : 1;
    return `rgba(${r},${g},${b},${a})`;
}

export default function UsersByCountryWidget({
    rows,
    totalOverride,
    theme = "dark",
    onCountryClick,
}: {
    rows: Row[];
    totalOverride: number;
    theme?: Theme;
    onCountryClick?: (countryCode: string, label: string) => void;
}) {
    const [showAll, setShowAll] = React.useState(false);
    const [showMap, setShowMap] = React.useState(false);
    const isDark = theme === "dark";

    const denomDonut = rows.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
    
    const normalized = rows.map((r) => {
        const v = Number(r.value) || 0;

        return {
            ...r,
            value: v,
            pctDonut: denomDonut > 0 ? v / denomDonut : 0,
            pct: totalOverride > 0 ? v / totalOverride : 0,
        };
    });

    const fallbackBarColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(30,64,175,0.6)";
    const separatorColor = isDark ? "rgba(0,0,0,1)" : "rgba(255,255,255,1)";
    const sortedRows = React.useMemo(
        () => [...normalized].sort((a, b) => b.value - a.value),
        [normalized]
    );
    const visibleRows = showAll ? sortedRows : sortedRows.slice(0, 4);
    const fourthBarColor =
        sortedRows[3]?.color ??
        sortedRows[sortedRows.length - 1]?.color ??
        fallbackBarColor;
    const tailColor = darkenColorSlightly(fourthBarColor);

    const donutRows = React.useMemo(() => {
        const top = sortedRows.slice(0, 4).map((r) => {
            const isZeroPct = Number((r.pct * 100).toFixed(1)) === 0;
            return {
                pctDonut: r.pctDonut,
                color: isZeroPct
                    ? separatorColor
                    : r.color ?? fallbackBarColor,
            };
        });

        if (sortedRows.length <= 4) return top;

        const othersPctDonut = sortedRows
            .slice(4)
            .reduce((sum, r) => sum + r.pctDonut, 0);

        return [
            ...top,
            {
                pctDonut: othersPctDonut,
                color: tailColor,
            },
        ];
    }, [fallbackBarColor, separatorColor, sortedRows, tailColor]);

    let acc = 0;
    const sep = 0.8
    const stops = donutRows
        .map((r) => {
            const start = acc * 100;
            acc += r.pctDonut;
            const end = acc * 100;

            const fill = r.color;

            const endFill = end - sep;
            if (endFill <= start + 0.05) {
                return `${fill} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
            }

            return [
                `${fill} ${start.toFixed(2)}% ${endFill.toFixed(2)}%`,
                `${separatorColor} ${endFill.toFixed(2)}% ${end.toFixed(2)}%`
            ].join(", ")
        })
        .join(", ");

    const donutBg = 
        sortedRows.length === 0
            ? `conic-gradient(${fallbackBarColor} 0 100%)`
            : `conic-gradient(${stops})`;

    return (
        <div className={`mt-4 w-full rounded-xl border p-6 ${isDark ? "border-gray-600" : "border-gray-300"}`}>
            <div className="text-lg font-semibold">Papers by countries</div>
    
            {/* <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr] md:items-center"> */}
            <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr] md:items-start">
                <div className="flex items-start justify-center md:justify-self-start md:justify-start">
                {/* <div className="flex items-center justify-center md:justify-start"> */}
                    <div className="relative h-56 w-56">
                        <div 
                            className="absolute inset-0 rounded-full"
                            style={{ backgroundImage: donutBg }}
                        />
                        <div className={`absolute inset-[18px] rounded-full ${isDark ? "bg-black" : "bg-white"}`} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <div className={`text-4xl font-semibold tracking-tight ${isDark ? "text-white/85" : "text-slate-800"}`}>
                                {formatCompact(totalOverride)}
                            </div>
                            <div className={`mt-1 text-sm ${isDark ? "text-white/45" : "text-slate-500"}`}>Total</div>
                        </div>
                    </div>
                </div>
    
                <div className="space-y-5">
                    {visibleRows.map((r, idx) => {
                        const pct = r.pct * 100;
                        const isZeroPct = Number(pct.toFixed(1)) === 0;
                        const progressColor = isZeroPct
                            ? separatorColor
                            : idx >= 3
                                ? fourthBarColor
                                : r.color ?? fallbackBarColor;
                        const canClickCountry = Boolean(onCountryClick && r.code);
                        return (
                            <div key={r.code ? `${r.code}-${idx}` : `${r.name}-${idx}`} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {canClickCountry ? (
                                            <button
                                                type="button"
                                                className={`text-base font-medium hover:underline ${isDark ? "text-white/80" : "text-slate-700"}`}
                                                onClick={() => onCountryClick?.(String(r.code), r.name)}
                                            >
                                                {r.name}
                                            </button>
                                        ) : (
                                            <div className={`text-base font-medium ${isDark ? "text-white/80" : "text-slate-700"}`}>{r.name}</div>
                                        )}
                                    </div>
                                    <div className={`text-base font-medium ${isDark ? "text-white/55" : "text-slate-500"}`}>
                                        {formatCompact(r.value)} ({pct.toFixed(1)}%)
                                    </div>
                                </div>
            
                                <div className={`h-2 w-full rounded-full ${isDark ? "bg-white/10" : "bg-slate-200"}`}>
                                    <div
                                        className="h-2 rounded-full"
                                        style={{
                                            width: `${pct}%`,
                                            backgroundColor: progressColor,
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                    <div className="flex flex-wrap gap-3">
                        {sortedRows.length > 4 ? (
                            <button
                                type="button"
                                className={`rounded-xl border bg-transparent px-3 py-3 text-base transition-colors ${
                                    isDark
                                        ? "border-gray-500 hover:bg-gray-800"
                                        : "border-gray-300 hover:bg-gray-100"
                                }`}
                                onClick={() => setShowAll((v) => !v)}
                            >
                                {showAll ? "Show less countries" : "Show all countries"}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className={`rounded-xl border bg-transparent px-3 py-3 text-base transition-colors ${
                                isDark
                                    ? "border-gray-500 hover:bg-gray-800"
                                    : "border-gray-300 hover:bg-gray-100"
                            }`}
                            onClick={() => setShowMap((v) => !v)}
                        >
                            {showMap ? "Hide country map" : "Show country map"}
                        </button>
                    </div>
                </div>
            </div>
            {showMap ? (
                <div className={`mt-6 border-t pt-6 ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                    <CountryPopularityMap
                        rows={sortedRows}
                        theme={theme}
                        onCountryClick={onCountryClick}
                    />
                </div>
            ) : null}
        </div>
    )
}
