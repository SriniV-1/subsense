package com.subsense.model;

/**
 * Mock user profile — replace with real auth + DB in production.
 */
public record UserProfile(
        String name,
        String email,
        String avatarInitials,
        double monthlyBudget,
        double alertThresholdCPH,       // cost-per-hour snooze trigger ($)
        int sentinelDropThreshold        // usage-drop % for AI alert
) {}
