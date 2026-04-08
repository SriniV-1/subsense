package com.subsense.service;

import com.subsense.dto.BenchmarkResult;
import com.subsense.dto.SubscriptionEnriched;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Peer benchmarking: compares the user's per-category spending against
 * simulated peer distributions derived from real-world survey data.
 *
 * Peer data is hardcoded per category (median college-age / young-professional
 * subscriber in the US, 2024).  All values are monthly spend in USD.
 */
@Service
public class BenchmarkService {

    // category → { avgSpend, medianSpend, p25, p75, p90 }
    private record PeerStats(double avg, double median, double p25, double p75, double p90) {}

    private static final Map<String, PeerStats> PEER_DATA = Map.ofEntries(
        Map.entry("Entertainment", new PeerStats(28.50, 22.00, 13.99, 35.00, 55.00)),
        Map.entry("Music",         new PeerStats(10.99, 10.99,  9.99, 10.99, 16.00)),
        Map.entry("AI Tools",      new PeerStats(12.00,  0.00,  0.00, 20.00, 40.00)),
        Map.entry("Dev Tools",     new PeerStats( 8.50,  0.00,  0.00, 10.00, 25.00)),
        Map.entry("Productivity",  new PeerStats( 9.00,  8.00,  0.00, 16.00, 30.00)),
        Map.entry("Creative",      new PeerStats(18.00, 12.99,  0.00, 40.00, 67.00)),
        Map.entry("Professional",  new PeerStats(14.00,  0.00,  0.00, 29.99, 49.99)),
        Map.entry("Fitness",       new PeerStats(11.00,  9.99,  0.00, 15.00, 39.00)),
        Map.entry("Wellness",      new PeerStats( 7.50,  0.00,  0.00,  9.99, 19.99)),
        Map.entry("Storage",       new PeerStats( 5.00,  2.99,  0.00,  9.99, 19.99)),
        Map.entry("Education",     new PeerStats( 8.00,  6.99,  0.00, 13.00, 29.99)),
        Map.entry("Security",      new PeerStats( 5.00,  0.00,  0.00,  9.99, 15.00))
    );

    /**
     * Produce one BenchmarkResult per category that the user subscribes to.
     * Results are sorted by userMonthlySpend descending (worst offenders first).
     */
    public List<BenchmarkResult> benchmark(List<SubscriptionEnriched> enriched) {
        // Group by category
        Map<String, List<SubscriptionEnriched>> byCategory = new LinkedHashMap<>();
        for (SubscriptionEnriched e : enriched) {
            byCategory.computeIfAbsent(e.category(), k -> new ArrayList<>()).add(e);
        }

        List<BenchmarkResult> results = new ArrayList<>();
        for (var entry : byCategory.entrySet()) {
            String category = entry.getKey();
            List<SubscriptionEnriched> subs = entry.getValue();

            double userSpend = subs.stream().mapToDouble(SubscriptionEnriched::monthlyCost).sum();
            userSpend = Math.round(userSpend * 100.0) / 100.0;

            PeerStats peers = PEER_DATA.getOrDefault(category,
                    new PeerStats(userSpend * 0.7, userSpend * 0.6, 0, userSpend * 0.9, userSpend * 1.3));

            int percentile = estimatePercentile(userSpend, peers);
            String status  = statusLabel(userSpend, peers);
            String insight = buildInsight(category, userSpend, peers, subs.size(), status);

            results.add(new BenchmarkResult(
                    category,
                    subs.size(),
                    userSpend,
                    peers.avg(),
                    peers.median(),
                    percentile,
                    status,
                    insight
            ));
        }

        results.sort(Comparator.comparingDouble(BenchmarkResult::userMonthlySpend).reversed());
        return results;
    }

    /**
     * Estimate percentile using piecewise linear interpolation over the
     * five known peer distribution points: 0%, 25%, 50%, 75%, 90%.
     */
    private int estimatePercentile(double userSpend, PeerStats p) {
        // Anchor points: (spend, percentile)
        double[][] anchors = {
            { 0.0,    1  },
            { p.p25(), 25 },
            { p.median(), 50 },
            { p.p75(), 75 },
            { p.p90(), 90 },
            { p.p90() * 1.5, 99 }
        };

        for (int i = 0; i < anchors.length - 1; i++) {
            double lo = anchors[i][0], hi = anchors[i + 1][0];
            double pLo = anchors[i][1], pHi = anchors[i + 1][1];
            if (userSpend <= hi) {
                if (hi == lo) return (int) pLo;
                double t = (userSpend - lo) / (hi - lo);
                return (int) Math.round(pLo + t * (pHi - pLo));
            }
        }
        return 99;
    }

    private String statusLabel(double userSpend, PeerStats p) {
        if (userSpend <= p.median())        return "UNDER";
        if (userSpend <= p.avg())           return "AT";
        if (userSpend <= p.p90())           return "OVER";
        return "WELL_OVER";
    }

    private String buildInsight(String category, double userSpend,
                                PeerStats peers, int subCount, String status) {
        String diff = String.format("$%.0f", Math.abs(userSpend - peers.median()));
        return switch (status) {
            case "UNDER" -> String.format(
                    "You spend %s less than the typical %s subscriber — well optimized.", diff, category);
            case "AT" -> String.format(
                    "Your %s spend is right around the average for your peer group.", category);
            case "OVER" -> String.format(
                    "You're spending %s/mo more than the median %s subscriber. Consider consolidating your %d subscription%s.",
                    diff, category, subCount, subCount > 1 ? "s" : "");
            case "WELL_OVER" -> String.format(
                    "You're in the top 10%% of %s spenders — %s above the median. High overlap risk with %d subscription%s.",
                    category, diff, subCount, subCount > 1 ? "s" : "");
            default -> "No peer data available for this category.";
        };
    }
}
