// The age question on the signup form. TrackWyze is for people running a business, so it is for adults:
// anyone who picks "Under 18" cannot sign up. The form checks it, and the database refuses an under-18
// signup too (migration 20261105090000_signup_age_check.sql), so skipping the form does not get around it.

export interface AgeGroupOption {
  value: string;
  label: string;
}

export const AGE_GROUPS: AgeGroupOption[] = [
  { value: 'under_18', label: 'Under 18' },
  { value: '18_24', label: '18 to 24' },
  { value: '25_34', label: '25 to 34' },
  { value: '35_44', label: '35 to 44' },
  { value: '45_54', label: '45 to 54' },
  { value: '55_plus', label: '55 and above' },
];

export const MINIMUM_AGE = 18;

export const UNDER_AGE_MESSAGE = `Trackwyze is for people aged ${MINIMUM_AGE} and above, so we can't create an account for you. Please ask a parent or guardian to run the business account.`;

/** True when the chosen age group may sign up. An empty or unknown choice is not allowed. */
export function isAllowedAgeGroup(value: string): boolean {
  return AGE_GROUPS.some(group => group.value === value) && value !== 'under_18';
}
