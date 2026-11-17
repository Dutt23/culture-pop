/** The card for a reference inside `scope` (by `data-card`, so ids like "wd:Q1" need no escaping). */
export function cardElement(scope: ParentNode | null | undefined, referenceId: string) {
  return [...(scope?.querySelectorAll<HTMLElement>('[data-card]') ?? [])].find(
    (element) => element.dataset.card === referenceId,
  );
}
