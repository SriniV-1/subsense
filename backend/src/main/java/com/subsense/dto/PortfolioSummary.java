package com.subsense.dto;

import java.util.List;

/**
 * Comprehensive portfolio health snapshot — returned by GET /api/portfolio/summary.
 * Computed entirely in Java; frontend uses this for the health score widget
 * and category breakdown chart.
 */
public record PortfolioSummary(
        // Spend
        double totalMonthlySpend,
        double monthlyBudget,
        double budgetUsedPercent,
        double annualSpend,
        double recoverableMonthly,  // from dead + snooze subs not yet invested
        double annualWaste,

        // Counts
        int totalSubscriptions,
        int deadWeightCount,
        int snoozeCount,
        int sentinelCount,
        int flaggedCount,

        // Health score
        int healthScore,            // 0–100
        String healthGrade,         // "Excellent" | "Good" | "Fair" | "At Risk" | "Critical"
        String healthSummary,       // one-line human-readable diagnosis
        List<String> topIssues,     // up to 3 actionable bullet points

        // Averages
        double avgCostPerHour,
        double avgValueScore,

        // Category breakdown
        List<CategoryBreakdown> categoryBreakdown
) {}
