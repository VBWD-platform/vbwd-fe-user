/** Human-readable label for each pharma product class (single source). */
const CLASS_LABELS: Record<string, string> = {
  RX: 'Prescription',
  OTC: 'OTC',
  MEDICAL_DEVICE: 'Medical device',
  FMCG_PERSONAL: 'Personal care',
  FMCG_HOSPITAL: 'Clinical',
};

export function classLabel(productClass: string | null | undefined): string {
  if (!productClass) {
    return '';
  }
  return CLASS_LABELS[productClass] ?? productClass;
}
