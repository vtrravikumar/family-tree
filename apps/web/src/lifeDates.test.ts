import { describe, expect, it } from "vitest";
import { formatLifeDates, type LifeDateFields } from "./lifeDates";

const person: LifeDateFields = {
  life_status: "alive",
  birth_date_kind: "unknown",
  birth_exact_date: null,
  birth_year: null,
  birth_range_start_year: null,
  birth_range_end_year: null,
  birth_original_text: null,
  death_date_kind: "unknown",
  death_exact_date: null,
  death_year: null,
  death_range_start_year: null,
  death_range_end_year: null,
  death_original_text: null,
};

describe("formatLifeDates", () => {
  it("leaves an unknown birth date blank for a living person", () => {
    expect(formatLifeDates(person)).toBe("");
  });

  it("shows only the available birth date for a living person", () => {
    expect(formatLifeDates({ ...person, birth_date_kind: "year", birth_year: 1917 })).toBe("1917");
  });

  it("shows birth and death dates for a deceased person", () => {
    expect(formatLifeDates({
      ...person,
      life_status: "deceased",
      birth_date_kind: "year",
      birth_year: 1917,
      death_date_kind: "exact",
      death_exact_date: "1942-07-15",
    })).toBe("1917 – 15 Jul 1942");
  });

  it("shows whichever date is available for a deceased person", () => {
    expect(formatLifeDates({
      ...person,
      life_status: "deceased",
      death_date_kind: "year",
      death_year: 1942,
    })).toBe("1942");
  });

  it("keeps approximate and range date precision", () => {
    expect(formatLifeDates({
      ...person,
      birth_date_kind: "approximate_year",
      birth_year: 1905,
    })).toBe("c. 1905");
    expect(formatLifeDates({
      ...person,
      birth_date_kind: "range",
      birth_range_start_year: 1900,
      birth_range_end_year: 1905,
    })).toBe("1900–1905");
  });
});
