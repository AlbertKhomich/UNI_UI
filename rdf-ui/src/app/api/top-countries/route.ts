import { NextResponse } from "next/server";
import { getCountries } from "@/lib/topCountries";

export async function GET(req: Request) {
        try {
            const rows = await getCountries();
            return NextResponse.json({ rows });
        } catch (e: any) {
            return NextResponse.json(
                { error: e?.message || "Failed to fetch top countries" },
                { status: 500 }
            );
        }
    }