package com.subsense.dto;

/**
 * Aggregated portfolio stats for the Dashboard KPI row.
 */
public record DashboardStats(
        double totalMonthlySpend,
        double monthlyBudget,
        double budgetUsedPercent,
        double avgCostPerHour,
        int totalSubscriptions,
        int snoozeAlertCount,
        int deadWeightCount,
        int sentinelAlertCount
) {}
