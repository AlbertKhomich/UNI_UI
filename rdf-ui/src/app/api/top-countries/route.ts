import { NextResponse } from "next/server";
import { getCountries } from "@/lib/topCountries";

function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error) return error;
    return fallback;
}

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
                { error: errorMessage(error, "Failed to fetch top countries") },
                { status: 500 }
            );
        }
    }
