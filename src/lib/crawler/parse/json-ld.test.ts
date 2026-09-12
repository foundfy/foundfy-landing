import { describe, expect, it } from "vitest";
import {
  MAX_JSON_LD_OFFERS,
  MAX_JSON_LD_PROPERTY_RECORDS,
  extractJsonLdProperties,
  extractJsonLdTypes,
} from "./json-ld";

describe("bounded JSON-LD properties", () => {
  it("allowlists useful public properties and keeps types compatible", () => {
    const html = `<html><body>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Product",
              "name": "Silk scarf",
              "description": "Hand-dyed scarf",
              "brand": { "@type": "Brand", "name": "Taller" },
              "category": "Textiles",
              "offers": {
                "@type": "Offer",
                "price": "24",
                "priceCurrency": "EUR",
                "availability": "https://schema.org/InStock",
                "shippingDetails": { "huge": "omit" }
              },
              "sku": "omit-this",
              "image": ["https://example.com/1.jpg"]
            },
            {
              "@type": "WebSite",
              "name": "Taller",
              "description": "Workshops in Catalan"
            },
            {
              "@type": "LocalBusiness",
              "name": "Taller",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "Carrer Major 1",
                "addressLocality": "Barcelona",
                "addressCountry": "ES"
              }
            }
          ]
        }
      </script>
    </body></html>`;

    expect(extractJsonLdTypes(html)).toEqual(["Product", "WebSite", "LocalBusiness"]);
    expect(extractJsonLdProperties(html)).toEqual([
      {
        type: "Product",
        name: "Silk scarf",
        description: "Hand-dyed scarf",
        brand: "Taller",
        category: "Textiles",
        offers: [
          {
            price: "24",
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
          },
        ],
      },
      {
        type: "WebSite",
        name: "Taller",
        description: "Workshops in Catalan",
      },
      {
        type: "LocalBusiness",
        name: "Taller",
        address: {
          streetAddress: "Carrer Major 1",
          addressLocality: "Barcelona",
          addressCountry: "ES",
        },
      },
    ]);
  });

  it("does not persist wholesale catalogs or type-only nodes", () => {
    const offers = Array.from({ length: 20 }, (_, index) => ({
      "@type": "Offer",
      price: String(index),
      priceCurrency: "EUR",
    }));
    const graph = [
      { "@type": "ItemList", itemListElement: offers },
      ...offers.map((offer, index) => ({
        "@type": "Product",
        name: `Product ${index}`,
        offers: offer,
      })),
    ];
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@graph": graph,
    })}</script>`;

    const properties = extractJsonLdProperties(html);

    expect(properties.length).toBeLessThanOrEqual(MAX_JSON_LD_PROPERTY_RECORDS);
    expect(properties.every((item) => (item.offers?.length ?? 0) <= MAX_JSON_LD_OFFERS)).toBe(
      true,
    );
    expect(properties.some((item) => item.type === "ItemList")).toBe(false);
    expect(JSON.stringify(properties)).not.toContain("itemListElement");
  });
});
