package com.subsense.dto;

/**
 * Upcoming renewal event — used by the Renewal Calendar view.
 */
public record RenewalEvent(
        String id,
        String name,
        String icon,
        String category,
        double monthlyCost,
        String accentColor,
        String renewalDate,       // "yyyy-MM-dd"
        int daysUntilRenewal,
        String urgency,           // "today" | "urgent" | "warning" | "normal"
        boolean isFlagged,        // dead weight, snooze, or sentinel alert
        boolean sentinelAlert
) {}
