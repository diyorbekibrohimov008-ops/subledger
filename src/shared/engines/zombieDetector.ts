import { round2, toMonthlyUsd } from '../currency';
import type {
  EmploymentStatus,
  WorkspaceMetrics,
  WorkspaceState,
  ZombieSeat,
} from '../types';
import { diffDays, maxIsoDate } from './dateUtils';

export function evaluateZombieSeat(
  seat: Omit<ZombieSeat, 'daysInactive' | 'lastAppActivityAt'>,
  thresholdDays: number,
  referenceDate: string
): ZombieSeat {
  const lastAppActivityAt = maxIsoDate(seat.lastSsoLoginAt, seat.lastSlackActiveAt);
  const daysInactive = lastAppActivityAt
    ? Math.max(0, diffDays(lastAppActivityAt, referenceDate))
    : 90;

  let status = seat.status;
  if (status !== 'reclaimed' && status !== 'exempt' && status !== 'nudge_sent' && status !== 'reclaim_scheduled') {
    if (seat.employmentStatus === 'offboarded' || daysInactive >= thresholdDays) {
      status = 'flagged';
    }
  }

  return {
    ...seat,
    lastAppActivityAt,
    daysInactive,
    status,
  };
}

export function reevaluateWorkspaceZombies(
  state: WorkspaceState,
  thresholdDays = state.settings.zombieThresholdDays
): WorkspaceState {
  const nextSeats = state.zombieSeats.map((seat) => {
    const lastAppActivityAt = maxIsoDate(seat.lastSsoLoginAt, seat.lastSlackActiveAt);
    const daysInactive = lastAppActivityAt
      ? Math.max(0, diffDays(lastAppActivityAt, state.settings.referenceDate))
      : 90;

    return {
      ...seat,
      lastAppActivityAt,
      daysInactive,
    };
  });

  return {
    ...state,
    settings: {
      ...state.settings,
      zombieThresholdDays: thresholdDays,
    },
    zombieSeats: nextSeats,
    updatedAt: new Date().toISOString(),
  };
}

export function getActiveFlaggedZombies(state: WorkspaceState): ZombieSeat[] {
  const threshold = state.settings.zombieThresholdDays;
  return state.zombieSeats.filter(
    (s) =>
      s.status !== 'reclaimed' &&
      s.status !== 'exempt' &&
      (s.employmentStatus === 'offboarded' || s.daysInactive >= threshold)
  );
}

export function parseSeatActivityCsv(
  csvText: string,
  state: WorkspaceState
): ZombieSeat[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.findIndex((h) => h.includes(name));

  const vendorIdx = idx('vendor') !== -1 ? idx('vendor') : idx('app');
  const nameIdx = idx('name');
  const emailIdx = idx('email');
  const deptIdx = idx('dept') !== -1 ? idx('dept') : idx('department');
  const costIdx = idx('cost') !== -1 ? idx('cost') : idx('price');
  const ssoIdx = idx('sso');
  const slackIdx = idx('slack');
  const empIdx = idx('employment') !== -1 ? idx('employment') : idx('status');

  if (vendorIdx === -1 || emailIdx === -1) return [];

  const results: ZombieSeat[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const vendor = cols[vendorIdx];
    const employeeEmail = cols[emailIdx];
    if (!vendor || !employeeEmail) continue;

    const employeeName = nameIdx >= 0 && cols[nameIdx] ? cols[nameIdx] : employeeEmail.split('@')[0];
    const department = deptIdx >= 0 && cols[deptIdx] ? cols[deptIdx] : 'Operations';
    const rawSeatCost = costIdx >= 0 ? (cols[costIdx] ?? '').replace(/(?:US\$|CA\$|A\$)|[€£$,\s]/gi, '') : '';
    const parsedSeatCost = rawSeatCost ? Number.parseFloat(rawSeatCost) : Number.NaN;
    const seatCost = Number.isFinite(parsedSeatCost) && parsedSeatCost > 0 ? parsedSeatCost : 15;
    const lastSsoLoginAt = ssoIdx >= 0 && cols[ssoIdx] ? cols[ssoIdx].slice(0, 10) : null;
    const lastSlackActiveAt = slackIdx >= 0 && cols[slackIdx] ? cols[slackIdx].slice(0, 10) : null;
    const employmentStatus: EmploymentStatus =
      empIdx >= 0 && cols[empIdx] && /offboard|former|terminated|inactive/i.test(cols[empIdx])
        ? 'offboarded'
        : 'active';

    const matchedSub = state.subscriptions.find(
      (s) => s.vendor.toLowerCase() === vendor.toLowerCase()
    );

    results.push(
      evaluateZombieSeat(
        {
          id: `seat-${vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${employeeEmail.replace(/[^a-z0-9]+/gi, '-')}`,
          subscriptionId: matchedSub?.id ?? `sub-${vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          vendor: matchedSub?.vendor ?? vendor,
          employeeName,
          employeeEmail,
          department,
          employmentStatus,
          seatCostMonthlyUsd: round2(seatCost),
          lastSsoLoginAt,
          lastSlackActiveAt,
          activitySource:
            lastSsoLoginAt && lastSlackActiveAt
              ? 'both'
              : lastSlackActiveAt
                ? 'slack'
                : 'google_workspace_sso',
          status: 'flagged',
        },
        state.settings.zombieThresholdDays,
        state.settings.referenceDate
      )
    );
  }

  return results;
}

export function computeWorkspaceMetrics(state: WorkspaceState): WorkspaceMetrics {
  const activeSubs = state.subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trial' || s.status === 'canceling'
  );

  const monthlySpendUsd = round2(
    activeSubs.reduce(
      (sum, s) => sum + toMonthlyUsd(s.amount, s.currency, s.billingCycle),
      0
    )
  );
  const annualSpendUsd = round2(monthlySpendUsd * 12);

  const openHikes = state.priceHikes.filter(
    (h) => h.status === 'open' || h.status === 'disputing'
  );
  const annualHikeImpactUsd = round2(
    openHikes.reduce((sum, h) => sum + h.annualImpactUsd, 0)
  );

  const flaggedZombies = getActiveFlaggedZombies(state);
  const offboardedZombieCount = flaggedZombies.filter(
    (z) => z.employmentStatus === 'offboarded'
  ).length;
  const monthlyZombieWasteUsd = round2(
    flaggedZombies.reduce((sum, z) => sum + z.seatCostMonthlyUsd, 0)
  );
  const annualZombieWasteUsd = round2(monthlyZombieWasteUsd * 12);

  const reclaimedSeats = state.zombieSeats.filter((z) => z.status === 'reclaimed');
  const reclaimedMonthlySavingsUsd = round2(
    reclaimedSeats.reduce((sum, z) => sum + z.seatCostMonthlyUsd, 0)
  );
  const reclaimedAnnualSavingsUsd = round2(reclaimedMonthlySavingsUsd * 12);

  const upcoming = activeSubs.filter((s) => {
    const d = diffDays(state.settings.referenceDate, s.nextRenewalDate);
    return d >= 0 && d <= state.settings.renewalNoticeWindowDays;
  });
  const upcomingRenewals14dUsd = round2(
    upcoming.reduce((sum, s) => sum + toMonthlyUsd(s.amount, s.currency, s.billingCycle), 0)
  );

  const planPriceMonthlyUsd = 0;
  const cledaraMonthlyBaselineUsd = 175;
  const totalMonthlyDetectedValue = monthlyZombieWasteUsd + reclaimedMonthlySavingsUsd + round2(annualHikeImpactUsd / 12);
  const netPaybackMultiple =
    planPriceMonthlyUsd > 0 ? round2(totalMonthlyDetectedValue / planPriceMonthlyUsd) : 0;

  return {
    activeSubscriptionCount: activeSubs.length,
    monthlySpendUsd,
    annualSpendUsd,
    openHikeCount: openHikes.length,
    annualHikeImpactUsd,
    flaggedZombieCount: flaggedZombies.length,
    offboardedZombieCount,
    monthlyZombieWasteUsd,
    annualZombieWasteUsd,
    reclaimedMonthlySavingsUsd,
    reclaimedAnnualSavingsUsd,
    upcomingRenewals14dCount: upcoming.length,
    upcomingRenewals14dUsd,
    planPriceMonthlyUsd,
    cledaraMonthlyBaselineUsd,
    netPaybackMultiple,
  };
}
