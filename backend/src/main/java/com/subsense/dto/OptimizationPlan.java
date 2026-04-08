package com.subsense.dto;

import java.util.List;

/**
 * Full budget-optimization result — keeps the best-value subscriptions
 * within the monthly budget and flags the rest for cutting/downgrading.
 */
public record OptimizationPlan(
        double currentSpend,
        double projectedSpend,
        double monthlyBudget,
        double monthlySavings,
        double annualSavings,
        int    keepCount,
        int    cutCount,
        int    downgradeCount,
        List<SubRecommendation> recommendations
) {}
