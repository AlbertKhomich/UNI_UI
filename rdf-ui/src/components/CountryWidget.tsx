import React from "react"
import { Row } from "@/lib/types";

function formatCompact(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    return `${n}`;
}

export default function UsersByCountryWidget({
    rows,
    totalOverride,
}: {
    rows: Row[];
    totalOverride: number;
}) {

    const denomDonut = rows.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
    
    const normalized = rows.map((r) => {
        const v = Number(r.value) || 0;

        return {
            ...r,
            value: v,
            pctDonut: v / denomDonut,
            pct: r.value / totalOverride,
        };
    });

    const sortedRows = React.useMemo(
        () => [...normalized].sort((a, b) => b.value - a.value),
        [normalized]
    );

    let acc = 0;
    const sep = 0.8
    const sepColor = "rgba(0,0,0,1)"
    const stops = sortedRows
        .map((r) => {
            const start = acc * 100;
            acc += r.pctDonut;
            const end = acc * 100;

            const fill = (r as any).color ?? `rgba(255,255,255,0.6)`;

            const endFill = end - sep;
            if (endFill <= start + 0.05) {
                return `${fill} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
            }

            return [
                `${fill} ${start.toFixed(2)}% ${endFill.toFixed(2)}%`,
                `${sepColor} ${endFill.toFixed(2)}% ${end.toFixed(2)}%`
            ].join(", ")
        })
        .join(", ");

    const donutBg = 
        sortedRows.length === 0
            ? `conic-gradient(rgba(255,255,255,1) 0 100%)`
            : `conic-gradient(${stops})`;

    return (
        <div className="w-full rounded-xl border border-gray-300 p-6 mt-4">
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
                        <div className="absolute inset-[18px] rounded-full bg-black" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <div className="text-4xl font-semibold tracking-tight text-white/85">
                                {formatCompact(totalOverride)}
                            </div>
                            <div className="mt-1 text-sm text-white/45">Total</div>
                        </div>
                    </div>
                </div>
    
                <div className="space-y-5">
                    {sortedRows.map((r) => {
                        const pct = r.pct * 100;
                        return (
                            <div key={r.name} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="text-base font-medium text-white/80">{r.name}</div>
                                    </div>
                                    <div className="text-base font-medium text-white/55">
                                    </div>
                                </div>
            
                                <div className="h-2 w-full rounded-full bg-white/10">
                                    <div
                                        className="h-2 rounded-full"
                                        style={{
                                            width: `${pct}%`,
                                            backgroundColor: (r as any).color ?? "rgba(255,255,255,0.6)",
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}