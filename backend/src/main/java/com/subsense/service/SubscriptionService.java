package com.subsense.service;

import com.subsense.dto.*;
import com.subsense.model.Subscription;
import com.subsense.model.UserProfile;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Combines raw subscription data with computed analytics.
 */
@Service
public class SubscriptionService {

    private final MockDataService mockData;
    private final AnalyticsService analytics;

    public SubscriptionService(MockDataService mockData, AnalyticsService analytics) {
        this.mockData = mockData;
        this.analytics = analytics;
    }

    public List<SubscriptionEnriched> getAllEnriched() {
        List<Subscription> subs = mockData.getSubscriptions();
        UserProfile profile = mockData.getUserProfile();

        // Compute raw scores first so we can normalize across the full portfolio
        double[] rawScores = subs.stream()
                .mapToDouble(s -> analytics.calcValueScore(s.totalMinutes(), s.monthlyCost()))
                .toArray();
        int[] normScores = analytics.normalizeScores(rawScores);

        return java.util.stream.IntStream.range(0, subs.size())
                .mapToObj(i -> enrich(subs.get(i), normScores[i], profile))
                .toList();
    }

    public SubscriptionEnriched getEnriched(String id) {
        Subscription sub = mockData.getSubscription(id);
        if (sub == null) return null;

        // For single-item requests normScore is relative to full portfolio
        List<Subscription> all = mockData.getSubscriptions();
        double[] rawScores = all.stream()
                .mapToDouble(s -> analytics.calcValueScore(s.totalMinutes(), s.monthlyCost()))
                .toArray();
        int[] normScores = analytics.normalizeScores(rawScores);

        int idx = all.indexOf(sub);
        return enrich(sub, normScores[idx], mockData.getUserProfile());
    }

    public DashboardStats getDashboardStats() {
        List<SubscriptionEnriched> enriched = getAllEnriched();
        UserProfile profile = mockData.getUserProfile();

        double totalSpend = enriched.stream().mapToDouble(SubscriptionEnriched::monthlyCost).sum();
        double totalHours = enriched.stream().mapToDouble(e -> e.totalMinutes() / 60.0).sum();
        double avgCPH = totalHours > 0 ? totalSpend / totalHours : 0;

        return new DashboardStats(
                Math.round(totalSpend * 100.0) / 100.0,
                profile.monthlyBudget(),
                Math.round((totalSpend / profile.monthlyBudget()) * 10000.0) / 100.0,
                Math.round(avgCPH * 100.0) / 100.0,
                enriched.size(),
                (int) enriched.stream().filter(SubscriptionEnriched::shouldSnooze).count(),
                (int) enriched.stream().filter(SubscriptionEnriched::isDeadWeight).count(),
                (int) enriched.stream().filter(SubscriptionEnriched::sentinelAlert).count()
        );
    }

    public PortfolioSummary getPortfolioSummary() {
        List<SubscriptionEnriched> enriched = getAllEnriched();
        UserProfile profile = mockData.getUserProfile();

        double totalSpend   = enriched.stream().mapToDouble(SubscriptionEnriched::monthlyCost).sum();
        double totalHours   = enriched.stream().mapToDouble(e -> e.totalMinutes() / 60.0).sum();
        double avgCPH       = totalHours > 0 ? Math.round((totalSpend / totalHours) * 100.0) / 100.0 : -1;
        double avgValueScore= enriched.stream().mapToDouble(SubscriptionEnriched::valueScore).average().orElse(0);

        long dead     = enriched.stream().filter(e -> e.isDeadWeight() || "Dead Weight".equals(e.grade())).count();
        long snooze   = enriched.stream().filter(SubscriptionEnriched::shouldSnooze).count();
        long sentinel = enriched.stream().filter(SubscriptionEnriched::sentinelAlert).count();

        List<FlaggedSubscription> flagged = analytics.computeFlagged(enriched);
        double recoverable = flagged.stream().mapToDouble(FlaggedSubscription::monthlyCost).sum();

        int healthScore = analytics.computeHealthScore(enriched, profile);
        String grade    = analytics.healthGrade(healthScore);
        String summary  = analytics.healthSummary(healthScore, enriched, profile);

        List<String> topIssues = new java.util.ArrayList<>();
        if (totalSpend > profile.monthlyBudget())
            topIssues.add(String.format("Over budget by $%.2f/mo — cancel or snooze to save $%.0f/yr",
                    totalSpend - profile.monthlyBudget(), (totalSpend - profile.monthlyBudget()) * 12));
        if (dead > 0)
            topIssues.add(dead + " dead-weight subscription" + (dead > 1 ? "s" : "") +
                    " wasting $" + String.format("%.2f", flagged.stream()
                    .filter(f -> f.issues().contains("dead")).mapToDouble(FlaggedSubscription::monthlyCost).sum()) + "/mo");
        if (sentinel > 0)
            topIssues.add(sentinel + " subscription" + (sentinel > 1 ? "s" : "") +
                    " renewing soon with low recent usage — review before auto-renewal");

        return new PortfolioSummary(
                Math.round(totalSpend * 100.0) / 100.0,
                profile.monthlyBudget(),
                Math.round((totalSpend / profile.monthlyBudget()) * 10000.0) / 100.0,
                Math.round(totalSpend * 12 * 100.0) / 100.0,
                Math.round(recoverable * 100.0) / 100.0,
                Math.round(recoverable * 12 * 100.0) / 100.0,
                enriched.size(),
                (int) dead,
                (int) snooze,
                (int) sentinel,
                flagged.size(),
                healthScore,
                grade,
                summary,
                topIssues,
                avgCPH,
                Math.round(avgValueScore * 1000.0) / 1000.0,
                analytics.computeCategoryBreakdown(enriched)
        );
    }

    public List<FlaggedSubscription> getFlaggedSubscriptions() {
        return analytics.computeFlagged(getAllEnriched());
    }

    public List<RenewalEvent> getUpcomingRenewals() {
        return analytics.computeUpcomingRenewals(getAllEnriched());
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private SubscriptionEnriched enrich(Subscription sub, int normScore, UserProfile profile) {
        double valueScore   = analytics.calcValueScore(sub.totalMinutes(), sub.monthlyCost());
        double cph          = analytics.calcCostPerHour(sub.monthlyCost(), sub.totalMinutes());
        boolean snooze      = analytics.shouldSnooze(sub.monthlyCost(), sub.totalMinutes(), profile.alertThresholdCPH());
        boolean dead        = analytics.isDeadWeight(sub.usageLogs());
        int days            = analytics.daysUntilRenewal(sub.renewalDate());
        int drop            = analytics.usageDropPercent(sub.usageLogs(), 7);
        boolean sentinel    = analytics.sentinelShouldAlert(sub.renewalDate(), sub.usageLogs(), profile.sentinelDropThreshold());
        String grade        = analytics.valueGrade(normScore);

        return new SubscriptionEnriched(
                sub.id(), sub.name(), sub.category(), sub.monthlyCost(),
                sub.accentColor(), sub.bgGradient(), sub.icon(), sub.tier(),
                sub.renewalDate(), sub.usagePattern(), sub.usageLogs(), sub.totalMinutes(),
                valueScore, cph, normScore, snooze, dead, days, drop, sentinel, grade
        );
    }
}
