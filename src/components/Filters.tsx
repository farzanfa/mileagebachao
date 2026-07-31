// Filters panel (BUILD-CONTRACT §8, UX §4.5.4). Controlled component: it owns no
// state — it reads `value: FilterState` and emits a new FilterState via `onChange`.
// v1.0 filters are exactly: query, grade, brand and an "E0 only" toggle, plus the
// "near me" origin and sort selectors that back the rest of FilterState. Multi-select
// chips carry aria-pressed (state never colour-only). "E0 only" dims the legacy grade
// chips (E20 / ethanol-unknown) since they cannot appear in an ethanol-free result set.
// Ported from the prototype filters aside.

"use client";

import type {
  Brand,
  BrandMeta,
  FilterState,
  GradeMeta,
  GradeName,
  OriginCity,
  SortKey,
} from "@/lib/types";
import { ALL_BRANDS, LEGACY_GRADES, PRIMARY_GRADES } from "@/lib/constants";
import Chip from "@/components/ui/Chip";
import Switch from "@/components/ui/Switch";
import Button from "@/components/ui/Button";

interface FiltersProps {
  value: FilterState;
  onChange: (f: FilterState) => void;
  gradeMeta: Record<GradeName, GradeMeta>;
  brandMeta: Record<Brand, BrandMeta>;
  origins: OriginCity[];
}

const GROUP_LABEL =
  "mb-[10px] text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--ink-3)]";
const SELECT_CLASS =
  "min-h-[44px] w-full rounded-[8px] border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] font-bold text-[var(--ink)]";

function SearchIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" strokeLinecap="round" />
    </svg>
  );
}

/** Short display name for an origin, e.g. "Delhi (Connaught Place)" -> "Delhi". */
function shortOrigin(name: string): string {
  const idx = name.indexOf(" (");
  return idx === -1 ? name : name.slice(0, idx);
}

export function Filters({ value, onChange, gradeMeta, brandMeta, origins }: FiltersProps) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });

  const toggleGrade = (g: GradeName) =>
    set({ grades: { ...value.grades, [g]: !value.grades[g] } });
  const toggleBrand = (b: Brand) => set({ brands: { ...value.brands, [b]: !value.brands[b] } });

  const handleReset = () => {
    const grades = {} as Record<GradeName, boolean>;
    (Object.keys(gradeMeta) as GradeName[]).forEach((g) => {
      const meta = gradeMeta[g];
      // Default: the three 100-RON grades on, legacy grades opt-in (UX §4.5.4).
      grades[g] = meta ? !meta.legacy : true;
    });
    const brands = {} as Record<Brand, boolean>;
    (Object.keys(brandMeta) as Brand[]).forEach((b) => {
      brands[b] = true;
    });
    onChange({ ...value, grades, brands, e0Only: false, query: "", sort: "dist" });
  };

  const renderGradeChip = (g: GradeName) => {
    const meta = gradeMeta[g];
    if (!meta) return null;
    const dot = brandMeta[meta.brand]?.colorVar;
    const pressed = value.grades[g] ?? false;
    const dimmed = meta.legacy && value.e0Only;
    return (
      <Chip
        key={g}
        pressed={pressed}
        onToggle={() => toggleGrade(g)}
        dotColorVar={dot}
        ron={meta.ron}
        legacy={meta.legacy}
        dimmed={dimmed}
        aria-label={`${meta.full}${pressed ? ", selected" : ""}`}
      >
        {g}
      </Chip>
    );
  };

  const renderBrandChip = (b: Brand) => {
    const meta = brandMeta[b];
    if (!meta) return null;
    const pressed = value.brands[b] ?? false;
    return (
      <Chip
        key={b}
        pressed={pressed}
        onToggle={() => toggleBrand(b)}
        dotColorVar={meta.colorVar}
        aria-label={`${meta.name}${pressed ? ", selected" : ""}`}
      >
        {meta.name}
      </Chip>
    );
  };

  return (
    <div className="flex h-full flex-col bg-[var(--surface)]">
      {/* Search */}
      <div className="px-4 pt-4">
        <label htmlFor="filters-q" className="sr-only">
          Search by city, locality or pincode
        </label>
        <div className="flex min-h-[44px] items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[var(--ink-3)]">
          <SearchIcon />
          <input
            id="filters-q"
            type="search"
            value={value.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="City, locality or pincode"
            autoComplete="off"
            className="w-full border-0 bg-transparent text-[14px] text-[var(--ink)] outline-none"
          />
        </div>
      </div>

      {/* Grade — 100 RON */}
      <fieldset className="mt-4 border-t border-[var(--line)] px-4 pt-4">
        <legend className={GROUP_LABEL}>Fuel grade · 100 RON</legend>
        <div className="flex flex-wrap gap-[7px]">{PRIMARY_GRADES.map(renderGradeChip)}</div>
      </fieldset>

      {/* Legacy grades */}
      <fieldset className="mt-4 border-t border-[var(--line)] px-4 pt-4">
        <legend className={GROUP_LABEL}>Legacy grades</legend>
        <div className="flex flex-wrap gap-[7px]">{LEGACY_GRADES.map(renderGradeChip)}</div>
      </fieldset>

      {/* Brand */}
      <fieldset className="mt-4 border-t border-[var(--line)] px-4 pt-4">
        <legend className={GROUP_LABEL}>Brand</legend>
        <div className="flex flex-wrap gap-[7px]">{ALL_BRANDS.map(renderBrandChip)}</div>
      </fieldset>

      {/* E0 only */}
      <div className="mt-4 border-t border-[var(--line)] px-4 pt-4">
        <Switch
          checked={value.e0Only}
          onChange={(on) => set({ e0Only: on })}
          label="Ethanol-free (E0) only"
          description="Hide E20 legacy grades entirely"
        />
      </div>

      {/* Origin + sort */}
      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[var(--line)] px-4 pt-4 sm:grid-cols-2">
        <div>
          <label htmlFor="filters-origin" className={`${GROUP_LABEL} block`}>
            Near
          </label>
          <select
            id="filters-origin"
            value={value.originId}
            onChange={(e) => set({ originId: e.target.value })}
            className={SELECT_CLASS}
          >
            {origins.map((o) => (
              <option key={o.id} value={o.id}>
                {shortOrigin(o.name)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filters-sort" className={`${GROUP_LABEL} block`}>
            Sort
          </label>
          <select
            id="filters-sort"
            value={value.sort}
            onChange={(e) => set({ sort: e.target.value as SortKey })}
            className={SELECT_CLASS}
          >
            <option value="dist">Distance</option>
            <option value="fresh">Recently verified</option>
          </select>
        </div>
      </div>

      {/* Reset */}
      <div className="px-4 py-4">
        <Button variant="ghost" fullWidth onClick={handleReset}>
          Reset all filters
        </Button>
      </div>
    </div>
  );
}

export default Filters;
