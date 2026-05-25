// Dane administratora danych (i-Future Sp. z o.o.) — operator aplikacji Concertivo.
// Używane w polityce prywatności, regulaminie, stopce i powiadomieniach RODO.
// Zmiana tych danych = aktualizacja `PRIVACY_VERSION` / `TERMS_VERSION` w legal.ts.

export const APP_OPERATOR = {
  legalName: "i-Future Sp. z o.o.",
  shortName: "i-Future",
  appName: "Concertivo",
  address: {
    street: "ul. Henryka Mikołaja Góreckiego 55",
    postalCode: "44-200",
    city: "Rybnik",
    country: "Polska",
  },
  nip: "642-312-90-46",
  regon: "241605742",
  krs: "0000357456",
  contactEmail: "info@concertivo.eu",
  rodoEmail: "info@concertivo.eu",
  dpo: null, // Brak Inspektora Ochrony Danych
} as const;

export function formatOperatorAddress(): string {
  const a = APP_OPERATOR.address;
  return `${a.street}, ${a.postalCode} ${a.city}, ${a.country}`;
}
