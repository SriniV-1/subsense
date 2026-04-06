package com.subsense.model;

/**
 * An item in the Swap Marketplace.
 */
public record SwapOption(
        String id,
        String name,
        double unitCost,
        String icon,
        String category
) {}
