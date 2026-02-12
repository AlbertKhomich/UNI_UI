import { NextResponse } from "next/server";
import { getCountries } from "@/lib/topCountries";

export async function GET(req: Request) {
    const month = 60 * 60 * 24 * 30;

        try {
            const rows = await getCountries();
            return NextResponse.json({ rows }, {
                headers: {
                    "Cache-Control": `public, max-age=${month}`,
                },
            });
        } catch (e: any) {
            return NextResponse.json(
                { error: e?.message || "Failed to fetch top countries" },
                { status: 500 }
            );
        }
    }