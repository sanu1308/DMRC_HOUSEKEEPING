import type { ReadonlyURLSearchParams } from 'next/navigation';

const STORAGE_KEY = 'dmrc_admin_filters_v1';

export type SharedAdminFilters = {
  stationId?: string;
  from?: string;
  to?: string;
  updatedAt?: number;
};

const clean = (value?: string | null) => (value ?? '').trim();

export function getSharedAdminFilters(): SharedAdminFilters | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      stationId: clean(parsed.stationId),
      from: clean(parsed.from),
      to: clean(parsed.to),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : undefined,
    };
  } catch (error) {
    console.warn('Failed to parse shared admin filters', error);
    return null;
  }
}

export function persistSharedAdminFilters(partial: SharedAdminFilters) {
  if (typeof window === 'undefined') {
    return;
  }

  const current = getSharedAdminFilters() || {};
  const snapshot: SharedAdminFilters = {
    stationId: clean(partial.stationId) || clean(current.stationId),
    from: clean(partial.from) || clean(current.from),
    to: clean(partial.to) || clean(current.to),
    updatedAt: Date.now(),
  };

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function resolveSharedAdminFilters(
  searchParams?: ReadonlyURLSearchParams | null,
): SharedAdminFilters {
  const shared = getSharedAdminFilters();

  const directStation = clean(searchParams?.get('station_id'));
  const directFrom = clean(searchParams?.get('from'));
  const directTo = clean(searchParams?.get('to'));
  const singleDate = clean(searchParams?.get('date'));

  let from = directFrom;
  let to = directTo;

  if (!from && !to && singleDate) {
    from = singleDate;
    to = singleDate;
  }

  return {
    stationId: directStation || shared?.stationId || '',
    from: from || shared?.from || '',
    to: to || shared?.to || '',
  };
}

export function clearSharedAdminFilters() {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.removeItem(STORAGE_KEY);
}
