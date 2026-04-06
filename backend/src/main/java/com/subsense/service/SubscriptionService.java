package com.subsense.service;

import com.subsense.dto.DashboardStats;
import com.subsense.dto.SubscriptionEnriched;
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
