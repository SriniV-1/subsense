package com.subsense.service;

import com.subsense.model.Subscription;
import com.subsense.model.UsageLog;
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
}
