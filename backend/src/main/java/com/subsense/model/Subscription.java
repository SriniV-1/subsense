package com.subsense.model;

import java.util.List;

/**
 * Core subscription entity — mirrors the JS catalog shape.
 */
public record Subscription(
        String id,
        String name,
        String category,
        double monthlyCost,
        String accentColor,
        String bgGradient,
        String icon,
        String tier,
        String renewalDate,      // "yyyy-MM-dd"
        String usagePattern,     // "daily" | "binge" | "ghost" | "weekend"
        List<UsageLog> usageLogs,
        int totalMinutes
) {}
