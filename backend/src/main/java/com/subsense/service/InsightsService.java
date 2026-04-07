package com.subsense.service;

import com.subsense.dto.PortfolioAlert;
import com.subsense.dto.SubscriptionRecommendation;
import com.subsense.model.Subscription;
import com.subsense.model.UserProfile;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Computes portfolio-level insights and per-subscription recommendations.
 * This is the authoritative business logic layer — replaces the useMemo
 * computations previously done in AISentinel.jsx.
 */
@Service
public class InsightsService {

    private final MockDataService   mockData;
    private final AnalyticsService  analytics;

    public InsightsService(MockDataService mockData, AnalyticsService analytics) {
        this.mockData  = mockData;
        this.analytics = analytics;
    }

    // ── Portfolio alerts ──────────────────────────────────────────────────────

    public List<PortfolioAlert> computeAlerts() {
        List<PortfolioAlert> alerts = new ArrayList<>();
        List<Subscription> subs = mockData.getSubscriptions();
        UserProfile profile = mockData.getUserProfile();

        // 1. Budget overflow
        if (analytics.isBudgetOverflow(subs, profile.monthlyBudget())) {
            double total = analytics.totalMonthlySpend(subs);
            double over  = total - profile.monthlyBudget();
            alerts.add(new PortfolioAlert(
                    "budget",
                    "budget",
                    "high",
                    String.format("Over Budget by $%.2f/mo", over),
                    String.format(
                            "Your %d subscriptions total $%.2f/mo against a $%.0f budget. " +
                            "That's $%.0f wasted annually. Cancel or snooze to get back on track.",
                            subs.size(), total, profile.monthlyBudget(), over * 12),
                    subs.stream().map(Subscription::id).collect(Collectors.toList())
            ));
        }

        // 2. Category overlap — flag every category with 2+ subscriptions
        Map<String, List<Subscription>> overlapping = analytics.findCategoryOverlap(subs);
        for (var entry : overlapping.entrySet()) {
            String category = entry.getKey();
            List<Subscription> group = entry.getValue();
            double groupCost = group.stream().mapToDouble(Subscription::monthlyCost).sum();
            List<String> names = group.stream().map(Subscription::name).collect(Collectors.toList());
            List<String> ids   = group.stream().map(Subscription::id).collect(Collectors.toList());
            alerts.add(new PortfolioAlert(
                    "overlap-" + category.toLowerCase().replace(" ", "-"),
                    "overlap",
                    group.size() >= 4 ? "high" : "medium",
                    String.format("%d %s subscriptions — $%.2f/mo", group.size(), category, groupCost),
                    String.format(
                            "%s all overlap in the %s category. " +
                            "You're spending $%.2f/mo ($%.0f/yr) on content you likely can't consume fully.",
                            String.join(", ", names), category, groupCost, groupCost * 12),
                    ids
            ));
        }

        // 3. Binge-and-abandon — per subscription
        for (Subscription s : subs) {
            if (analytics.isBingeAndAbandon(s.usageLogs())) {
                alerts.add(new PortfolioAlert(
                        "binge-" + s.id(),
                        "binge_abandon",
                        "medium",
                        s.name() + ": Binge & Abandon Pattern",
                        String.format(
                                "%s was used heavily earlier but has gone cold. " +
                                "You're paying $%.2f/mo for something you've stopped opening.",
                                s.name(), s.monthlyCost()),
                        List.of(s.id())
                ));
            }
        }

        // 4. Chronic low usage
        for (Subscription s : subs) {
            if (analytics.hasChronicLowUsage(s.usageLogs(), 8.0)) {
                alerts.add(new PortfolioAlert(
                        "chronic-" + s.id(),
                        "chronic_low",
                        "low",
                        s.name() + ": Consistently Low Usage",
                        String.format(
                                "%s averages under 8 min/day all month. " +
                                "At $%.2f/mo you're paying for a habit you haven't built.",
                                s.name(), s.monthlyCost()),
                        List.of(s.id())
                ));
            }
        }

        // 5. High CPH not covered by sentinel (renewal > 2 days away)
        for (Subscription s : subs) {
            boolean alreadySentinel = analytics.sentinelShouldAlert(
                    s.renewalDate(), s.usageLogs(), profile.sentinelDropThreshold());
            if (!alreadySentinel
                    && analytics.shouldSnooze(s.monthlyCost(), s.totalMinutes(), profile.alertThresholdCPH())) {
                double cph = analytics.calcCostPerHour(s.monthlyCost(), s.totalMinutes());
                int days   = analytics.daysUntilRenewal(s.renewalDate());
                String cphStr = cph < 0 ? "∞" : String.format("$%.2f", cph);
                alerts.add(new PortfolioAlert(
                        "cph-" + s.id(),
                        "high_cph",
                        "low",
                        String.format("%s: High Cost-Per-Hour (%s/hr)", s.name(), cphStr),
                        String.format(
                                "Above your $%.0f/hr threshold. Renews in %d days — watch this one.",
                                profile.alertThresholdCPH(), days),
                        List.of(s.id())
                ));
            }
        }

        return alerts;
    }

    // ── Per-subscription recommendations ─────────────────────────────────────

    public List<SubscriptionRecommendation> computeRecommendations() {
        List<SubscriptionRecommendation> recs = new ArrayList<>();
        List<Subscription> subs = mockData.getSubscriptions();
        UserProfile profile = mockData.getUserProfile();

        for (Subscription s : subs) {
            List<String> actions = new ArrayList<>();
            String priority;
            String primaryReason;

            boolean dead     = analytics.isDeadWeight(s.usageLogs());
            boolean sentinel = analytics.sentinelShouldAlert(s.renewalDate(), s.usageLogs(), profile.sentinelDropThreshold());
            boolean snooze   = analytics.shouldSnooze(s.monthlyCost(), s.totalMinutes(), profile.alertThresholdCPH());
            boolean binge    = analytics.isBingeAndAbandon(s.usageLogs());
            boolean chronic  = analytics.hasChronicLowUsage(s.usageLogs(), 8.0);
            int days         = analytics.daysUntilRenewal(s.renewalDate());

            if (dead && sentinel) {
                priority = "urgent";
                primaryReason = "Zero usage with imminent renewal";
                actions.add(String.format("Cancel immediately — saves $%.2f/mo ($%.0f/yr)", s.monthlyCost(), s.monthlyCost() * 12));
                actions.add("Route saved funds to index investing via Snooze & Invest");
            } else if (dead) {
                priority = "high";
                primaryReason = "No usage in 30 days";
                actions.add(String.format("Cancel to recover $%.2f/mo", s.monthlyCost()));
                actions.add("Renews in " + days + " days — act before the charge hits");
            } else if (sentinel) {
                priority = "urgent";
                primaryReason = "Usage dropped sharply before renewal";
                actions.add("Cancel before renewal in " + days + (days == 1 ? " day" : " days"));
                actions.add(String.format("Saves $%.2f/mo · $%.0f/yr", s.monthlyCost(), s.monthlyCost() * 12));
            } else if (binge) {
                priority = "high";
                primaryReason = "Binge-and-abandon pattern detected";
                actions.add("You've stopped using this — consider cancelling");
                actions.add(String.format("$%.2f/mo could fund better investments", s.monthlyCost()));
            } else if (snooze) {
                priority = "medium";
                primaryReason = "High cost-per-hour ratio";
                double cph = analytics.calcCostPerHour(s.monthlyCost(), s.totalMinutes());
                actions.add(String.format("Cost/hr is %s — above $%.0f/hr threshold",
                        cph < 0 ? "∞" : "$" + String.format("%.2f", cph), profile.alertThresholdCPH()));
                actions.add("Pause for 30 days and reassess usage");
            } else if (chronic) {
                priority = "low";
                primaryReason = "Chronic low usage";
                actions.add("Barely used daily — check if you still need this");
                actions.add("Consider a cheaper free tier");
            } else {
                continue; // healthy subscription — skip
            }

            recs.add(new SubscriptionRecommendation(
                    s.id(), s.name(), s.icon(), s.monthlyCost(),
                    priority, actions, primaryReason
            ));
        }

        // Sort: urgent → high → medium → low
        recs.sort(Comparator.comparingInt(r -> switch (r.priority()) {
            case "urgent" -> 0;
            case "high"   -> 1;
            case "medium" -> 2;
            default       -> 3;
        }));

        return recs;
    }
}
