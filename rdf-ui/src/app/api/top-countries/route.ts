import { NextResponse } from "next/server";
import { toErrorMessage } from "@/lib/errors";
import { getCountries } from "@/lib/topCountries";

export async function GET() {
    const month = 60 * 60 * 24 * 30;

        try {
            const rows = await getCountries();
            return NextResponse.json({ rows }, {
                headers: {
                    "Cache-Control": `public, max-age=${month}`,
                },
            });
        } catch (error: unknown) {
            return NextResponse.json(
                { error: toErrorMessage(error, "Failed to fetch top countries") },
                { status: 500 }
            );
        }
    }
