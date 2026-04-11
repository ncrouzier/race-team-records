export interface TeamRequirementsConfig {
  minRaceAndVolunteerCount: number;
  minAgeGrade: number;
  year?: number;
}

const defaults: TeamRequirementsConfig = {
  minRaceAndVolunteerCount: 8,
  minAgeGrade: 70
};

const yearOverrides: Record<number, Partial<TeamRequirementsConfig>> = {
  // 2025: { minRaceAndVolunteerCount: 6 }
};

export function getTeamRequirementsForYear(year: number): TeamRequirementsConfig & { year: number } {
  const config = { ...defaults };
  const overrides = yearOverrides[year];
  if (overrides) {
    Object.assign(config, overrides);
  }
  return { ...config, year };
}
