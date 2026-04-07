package com.subsense.service;

import com.subsense.dto.CategoryBreakdown;
import com.subsense.dto.FlaggedSubscription;
import com.subsense.dto.RenewalEvent;
import com.subsense.dto.SubscriptionEnriched;
import com.subsense.model.Subscription;
import com.subsense.model.UsageLog;
import com.subsense.model.UserProfile;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Core analytics math — Java source-of-truth for all subscription metrics.
 * The JavaScript calculations.js mirrors these for offline fallback only.
 */
@Service
public class AnalyticsService {

    /** Value Score = hours used / monthly cost. Higher is better. */
    public double calcValueScore(int totalMinutes, double monthlyCost) {
        if (monthlyCost <= 0) return 0;
        double hours = totalMinutes / 60.0;
        return Math.round((hours / monthlyCost) * 1000.0) / 1000.0;
    }

    /**
     * Cost-per-Hour = monthly cost / hours used.
     * Returns -1 to signal Infinity (unused subscription).
     */
    public double calcCostPerHour(double monthlyCost, int totalMinutes) {
        if (totalMinutes <= 0) return -1;
        double hours = totalMinutes / 60.0;
        return Math.round((monthlyCost / hours) * 100.0) / 100.0;
    }

    /** True when cost-per-hour exceeds the user's snooze threshold. */
    public boolean shouldSnooze(double monthlyCost, int totalMinutes, double thresholdCPH) {
        double cph = calcCostPerHour(monthlyCost, totalMinutes);
        return cph < 0 || cph > thresholdCPH;
    }

    /** True when every log in the last 30 days has 0 minutes. */
    public boolean isDeadWeight(List<UsageLog> logs) {
        List<UsageLog> recent = logs.subList(Math.max(0, logs.size() - 30), logs.size());
        return recent.stream().allMatch(l -> l.minutes() == 0);
    }

    /** Days from today to the renewal date string "yyyy-MM-dd". */
    public int daysUntilRenewal(String renewalDate) {
        LocalDate renewal = LocalDate.parse(renewalDate);
        return (int) ChronoUnit.DAYS.between(LocalDate.now(), renewal);
    }

    /** Usage drop % comparing the last recentDays against the prior period. */
    public int usageDropPercent(List<UsageLog> logs, int recentDays) {
        if (logs.size() < recentDays + 1) return 0;
        List<UsageLog> recent = logs.subList(logs.size() - recentDays, logs.size());
        List<UsageLog> historical = logs.subList(0, logs.size() - recentDays);
        double recentAvg = recent.stream().mapToInt(UsageLog::minutes).average().orElse(0);
        double historicalAvg = historical.stream().mapToInt(UsageLog::minutes).average().orElse(0);
        if (historicalAvg == 0) return 0;
        return Math.max(0, (int) Math.round(((historicalAvg - recentAvg) / historicalAvg) * 100));
    }

    /** Sentinel: renewal within 48 hours AND usage drop ≥ threshold. */
    public boolean sentinelShouldAlert(String renewalDate, List<UsageLog> logs, int dropThreshold) {
        int days = daysUntilRenewal(renewalDate);
        int drop = usageDropPercent(logs, 7);
        return days <= 2 && drop >= dropThreshold;
    }

    /** Normalize a list of value scores to a 0-100 scale. */
    public int[] normalizeScores(double[] rawScores) {
        double max = 0.001;
        for (double s : rawScores) if (s > max) max = s;
        int[] normalized = new int[rawScores.length];
        for (int i = 0; i < rawScores.length; i++) {
            normalized[i] = (int) Math.round((rawScores[i] / max) * 100);
        }
        return normalized;
    }

    /** Grade label from a 0-100 normalized score. */
    public String valueGrade(int normScore) {
        if (normScore >= 80) return "Excellent";
        if (normScore >= 60) return "Good";
        if (normScore >= 40) return "Fair";
        if (normScore >= 20) return "Poor";
        return "Dead Weight";
    }

    // ── New analysis methods (no JS equivalent — backend-authoritative) ─────────

    /**
     * Binge-and-abandon: heavily used in the first half of the log window,
     * near-zero in the second half.
     */
    public boolean isBingeAndAbandon(List<UsageLog> logs) {
        if (logs.size() < 20) return false;
        int mid = logs.size() / 2;
        List<UsageLog> older  = logs.subList(0, mid);
        List<UsageLog> recent = logs.subList(mid, logs.size());
        double olderAvg  = older.stream().mapToInt(UsageLog::minutes).average().orElse(0);
        double recentAvg = recent.stream().mapToInt(UsageLog::minutes).average().orElse(0);
        return olderAvg > 40 && recentAvg < 5;
    }

    /**
     * Chronic low usage: average daily minutes is above zero but below the threshold.
     * Catches subscriptions that are technically "used" but not meaningfully so.
     */
    public boolean hasChronicLowUsage(List<UsageLog> logs, double minThresholdMinutes) {
        if (logs.size() < 14) return false;
        double avg = logs.stream().mapToInt(UsageLog::minutes).average().orElse(0);
        return avg > 0 && avg < minThresholdMinutes;
    }

    /**
     * Returns categories that have 2 or more subscriptions (potential spending overlap).
     * Map key = category name, value = list of subscriptions in that category.
     */
    public Map<String, List<Subscription>> findCategoryOverlap(List<Subscription> subscriptions) {
        Map<String, List<Subscription>> groups = new LinkedHashMap<>();
        for (Subscription s : subscriptions) {
            groups.computeIfAbsent(s.category(), k -> new ArrayList<>()).add(s);
        }
        Map<String, List<Subscription>> overlapping = new LinkedHashMap<>();
        for (var entry : groups.entrySet()) {
            if (entry.getValue().size() >= 2) {
                overlapping.put(entry.getKey(), entry.getValue());
            }
        }
        return overlapping;
    }

    /** True if total subscription spend exceeds the monthly budget. */
    public boolean isBudgetOverflow(List<Subscription> subscriptions, double budget) {
        double total = subscriptions.stream().mapToDouble(Subscription::monthlyCost).sum();
        return total > budget;
    }

    /** Total monthly spend across all subscriptions. */
    public double totalMonthlySpend(List<Subscription> subscriptions) {
        return subscriptions.stream().mapToDouble(Subscription::monthlyCost).sum();
    }

    // ── Portfolio health score (0-100) ─────────────────────────────────────────

    /**
     * Composite health score:
     *   Start at 100, deduct for budget overflow, dead weight, sentinel alerts,
     *   excessive snooze candidates, and chronically high avg CPH.
     */
    public int computeHealthScore(List<SubscriptionEnriched> enriched, UserProfile profile) {
        int score = 100;

        double totalSpend = enriched.stream().mapToDouble(SubscriptionEnriched::monthlyCost).sum();
        double totalHours = enriched.stream().mapToDouble(e -> e.totalMinutes() / 60.0).sum();
        double avgCPH     = totalHours > 0 ? totalSpend / totalHours : 999;

        // Budget overflow: up to -25
        if (totalSpend > profile.monthlyBudget()) {
            double overRatio = (totalSpend - profile.monthlyBudget()) / profile.monthlyBudget();
            score -= (int) Math.min(25, overRatio * 40);
        }

        // Dead weight or "Dead Weight" grade: -5 per sub, max -20
        long deadCount = enriched.stream()
                .filter(e -> e.isDeadWeight() || "Dead Weight".equals(e.grade()))
                .count();
        score -= (int) Math.min(20, deadCount * 5);

        // Sentinel alerts: -8 per alert, max -16
        long sentinelCount = enriched.stream().filter(SubscriptionEnriched::sentinelAlert).count();
        score -= (int) Math.min(16, sentinelCount * 8);

        // Snooze candidates not already flagged as dead/sentinel: -2 per, max -10
        long snoozeOnly = enriched.stream()
                .filter(e -> e.shouldSnooze() && !e.isDeadWeight() && !e.sentinelAlert())
                .count();
        score -= (int) Math.min(10, snoozeOnly * 2);

        // Avg CPH well above threshold: -10
        if (avgCPH > profile.alertThresholdCPH() * 2) score -= 10;

        return Math.max(0, score);
    }

    public String healthGrade(int score) {
        if (score >= 85) return "Excellent";
        if (score >= 70) return "Good";
        if (score >= 50) return "Fair";
        if (score >= 30) return "At Risk";
        return "Critical";
    }

    public String healthSummary(int score, List<SubscriptionEnriched> enriched, UserProfile profile) {
        double totalSpend = enriched.stream().mapToDouble(SubscriptionEnriched::monthlyCost).sum();
        long dead = enriched.stream().filter(e -> e.isDeadWeight() || "Dead Weight".equals(e.grade())).count();
        if (score >= 85) return "Your portfolio is in great shape — well-optimized value.";
        if (totalSpend > profile.monthlyBudget() * 1.5)
            return String.format("$%.0f/mo over budget — cut dead weight to recover quickly.", totalSpend - profile.monthlyBudget());
        if (dead >= 4) return dead + " subscriptions have zero or near-zero usage — easy wins to cancel.";
        if (score < 50) return "Several high-cost, low-usage subscriptions are dragging your score.";
        return "A few subscriptions could be trimmed to improve overall value.";
    }

    // ── Category breakdown ─────────────────────────────────────────────────────

    public List<CategoryBreakdown> computeCategoryBreakdown(List<SubscriptionEnriched> enriched) {
        double totalSpend = enriched.stream().mapToDouble(SubscriptionEnriched::monthlyCost).sum();
        Map<String, List<SubscriptionEnriched>> byCategory = new LinkedHashMap<>();
        for (SubscriptionEnriched e : enriched) {
            byCategory.computeIfAbsent(e.category(), k -> new ArrayList<>()).add(e);
        }
        return byCategory.entrySet().stream()
                .map(entry -> {
                    List<SubscriptionEnriched> group = entry.getValue();
                    double cost = group.stream().mapToDouble(SubscriptionEnriched::monthlyCost).sum();
                    double hours = group.stream().mapToDouble(e -> e.totalMinutes() / 60.0).sum();
                    double avgCPH = hours > 0
                            ? Math.round((cost / hours) * 100.0) / 100.0
                            : -1;
                    long dead = group.stream()
                            .filter(e -> e.isDeadWeight() || "Dead Weight".equals(e.grade()))
                            .count();
                    return new CategoryBreakdown(
                            entry.getKey(),
                            group.size(),
                            Math.round(cost * 100.0) / 100.0,
                            Math.round((cost / totalSpend) * 10000.0) / 100.0,
                            avgCPH,
                            (int) dead
                    );
                })
                .sorted(Comparator.comparingDouble(CategoryBreakdown::totalCost).reversed())
                .toList();
    }

    // ── Flagged subscriptions ──────────────────────────────────────────────────

    /**
     * Returns all subscriptions that have at least one actionable issue,
     * with pre-computed issue tag list.  Matches the frontend FlaggedView logic.
     */
    public List<FlaggedSubscription> computeFlagged(List<SubscriptionEnriched> enriched) {
        return enriched.stream()
                .map(e -> {
                    List<String> issues = new ArrayList<>();
                    if (e.sentinelAlert()) issues.add("sentinel");
                    if (e.isDeadWeight() || "Dead Weight".equals(e.grade())) issues.add("dead");
                    if (e.shouldSnooze() && !issues.contains("sentinel")) issues.add("snooze");
                    if (isBingeAndAbandon(e.usageLogs()) && !issues.contains("dead")) issues.add("binge_abandon");
                    if (issues.isEmpty()) return null;
                    return new FlaggedSubscription(
                            e.id(), e.name(), e.category(), e.monthlyCost(),
                            e.accentColor(), e.icon(), e.tier(), e.renewalDate(),
                            e.usagePattern(), e.usageLogs(), e.totalMinutes(),
                            e.valueScore(), e.costPerHour(), e.normScore(),
                            e.isDeadWeight(), e.shouldSnooze(), e.sentinelAlert(),
                            isBingeAndAbandon(e.usageLogs()), e.grade(),
                            e.daysUntilRenewal(), e.usageDropPercent(),
                            Math.round(e.monthlyCost() * 12 * 100.0) / 100.0,
                            issues
                    );
                })
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingInt(f -> {
                    if (f.issues().contains("sentinel")) return 0;
                    if (f.issues().contains("dead"))     return 1;
                    return 2;
                }))
                .toList();
    }

    // ── Renewal calendar ───────────────────────────────────────────────────────

    /** Upcoming renewals for the next 30 days, sorted by renewal date ascending. */
    public List<RenewalEvent> computeUpcomingRenewals(List<SubscriptionEnriched> enriched) {
        return enriched.stream()
                .filter(e -> e.daysUntilRenewal() >= 0 && e.daysUntilRenewal() <= 30)
                .map(e -> {
                    String urgency = e.daysUntilRenewal() == 0 ? "today"
                            : e.daysUntilRenewal() <= 2       ? "urgent"
                            : e.daysUntilRenewal() <= 7       ? "warning"
                            : "normal";
                    boolean flagged = e.isDeadWeight() || "Dead Weight".equals(e.grade())
                            || e.shouldSnooze() || e.sentinelAlert();
                    return new RenewalEvent(
                            e.id(), e.name(), e.icon(), e.category(), e.monthlyCost(),
                            e.accentColor(), e.renewalDate(), e.daysUntilRenewal(),
                            urgency, flagged, e.sentinelAlert()
                    );
                })
                .sorted(Comparator.comparingInt(RenewalEvent::daysUntilRenewal))
                .toList();
    }
}
