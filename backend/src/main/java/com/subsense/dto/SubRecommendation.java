package com.subsense.dto;

/**
 * Single-subscription action recommendation produced by the optimizer.
 * action: KEEP | DOWNGRADE | CUT
 */
public record SubRecommendation(
        String id,
        String name,
        String icon,
        double monthlyCost,
        double valueScore,
        int    normScore,
        String grade,
        String action,
        String reason,
        double annualSavings   // 0 for KEEP; projected savings for CUT / DOWNGRADE
) {}
