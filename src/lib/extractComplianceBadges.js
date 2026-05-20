/**
 * Extracts compliance standard chips from a product's specTable1 rows.
 * Scans for known standards: UL, CSA, MIL, AMS, FDA, RoHS, ISO, ASTM, USP, NEMA.
 */
export function extractComplianceBadges(product) {
  // I1 fix: scan both specTable1 rows AND specificationsSummary
  // so partData-merged products (which have summary but sparse specTable1) get chips too
  const tableText = (product.specTable1?.rows ?? [])
    .map((r) => r.value || "")
    .join(" ");
  const summaryText = product.specificationsSummary ?? "";
  const src = `${tableText} ${summaryText}`;
  const patterns = [
    {
      label: "UL Listed",
      regex: /U\/L|UL\s*(Subject|File|Recognized|Listed|224|VW-1)/i,
    },
    { label: "CSA", regex: /CSA/i },
    { label: "RoHS", regex: /RoHS/i },
    { label: "ISO 9001", regex: /ISO\s*9001/i },
    { label: "MIL-SPEC", regex: /MIL-I|MIL-R|M23053|Mil-I|MIL-DTL/i },
    { label: "AMS", regex: /AMS[\s-]\d/i },
    { label: "FDA", regex: /FDA|21\s*CFR/i },
    { label: "USP Class VI", regex: /USP\s*(Class|XXII)/i },
    { label: "ASTM", regex: /ASTM\s*D/i },
    { label: "NEMA", regex: /NEMA/i },
    { label: "UL VW-1", regex: /VW-1/i },
  ];
  // Deduplicate — if VW-1 already captured by "UL Listed", skip standalone
  const found = [];
  const seen = new Set();
  for (const { label, regex } of patterns) {
    if (regex.test(src) && !seen.has(label)) {
      // Skip "UL VW-1" if any other UL variant already added
      if (label === "UL VW-1" && [...seen].some((s) => s.startsWith("UL")))
        continue;
      found.push(label);
      seen.add(label);
    }
  }
  return found;
}
