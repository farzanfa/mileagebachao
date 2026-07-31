// Client-side full-text search over the ~station universe (BUILD-CONTRACT §6, UX §4.5.2).
// The whole dataset is small enough to index on-device, so typeahead is instant and
// there is no external search / geocoding service. Wraps MiniSearch: `buildIndex`
// constructs an index at runtime; `scripts/build-search-index.ts` uses the same fields
// to emit a prebuilt JSON that MiniSearch.loadJSON can rehydrate with these options.

import MiniSearch from "minisearch";

import type { Station } from "@/lib/types";

/** Fields that are tokenised and searched (city, locality, pincode, station name). */
export const searchFields: string[] = ["name", "city", "state", "pincode", "address"];

/** Fields stored on each result so the UI can render a suggestion without a lookup. */
export const storeFields: string[] = [
  "id",
  "slug",
  "name",
  "brand",
  "city",
  "citySlug",
  "state",
  "pincode",
  "lat",
  "lng",
];

/**
 * Build an in-memory MiniSearch index over the given stations. Prefix + light fuzzy
 * matching with AND combination gives forgiving typeahead ("chand" -> Chandigarh);
 * name and city are boosted so the most likely target ranks first.
 */
export function buildIndex(stations: Station[]): MiniSearch {
  const index = new MiniSearch({
    idField: "id",
    fields: searchFields,
    storeFields,
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      combineWith: "AND",
      boost: { name: 2, city: 1.5 },
    },
  });
  index.addAll(stations);
  return index;
}
