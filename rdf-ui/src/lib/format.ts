export function toDisplayName(name: string): string {
    const parts = name.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
        const last = parts[0];
        const first = parts.slice(1).join(" ");
        return `${first} ${last}`.trim()
    }
    return name.trim()
}