package com.subsense.service;

import com.subsense.dto.ForecastResult;
import com.subsense.model.Subscription;
import com.subsense.model.UsageLog;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Linear-regression usage forecasting for each subscription.
 * Uses last 30 days of usage logs to compute slope, intercept, R², and
 * project 30 days into the future.
 */
@Service
public class ForecastingService {

    /**
     * Compute forecast for every subscription.
     * Results are sorted: DYING first, then DECLINING, STABLE, GROWING.
     */
    public List<ForecastResult> forecast(List<Subscription> subscriptions) {
        List<ForecastResult> results = new ArrayList<>();
        for (Subscription sub : subscriptions) {
            results.add(forecastOne(sub));
        }
        // Sort: worst trend first
        results.sort((a, b) -> trendOrder(a.trendLabel()) - trendOrder(b.trendLabel()));
        return results;
    }

    private int trendOrder(String label) {
        return switch (label) {
            case "DYING"     -> 0;
            case "DECLINING" -> 1;
            case "STABLE"    -> 2;
            case "GROWING"   -> 3;
            default          -> 4;
        };
    }

    private ForecastResult forecastOne(Subscription sub) {
        List<UsageLog> logs = sub.usageLogs();
        int n = Math.min(30, logs.size());
        if (n < 3) {
            // Not enough data — return a stable no-op result
            return new ForecastResult(
                    sub.id(), sub.name(), sub.icon(),
                    0.0, 0.0, 0, -1, 0.0, "STABLE", 0.0
            );
        }

        // Use the last n entries
        List<UsageLog> window = logs.subList(logs.size() - n, logs.size());

        // x = day index 0..n-1, y = minutes
        double[] x = new double[n];
        double[] y = new double[n];
        for (int i = 0; i < n; i++) {
            x[i] = i;
            y[i] = window.get(i).minutes();
        }

        // Least-squares linear regression
        double sumX  = 0, sumY = 0, sumXX = 0, sumXY = 0;
        for (int i = 0; i < n; i++) {
            sumX  += x[i];
            sumY  += y[i];
            sumXX += x[i] * x[i];
            sumXY += x[i] * y[i];
        }
        double slope     = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        double intercept = (sumY - slope * sumX) / n;

        // R² confidence
        double yMean = sumY / n;
        double ssTot = 0, ssRes = 0;
        for (int i = 0; i < n; i++) {
            double predicted = slope * x[i] + intercept;
            ssTot += (y[i] - yMean) * (y[i] - yMean);
            ssRes += (y[i] - predicted) * (y[i] - predicted);
        }
        double r2 = ssTot == 0 ? 1.0 : Math.max(0.0, 1.0 - ssRes / ssTot);
        double confidence = Math.round(r2 * 1000.0) / 1000.0;

        // 7-day trailing average
        int trailingN = Math.min(7, n);
        List<UsageLog> trailing = window.subList(window.size() - trailingN, window.size());
        double currentAvg = trailing.stream().mapToInt(UsageLog::minutes).average().orElse(0);
        currentAvg = Math.round(currentAvg * 10.0) / 10.0;

        // Projected value 30 days from now (day index = n - 1 + 30)
        double projected30 = slope * (n - 1 + 30) + intercept;
        int projectedMinutes30d = (int) Math.max(0, Math.round(projected30));

        // Days until projected usage hits 0 (only meaningful if slope < 0)
        int daysUntilDead = -1;
        if (slope < 0 && intercept > 0) {
            // 0 = slope * dayIndex + intercept  =>  dayIndex = -intercept / slope
            double zeroDay = -intercept / slope;
            // zeroDay is absolute index; days from now = zeroDay - (n-1)
            int daysFromNow = (int) Math.ceil(zeroDay - (n - 1));
            daysUntilDead = daysFromNow > 0 ? daysFromNow : 0;
        }

        // % change from current avg to 30-day projection
        double percentChange30d = 0.0;
        if (currentAvg > 0) {
            percentChange30d = Math.round(((projectedMinutes30d - currentAvg) / currentAvg) * 10000.0) / 100.0;
        }

        // Trend label based on slope (minutes/day)
        String trendLabel;
        if      (slope >=  2.0) trendLabel = "GROWING";
        else if (slope >= -0.5) trendLabel = "STABLE";
        else if (slope >= -3.0) trendLabel = "DECLINING";
        else                    trendLabel = "DYING";

        return new ForecastResult(
                sub.id(), sub.name(), sub.icon(),
                currentAvg, Math.round(slope * 1000.0) / 1000.0,
                projectedMinutes30d, daysUntilDead, confidence,
                trendLabel, percentChange30d
        );
    }
}
