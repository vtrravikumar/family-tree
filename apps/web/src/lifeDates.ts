export type LifeDateFields = {
  life_status: string;
  birth_date_kind: string;
  birth_exact_date: string | null;
  birth_year: number | null;
  birth_range_start_year: number | null;
  birth_range_end_year: number | null;
  birth_original_text: string | null;
  death_date_kind: string;
  death_exact_date: string | null;
  death_year: number | null;
  death_range_start_year: number | null;
  death_range_end_year: number | null;
  death_original_text: string | null;
};

type DatePart = Pick<LifeDateFields,
  "birth_date_kind" | "birth_exact_date" | "birth_year" |
  "birth_range_start_year" | "birth_range_end_year" | "birth_original_text"
>;

function formatDatePart(date: DatePart): string {
  if (date.birth_date_kind === "exact" && date.birth_exact_date) {
    const [year, month, day] = date.birth_exact_date.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
    });
  }
  if ((date.birth_date_kind === "year" || date.birth_date_kind === "approximate_year") && date.birth_year) {
    return date.birth_date_kind === "approximate_year" ? `c. ${date.birth_year}` : String(date.birth_year);
  }
  if (date.birth_date_kind === "range" && date.birth_range_start_year && date.birth_range_end_year) {
    return `${date.birth_range_start_year}–${date.birth_range_end_year}`;
  }
  return date.birth_original_text?.trim() || "";
}

export function formatLifeDates(person: LifeDateFields): string {
  const birth = formatDatePart({
    birth_date_kind: person.birth_date_kind,
    birth_exact_date: person.birth_exact_date,
    birth_year: person.birth_year,
    birth_range_start_year: person.birth_range_start_year,
    birth_range_end_year: person.birth_range_end_year,
    birth_original_text: person.birth_original_text,
  });

  if (person.life_status !== "deceased") return birth;

  const death = formatDatePart({
    birth_date_kind: person.death_date_kind,
    birth_exact_date: person.death_exact_date,
    birth_year: person.death_year,
    birth_range_start_year: person.death_range_start_year,
    birth_range_end_year: person.death_range_end_year,
    birth_original_text: person.death_original_text,
  });

  return [birth, death].filter(Boolean).join(" – ");
}
