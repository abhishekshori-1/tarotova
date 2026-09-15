/** Provider content refusals are terminal, not availability failures. */
export function isProviderRefusal(reason: string): boolean {
  return /^(?:provider_blocked|provider_refused|provider_finish_(?:safety|blocklist|prohibited_content|spii))$/.test(reason);
}
