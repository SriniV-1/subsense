package com.subsense.service;

import com.subsense.model.UsageLog;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Core analytics math — Java port of src/utils/calculations.js.
 *
 * Value Score  = totalHours / monthlyCost   (higher = better ROI)
 * Cost Per Hour = monthlyCost / totalHours  (lower = better)
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
        if (totalMinutes <= 0) return -1; // sentinel for Infinity
        double hours = totalMinutes / 60.0;
        return Math.round((monthlyCost / hours) * 100.0) / 100.0;
    }

    /** True when cost-per-hour exceeds the user's snooze threshold. */
    public boolean shouldSnooze(double monthlyCost, int totalMinutes, double thresholdCPH) {
        double cph = calcCostPerHour(monthlyCost, totalMinutes);
        return cph < 0 || cph > thresholdCPH; // -1 means infinite CPH → always snooze
    }

    /** True when every log in the last deadDays has 0 minutes. */
    public boolean isDeadWeight(List<UsageLog> logs) {
        List<UsageLog> recent = logs.subList(Math.max(0, logs.size() - 30), logs.size());
        return recent.stream().allMatch(l -> l.minutes() == 0);
    }

    /** Days from today to the renewal date string "yyyy-MM-dd". */
    public int daysUntilRenewal(String renewalDate) {
        LocalDate renewal = LocalDate.parse(renewalDate);
        return (int) ChronoUnit.DAYS.between(LocalDate.now(), renewal);
    }

    /**
     * Usage drop % comparing the last recentDays against the prior period.
     * Returns 0-100+.
     */
    public int usageDropPercent(List<UsageLog> logs, int recentDays) {
        if (logs.size() < recentDays + 1) return 0;

        List<UsageLog> recent = logs.subList(logs.size() - recentDays, logs.size());
        List<UsageLog> historical = logs.subList(0, logs.size() - recentDays);

        double recentAvg = recent.stream().mapToInt(UsageLog::minutes).average().orElse(0);
        double historicalAvg = historical.stream().mapToInt(UsageLog::minutes).average().orElse(0);

        if (historicalAvg == 0) return 0;
        return Math.max(0, (int) Math.round(((historicalAvg - recentAvg) / historicalAvg) * 100));
    }

    /**
     * Sentinel alert: renewal within 48 hours AND usage drop ≥ threshold.
     */
    public boolean sentinelShouldAlert(String renewalDate, List<UsageLog> logs, int dropThreshold) {
        int days = daysUntilRenewal(renewalDate);
        int drop = usageDropPercent(logs, 7);
        return days <= 2 && drop >= dropThreshold;
    }

    /**
     * Normalize a list of value scores to a 0-100 scale.
     * Returns an array parallel to the input list.
     */
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
}
