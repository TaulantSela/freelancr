import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { InvoiceDetail } from "@/lib/invoices/queries";

Font.register({
  family: "NotoSans",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@latest/latin-400-normal.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@latest/latin-700-normal.ttf",
      fontWeight: 700,
    },
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@latest/cyrillic-400-normal.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@latest/cyrillic-700-normal.ttf",
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSans",
    fontSize: 10,
    padding: 40,
    color: "#111",
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#555",
  },
  metaBlock: {
    textAlign: "right",
  },
  metaLabel: {
    fontSize: 8,
    color: "#777",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 11,
    marginBottom: 6,
  },
  parties: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 28,
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
  colPrice: { width: 72, textAlign: "right" },
  colTotal: { width: 72, textAlign: "right" },
  headerText: {
    fontSize: 8,
    color: "#777",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  totals: {
    marginTop: 16,
    marginLeft: "auto",
    width: 220,
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
  notes: {
    marginTop: 28,
    padding: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 8,
    color: "#777",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
});

export type InvoicePdfLabels = {
  invoice: string;
  from: string;
  billTo: string;
  invoiceDate: string;
  dueDate: string;
  description: string;
  qty: string;
  unitPrice: string;
  total: string;
  subtotal: string;
  ddv: string;
  grandTotal: string;
  mkdEquivalent: string;
  exchangeRate: string;
  notes: string;
  footer: string;
  draft: string;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function InvoicePdfDocument({
  data,
  labels,
}: {
  data: InvoiceDetail;
  labels: InvoicePdfLabels;
}) {
  const { invoice, items, client, user } = data;
  const fromName = user.businessName || user.name;
  const ddvPct = Math.round(invoice.ddvRate * 100);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{labels.invoice}</Text>
            <Text style={styles.subtitle}>{fromName}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>{labels.invoice}</Text>
            <Text style={styles.metaValue}>{invoice.number ?? labels.draft}</Text>
            <Text style={styles.metaLabel}>{labels.invoiceDate}</Text>
            <Text style={styles.metaValue}>{formatDate(invoice.date)}</Text>
            {invoice.dueDate && (
              <>
                <Text style={styles.metaLabel}>{labels.dueDate}</Text>
                <Text style={styles.metaValue}>{formatDate(invoice.dueDate)}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>{labels.from}</Text>
            <Text style={styles.partyName}>{fromName}</Text>
            {user.name !== fromName && (
              <Text style={styles.partyLine}>{user.name}</Text>
            )}
            {user.taxNumber && (
              <Text style={styles.partyLine}>{user.taxNumber}</Text>
            )}
            {user.address && <Text style={styles.partyLine}>{user.address}</Text>}
            {user.bankAccount && (
              <Text style={styles.partyLine}>
                {user.bankName ? `${user.bankName}: ` : ""}
                {user.bankAccount}
              </Text>
            )}
          </View>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>{labels.billTo}</Text>
            <Text style={styles.partyName}>{client.name}</Text>
            {client.contactPerson && (
              <Text style={styles.partyLine}>{client.contactPerson}</Text>
            )}
            {client.taxId && <Text style={styles.partyLine}>{client.taxId}</Text>}
            {client.address && <Text style={styles.partyLine}>{client.address}</Text>}
            {client.email && <Text style={styles.partyLine}>{client.email}</Text>}
            <Text style={styles.partyLine}>{client.country}</Text>
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
            <Text style={styles.colPrice}>
              {formatMoney(item.unitPrice, invoice.currency)}
            </Text>
            <Text style={styles.colTotal}>
              {formatMoney(item.total, invoice.currency)}
            </Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{labels.subtotal}</Text>
            <Text>{formatMoney(invoice.subtotal, invoice.currency)}</Text>
          </View>
          {invoice.ddvRate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {labels.ddv} ({ddvPct}%)
              </Text>
              <Text>{formatMoney(invoice.ddvAmount, invoice.currency)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text>{labels.grandTotal}</Text>
            <Text>{formatMoney(invoice.total, invoice.currency)}</Text>
          </View>
          {invoice.currency !== "MKD" && (
            <>
              <View style={[styles.totalRow, { marginTop: 8 }]}>
                <Text style={styles.totalLabel}>{labels.mkdEquivalent}</Text>
                <Text>
                  {new Intl.NumberFormat("mk-MK", {
                    style: "currency",
                    currency: "MKD",
                    minimumFractionDigits: 0,
                  }).format(invoice.totalMKD)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { fontSize: 8 }]}>
                  {labels.exchangeRate.replace("{currency}", invoice.currency).replace("{rate}", String(invoice.exchangeRateMKD))}
                </Text>
              </View>
            </>
          )}
        </View>

        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>{labels.notes}</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        <Text style={styles.footer}>{labels.footer}</Text>
      </Page>
    </Document>
  );
}
