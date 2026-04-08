package com.subsense.service;

import com.subsense.dto.OptimizationPlan;
import com.subsense.dto.SubRecommendation;
import com.subsense.dto.SubscriptionEnriched;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Greedy knapsack budget optimizer.
 * Sorts enriched subscriptions by normScore descending and fills the monthly budget.
 * Anything that doesn't fit is CUT (dead weight) or DOWNGRADE (borderline value).
 */
@Service
public class OptimizerService {

    public OptimizationPlan optimize(List<SubscriptionEnriched> enriched, double monthlyBudget) {
        // Sort by normScore descending — highest-value subs fill the budget first
        List<SubscriptionEnriched> sorted = enriched.stream()
                .sorted(Comparator.comparingInt(SubscriptionEnriched::normScore).reversed())
                .toList();

        double currentSpend = enriched.stream()
                .mapToDouble(SubscriptionEnriched::monthlyCost).sum();

        List<SubRecommendation> recommendations = new ArrayList<>();
        double budgetUsed = 0;
        int keepCount = 0, cutCount = 0, downgradeCount = 0;

        for (SubscriptionEnriched sub : sorted) {
            boolean fitsInBudget = (budgetUsed + sub.monthlyCost()) <= monthlyBudget;
            String action;
            String reason;
            double annualSavings = 0;

            if (fitsInBudget) {
                // Keep: value score is high enough and there's budget room
                action = "KEEP";
                reason = keepReason(sub);
                budgetUsed += sub.monthlyCost();
                keepCount++;
            } else if (sub.normScore() < 20 || sub.isDeadWeight()) {
                // Dead weight — cut it entirely
                action = "CUT";
                reason = cutReason(sub);
                annualSavings = Math.round(sub.monthlyCost() * 12 * 100.0) / 100.0;
                cutCount++;
            } else {
                // Some value but over budget — suggest downgrade
                action = "DOWNGRADE";
                reason = downgradeReason(sub);
                // Estimate 30–40% savings from downgrading to a lower tier
                double estimatedDowngradeCost = Math.round(sub.monthlyCost() * 0.65 * 100.0) / 100.0;
                annualSavings = Math.round((sub.monthlyCost() - estimatedDowngradeCost) * 12 * 100.0) / 100.0;
                downgradeCount++;
            }

            recommendations.add(new SubRecommendation(
                    sub.id(), sub.name(), sub.icon(),
                    sub.monthlyCost(), sub.valueScore(), sub.normScore(), sub.grade(),
                    action, reason, annualSavings
            ));
        }

        // Re-sort output: KEEP first, then DOWNGRADE, then CUT; within each group by normScore desc
        recommendations.sort(Comparator
                .comparingInt((SubRecommendation r) -> actionOrder(r.action()))
                .thenComparingInt(SubRecommendation::normScore).reversed());

        double projectedSpend = budgetUsed;
        double monthlySavings = Math.round((currentSpend - projectedSpend) * 100.0) / 100.0;
        double annualSavings  = Math.round(monthlySavings * 12 * 100.0) / 100.0;

        return new OptimizationPlan(
                Math.round(currentSpend  * 100.0) / 100.0,
                Math.round(projectedSpend * 100.0) / 100.0,
                monthlyBudget,
                Math.max(0, monthlySavings),
                Math.max(0, annualSavings),
                keepCount, cutCount, downgradeCount,
                recommendations
        );
    }

    private int actionOrder(String action) {
        return switch (action) {
            case "KEEP"      -> 0;
            case "DOWNGRADE" -> 1;
            case "CUT"       -> 2;
            default          -> 3;
        };
    }

    private String keepReason(SubscriptionEnriched sub) {
        if (sub.normScore() >= 80) return "Excellent value — one of your top-performing subscriptions.";
        if (sub.normScore() >= 60) return "Good value-to-cost ratio. Worth keeping.";
        return "Fits within budget and provides moderate value.";
    }

    private String cutReason(SubscriptionEnriched sub) {
        if (sub.isDeadWeight()) return "Zero usage in the last 30 days — you won't miss it.";
        if (sub.normScore() < 20) return "Near-zero value score. Budget is better spent elsewhere.";
        return "Over budget with low value — best candidate to cancel.";
    }

    private String downgradeReason(SubscriptionEnriched sub) {
        if (sub.normScore() >= 60)
            return "Good value but pushes you over budget. Consider a lower tier to keep access.";
        return "Moderate value — switch to a cheaper plan or free tier to stay within budget.";
    }
}
