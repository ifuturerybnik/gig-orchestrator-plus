export function formatDateTimePL(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
}
