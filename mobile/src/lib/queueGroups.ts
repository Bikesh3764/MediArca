// Split a queue into shift groups, but only when it really has more than one shift.
export function groupByShift<T>(items: T[], shiftOf: (item: T) => string | null): { shift: string | null; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = shiftOf(item) || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  if (groups.size <= 1) return [{ shift: null, items }];
  return [...groups.entries()].map(([shift, list]) => ({ shift: shift || null, items: list }));
}

/** Menu title for a queue row: token and name (the walk-in code has its own Show code item). */
export const rowMenuTitle = (token: number, name: string) => `#${token} · ${name}`;

/** One key per shift timing, so the same shift at two clinics counts once. */
export const slotKey = (slot: { startTime?: string; endTime?: string }) => `${slot.startTime || ''}-${slot.endTime || ''}`;
