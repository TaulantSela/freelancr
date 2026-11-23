import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { CreditNoteDetail } from "@/lib/credit-notes/queries";
import type { Dictionary } from "@/lib/i18n/types";
import type { InvoiceLanguage } from "@/lib/clients/config";
import { countryName } from "@/lib/clients/countries";
import { formatDate, formatMoney, styles } from "./invoice-document";

// A credit note (книжно одобрение), in the client's invoice language: it's a
// document issued for the supply, so it carries what an invoice does (VAT
// law Art. 53(2), (10)): number, date and place of issue, the parties, the
// amount with its base and DDV for a VAT-registered issuer, and who signs.
// It names the invoice it corrects and why; the correction belongs to the
// period of its date (Art. 22(1)).
export function CreditNotePdfDocument({
  data,
  labels,
  invoiceLabels,
  lang,
}: {
  data: CreditNoteDetail;
  labels: Dictionary["creditNotes"]["pdf"];
  invoiceLabels: Dictionary["invoices"]["pdf"];
  lang: InvoiceLanguage;
}) {
  const { creditNote, invoice: detail } = data;
  const { invoice, client, user } = detail;
  const fromName = user.businessName || user.name;
  const ddvPct = Math.round(invoice.ddvRate * 100);
  const base = creditNote.amount - creditNote.ddvAmount;
  const meta: [string, string][] = [
    [labels.number, creditNote.number],
    [labels.date, formatDate(creditNote.date, lang)],
    ...(user.placeOfIssue ? [[invoiceLabels.placeOfIssue, user.placeOfIssue] as [string, string]] : []),
    [labels.invoice, invoice.number ?? "—"],
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{labels.title}</Text>
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
            <Text style={styles.partyLabel}>{invoiceLabels.from}</Text>
            <Text style={styles.partyName}>{fromName}</Text>
            {user.name !== fromName && <Text style={styles.partyLine}>{user.name}</Text>}
            {user.address && <Text style={styles.partyLine}>{user.address}</Text>}
            {user.taxNumber && (
              <Text style={styles.partyLine}>
                {invoiceLabels.taxNumber}: {user.taxNumber}
              </Text>
            )}
            {user.vatRegistered && user.vatNumber && (
              <Text style={styles.partyLine}>
                {invoiceLabels.vatNumber}: {user.vatNumber}
              </Text>
            )}
          </View>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>{labels.customer}</Text>
            <Text style={styles.partyName}>{client.name}</Text>
            {client.contactPerson && <Text style={styles.partyLine}>{client.contactPerson}</Text>}
            {client.address && <Text style={styles.partyLine}>{client.address}</Text>}
            <Text style={styles.partyLine}>{countryName(client.country, lang)}</Text>
            {client.taxId && (
              <Text style={styles.partyLine}>
                {invoiceLabels.clientTaxId}: {client.taxId}
              </Text>
            )}
          </View>
        </View>

        <Text style={{ marginBottom: 12 }}>
          {labels.forInvoice
            .replace("{number}", invoice.number ?? "—")
            .replace("{date}", formatDate(invoice.date, lang))}
        </Text>

        <View style={styles.notes}>
          <Text style={styles.sectionLabel}>{labels.reason}</Text>
          <Text>{creditNote.reason}</Text>
        </View>

        <View style={styles.totals}>
          {user.vatRegistered && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{labels.base}</Text>
                <Text>{formatMoney(base, invoice.currency, lang)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {invoiceLabels.ddv} ({ddvPct}%)
                </Text>
                <Text>{formatMoney(creditNote.ddvAmount, invoice.currency, lang)}</Text>
              </View>
            </>
          )}
          <View style={styles.grandTotal}>
            <Text>{labels.amount}</Text>
            <Text>{formatMoney(creditNote.amount, invoice.currency, lang)}</Text>
          </View>
          {user.vatRegistered && invoice.currency !== "MKD" && (
            <>
              <View style={[styles.totalRow, { marginTop: 8 }]}>
                <Text style={styles.totalLabel}>{invoiceLabels.mkdEquivalent}</Text>
                <Text>{formatMoney(creditNote.amount * creditNote.rateToMKD, "MKD", lang)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { fontSize: 8 }]}>
                  {labels.invoiceRate
                    .replace("{currency}", invoice.currency)
                    .replace("{rate}", String(creditNote.rateToMKD))}
                </Text>
              </View>
            </>
          )}
        </View>

        {!user.vatRegistered && <Text style={styles.vatStatus}>{invoiceLabels.notVatRegistered}</Text>}

        <View style={styles.bottomRow} wrap={false}>
          <View style={styles.section} />
          <View style={styles.signature}>
            <Text style={styles.sectionLabel}>{invoiceLabels.signatory}</Text>
            <Text>{user.signatory}</Text>
            <Text style={styles.signatureLine}>{invoiceLabels.signature}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {invoiceLabels.footer}
        </Text>
      </Page>
    </Document>
  );
}
