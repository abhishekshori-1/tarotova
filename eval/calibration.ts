export interface RequiredIssue { field: string; fragments: string[] }

/** A negative with known collateral issues must also catch its intended claim. */
export function caughtRequiredIssue(required: RequiredIssue | undefined, issues: { field: string; quote: string }[] | undefined): boolean {
  return !required || !!issues?.some((issue) => issue.field === required.field && required.fragments.some((fragment) => issue.quote.toLocaleLowerCase().includes(fragment.toLocaleLowerCase())));
}
