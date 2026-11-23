import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { InvoiceDetail } from "@/lib/invoices/queries";
import type { Dictionary } from "@/lib/i18n/types";
import type { InvoiceLanguage } from "@/lib/clients/config";
import { countryName } from "@/lib/clients/countries";
import { formatIban } from "@/lib/profile";

// Noto Sans, the full font: Latin (with ë, ç, č, š, ...), Cyrillic and Greek
// in one file per weight. react-pdf uses one file per family and weight, so
// registering the per-script subset files under one family drew every
// Cyrillic invoice with Latin glyphs (unreadable). Pinned to a release of
// Google's Noto fonts.
const NOTO_SANS =
  "https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io@NotoSans-v2.013/fonts/NotoSans/unhinted/ttf";
Font.register({
  family: "NotoSans",
  fonts: [
    { src: `${NOTO_SANS}/NotoSans-Regular.ttf`, fontWeight: 400 },
    { src: `${NOTO_SANS}/NotoSans-Bold.ttf`, fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSans",
    fontSize: 10,
    padding: 40,
    paddingBottom: 64,
    color: "#111",
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.2,
    marginBottom: 6,
  },
  draft: {
    fontSize: 10,
    fontWeight: 700,
    color: "#b45309",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#555",
  },
  metaBlock: {
    width: 240,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 8,
    color: "#777",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 10,
    textAlign: "right",
  },
  parties: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 24,
  },
  party: {
    flex: 1,
  },
  partyLabel: {
    fontSize: 8,
    color: "#777",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  partyName: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 4,
  },
  partyLine: {
    fontSize: 10,
    color: "#333",
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  colDesc: { flex: 3 },
  colQty: { width: 48, textAlign: "right" },
  colPrice: { width: 84, textAlign: "right" },
  colTotal: { width: 84, textAlign: "right" },
  headerText: {
    fontSize: 8,
    color: "#777",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  totals: {
    marginTop: 16,
    marginLeft: "auto",
    width: 240,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: {
    color: "#555",
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    fontSize: 12,
    fontWeight: 700,
  },
  vatStatus: {
    marginTop: 16,
    fontSize: 9,
    color: "#333",
  },
  bottomRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 24,
  },
  section: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 8,
    color: "#777",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notes: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 4,
  },
  signature: {
    width: 200,
  },
  signatureLine: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: "#999",
    paddingTop: 4,
    fontSize: 8,
    color: "#777",
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
});

export type InvoicePdfLabels = Dictionary["invoices"]["pdf"];

const NUMBER_LOCALES: Record<InvoiceLanguage, string> = {
  mk: "mk-MK",
  sq: "sq-MK",
  en: "en-GB",
};

// With the currency code, which is unambiguous on an invoice ("$" could be
// any dollar): "1.234,50 EUR" in mk, "EUR 1,234.50" in en.
function formatMoney(amount: number, currency: string, lang: InvoiceLanguage) {
  return new Intl.NumberFormat(NUMBER_LOCALES[lang], {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(amount);
}

// "YYYY-MM-DD" -> "20.11.2026" in mk and sq, "20 Nov 2026" in en.
function formatDate(date: string, lang: InvoiceLanguage) {
  const [year, month, day] = date.slice(0, 10).split("-");
  if (lang !== "en") return `${day}.${month}.${year}`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${year}-${month}-${day}T00:00:00Z`));
}

export function InvoicePdfDocument({
  data,
  labels,
  lang,
}: {
  data: InvoiceDetail;
  // In the client's invoice language, which `lang` is.
  labels: InvoicePdfLabels;
  lang: InvoiceLanguage;
}) {
  const { invoice, items, client, user } = data;
  const fromName = user.businessName || user.name;
  const ddvPct = Math.round(invoice.ddvRate * 100);
  const isDraft = invoice.number === null;
  const { bank } = user;
  const hasBank = bank.bankName || bank.iban || bank.bic || bank.accountNumber;
  // Number, date and place of issue, date of supply (VAT law Art. 53(10)
  // points 1 and 4), and the due date.
  const meta: [string, string][] = [
    [labels.number, invoice.number ?? "—"],
    [labels.invoiceDate, formatDate(invoice.date, lang)],
    [labels.supplyDate, formatDate(invoice.supplyDate, lang)],
    ...(user.placeOfIssue ? [[labels.placeOfIssue, user.placeOfIssue] as [string, string]] : []),
    ...(invoice.dueDate ? [[labels.dueDate, formatDate(invoice.dueDate, lang)] as [string, string]] : []),
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{labels.invoice}</Text>
            {isDraft && <Text style={styles.draft}>{labels.draft}</Text>}
            <Text style={styles.subtitle}>{fromName}</Text>
          </View>
          <View style={styles.metaBlock}>
            {meta.map(([label, value]) => (
              <View key={label} style={styles.metaRow}>
                <Text style={styles.metaLabel}>{label}</Text>
                <Text style={styles.metaValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>{labels.from}</Text>
            <Text style={styles.partyName}>{fromName}</Text>
            {user.name !== fromName && <Text style={styles.partyLine}>{user.name}</Text>}
            {user.address && <Text style={styles.partyLine}>{user.address}</Text>}
            {user.taxNumber && (
              <Text style={styles.partyLine}>
                {labels.taxNumber}: {user.taxNumber}
              </Text>
            )}
            {/* Only a VAT-registered issuer has (and must show) a VAT number
                (VAT law Art. 53(10) point 2). */}
            {user.vatRegistered && user.vatNumber && (
              <Text style={styles.partyLine}>
                {labels.vatNumber}: {user.vatNumber}
              </Text>
            )}
          </View>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>{labels.billTo}</Text>
            <Text style={styles.partyName}>{client.name}</Text>
            {client.contactPerson && <Text style={styles.partyLine}>{client.contactPerson}</Text>}
            {client.address && <Text style={styles.partyLine}>{client.address}</Text>}
            <Text style={styles.partyLine}>{countryName(client.country, lang)}</Text>
            {client.taxId && (
              <Text style={styles.partyLine}>
                {labels.clientTaxId}: {client.taxId}
              </Text>
            )}
            {client.email && <Text style={styles.partyLine}>{client.email}</Text>}
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.colDesc, styles.headerText]}>{labels.description}</Text>
          <Text style={[styles.colQty, styles.headerText]}>{labels.qty}</Text>
          <Text style={[styles.colPrice, styles.headerText]}>{labels.unitPrice}</Text>
          <Text style={[styles.colTotal, styles.headerText]}>{labels.total}</Text>
        </View>

        {items.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={styles.colDesc}>{item.description}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colPrice}>{formatMoney(item.unitPrice, invoice.currency, lang)}</Text>
            <Text style={styles.colTotal}>{formatMoney(item.total, invoice.currency, lang)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{labels.subtotal}</Text>
            <Text>{formatMoney(invoice.subtotal, invoice.currency, lang)}</Text>
          </View>
          {invoice.ddvRate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {labels.ddv} ({ddvPct}%)
              </Text>
              <Text>{formatMoney(invoice.ddvAmount, invoice.currency, lang)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text>{labels.grandTotal}</Text>
            <Text>{formatMoney(invoice.total, invoice.currency, lang)}</Text>
          </View>
          {/* The MKD equivalent is only for a VAT-registered issuer; for
              anyone else it's just the app's approximate rate. */}
          {user.vatRegistered && invoice.currency !== "MKD" && (
            <>
              <View style={[styles.totalRow, { marginTop: 8 }]}>
                <Text style={styles.totalLabel}>{labels.mkdEquivalent}</Text>
                <Text>{formatMoney(invoice.totalMKD, "MKD", lang)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { fontSize: 8 }]}>
                  {(invoice.rateSource === "nbrsm" && invoice.rateDate
                    ? labels.exchangeRateNbrsm.replace("{date}", formatDate(invoice.rateDate, lang))
                    : labels.exchangeRate
                  )
                    .replace("{currency}", invoice.currency)
                    .replace("{rate}", String(invoice.exchangeRateMKD))}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Only VAT-registered taxpayers may show VAT (VAT law Art. 51(3)),
            so an unregistered issuer's invoice says why there's none. */}
        {!user.vatRegistered && <Text style={styles.vatStatus}>{labels.notVatRegistered}</Text>}

        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.sectionLabel}>{labels.notes}</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        <View style={styles.bottomRow} wrap={false}>
          <View style={styles.section}>
            {hasBank && (
              <>
                <Text style={styles.sectionLabel}>{labels.payment}</Text>
                {bank.bankName && (
                  <Text style={styles.partyLine}>
                    {labels.bank}: {bank.bankName}
                  </Text>
                )}
                {bank.iban && (
                  <Text style={styles.partyLine}>
                    {labels.iban}: {formatIban(bank.iban)}
                  </Text>
                )}
                {bank.bic && (
                  <Text style={styles.partyLine}>
                    {labels.bic}: {bank.bic}
                  </Text>
                )}
                {bank.accountNumber && (
                  <Text style={styles.partyLine}>
                    {labels.accountNumber}: {bank.accountNumber}
                  </Text>
                )}
              </>
            )}
          </View>
          {/* Name, surname and signature of the person authorised to sign
              (VAT law Art. 53(10) point 10). */}
          <View style={styles.signature}>
            <Text style={styles.sectionLabel}>{labels.signatory}</Text>
            <Text>{user.signatory}</Text>
            <Text style={styles.signatureLine}>{labels.signature}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {labels.footer}
        </Text>
      </Page>
    </Document>
  );
}
