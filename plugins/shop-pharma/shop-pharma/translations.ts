/**
 * Minimal pharmacy storefront locale strings (8 locales, mirroring the other
 * fe-user plugins). The product page mostly renders backend-provided region
 * copy; these cover the storefront chrome.
 */
export interface PharmacyMessages {
  pharmacy: {
    title: string;
    prescriptionRequired: string;
    addToCart: string;
  };
  [key: string]: unknown;
}

export const en: PharmacyMessages = {
  pharmacy: { title: 'Pharmacy', prescriptionRequired: 'Prescription required', addToCart: 'Add to cart' },
};
export const de: PharmacyMessages = {
  pharmacy: { title: 'Apotheke', prescriptionRequired: 'Rezept erforderlich', addToCart: 'In den Warenkorb' },
};
export const es: PharmacyMessages = {
  pharmacy: { title: 'Farmacia', prescriptionRequired: 'Receta requerida', addToCart: 'Añadir al carrito' },
};
export const fr: PharmacyMessages = {
  pharmacy: { title: 'Pharmacie', prescriptionRequired: 'Ordonnance requise', addToCart: 'Ajouter au panier' },
};
export const it: PharmacyMessages = {
  pharmacy: { title: 'Farmacia', prescriptionRequired: 'Ricetta richiesta', addToCart: 'Aggiungi al carrello' },
};
export const nl: PharmacyMessages = {
  pharmacy: { title: 'Apotheek', prescriptionRequired: 'Recept vereist', addToCart: 'In winkelwagen' },
};
export const pl: PharmacyMessages = {
  pharmacy: { title: 'Apteka', prescriptionRequired: 'Wymagana recepta', addToCart: 'Dodaj do koszyka' },
};
export const ru: PharmacyMessages = {
  pharmacy: { title: 'Аптека', prescriptionRequired: 'Требуется рецепт', addToCart: 'В корзину' },
};

export const pharmacyTranslations: Record<string, Record<string, unknown>> = {
  en,
  de,
  es,
  fr,
  it,
  nl,
  pl,
  ru,
};
