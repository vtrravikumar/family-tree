export type EstimatedYearRange = { startYear: number; endYear: number };

export function parseEstimatedYearRange(value: string): EstimatedYearRange {
  const match = value.trim().match(/^(\d{1,4})\s*[-–—]\s*(\d{1,4})$/);
  if (!match) {
    throw new Error("Enter a year range using two years, for example 1940-1945.");
  }

  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (startYear < 1 || endYear < 1) {
    throw new Error("Years must be greater than 0.");
  }
  if (startYear > endYear) {
    throw new Error("The start year must be earlier than or equal to the end year.");
  }

  return { startYear, endYear };
}
