package com.subsense.service;

import com.subsense.model.Subscription;
import com.subsense.model.SwapOption;
import com.subsense.model.UsageLog;
import com.subsense.model.UserProfile;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Generates synthetic subscription + usage data.
 * Java port of src/data/mockData.js + src/data/generateUsage.js.
 *
 * Data is generated once at startup and held in memory.
 * Replace with a real repository layer when connecting a database.
 */
@Service
public class MockDataService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final Random RNG = new Random(42); // fixed seed for reproducible demo data

    private final List<Subscription> subscriptions;
    private final List<SwapOption> swapOptions;
    private final UserProfile userProfile;

    public MockDataService() {
        this.userProfile = new UserProfile(
                "Alex Chen",
                "alex@devsws.io",
                "AC",
                150.0,
                15.0,  // alertThresholdCPH
                50     // sentinelDropThreshold
        );

        this.swapOptions = List.of(
                new SwapOption("bus",     "Campus Bus Pass",  5.00,  "🚌", "Transport"),
                new SwapOption("coffee",  "Premium Coffee",   6.50,  "☕", "Food"),
                new SwapOption("audible", "Audible Credit",   14.95, "🎧", "Education"),
                new SwapOption("gym",     "Day Gym Pass",     10.00, "💪", "Health"),
                new SwapOption("kindle",  "Kindle eBook",     9.99,  "📚", "Education"),
                new SwapOption("lunch",   "Campus Lunch",     8.00,  "🥗", "Food")
        );

        this.subscriptions = buildSubscriptions();
    }

    public List<Subscription> getSubscriptions() {
        return subscriptions;
    }

    public Subscription getSubscription(String id) {
        return subscriptions.stream()
                .filter(s -> s.id().equals(id))
                .findFirst()
                .orElse(null);
    }

    public List<SwapOption> getSwapOptions() {
        return swapOptions;
    }

    public UserProfile getUserProfile() {
        return userProfile;
    }

    // ── Catalog definition ────────────────────────────────────────────────────

    private record CatalogEntry(
            String id, String name, String category, double monthlyCost,
            String accentColor, String bgGradient, String icon, String tier,
            int renewalOffset, String usagePattern, int avgMinutes
    ) {}

    private List<Subscription> buildSubscriptions() {
        List<CatalogEntry> catalog = List.of(
                new CatalogEntry("netflix",  "Netflix",         "Entertainment", 15.49,
                        "#E50914", "from-red-900/30 to-slate-900",    "🎬", "Standard",    3,  "binge",   95),
                new CatalogEntry("spotify",  "Spotify",         "Music",         10.99,
                        "#1DB954", "from-green-900/30 to-slate-900",  "🎵", "Premium",     7,  "daily",   80),
                new CatalogEntry("chatgpt",  "ChatGPT Plus",    "AI Tools",      20.00,
                        "#10A37F", "from-emerald-900/30 to-slate-900","🤖", "Plus",       12,  "daily",   55),
                new CatalogEntry("disney",   "Disney+",         "Entertainment", 13.99,
                        "#0063E5", "from-blue-900/30 to-slate-900",   "✨", "Basic",       1,  "ghost",    0),
                new CatalogEntry("github",   "GitHub Copilot",  "Dev Tools",     10.00,
                        "#6e40c9", "from-purple-900/30 to-slate-900", "👾", "Individual", 18, "weekend", 110),
                new CatalogEntry("notion",   "Notion",          "Productivity",   8.00,
                        "#ffffff", "from-slate-700/30 to-slate-900",  "📝", "Plus",       22,  "daily",   40),
                new CatalogEntry("hulu",     "Hulu",            "Entertainment", 17.99,
                        "#3DBB3D", "from-lime-900/30 to-slate-900",   "📺", "No Ads",      2,  "ghost",    0),
                new CatalogEntry("adobe",    "Adobe CC",        "Creative",      54.99,
                        "#FF0000", "from-orange-900/30 to-slate-900", "🎨", "All Apps",   30, "weekend",  70)
        );

        List<Subscription> result = new ArrayList<>();
        for (CatalogEntry entry : catalog) {
            List<UsageLog> logs = buildLogs(entry.usagePattern(), entry.avgMinutes());
            int totalMinutes = logs.stream().mapToInt(UsageLog::minutes).sum();
            String renewalDate = LocalDate.now().plusDays(entry.renewalOffset()).format(DATE_FMT);

            result.add(new Subscription(
                    entry.id(), entry.name(), entry.category(), entry.monthlyCost(),
                    entry.accentColor(), entry.bgGradient(), entry.icon(), entry.tier(),
                    renewalDate, entry.usagePattern(), logs, totalMinutes
            ));
        }
        return result;
    }

    // ── Usage pattern generators ──────────────────────────────────────────────

    private List<UsageLog> buildLogs(String pattern, int avgMinutes) {
        return switch (pattern) {
            case "binge"   -> generateBinge(30, avgMinutes > 0 ? avgMinutes : 90);
            case "ghost"   -> generateGhost(30);
            case "weekend" -> generateWeekend(30, avgMinutes > 0 ? avgMinutes : 80);
            default        -> generateDaily(30, avgMinutes > 0 ? avgMinutes : 45);
        };
    }

    /** Steady daily usage with random variance and skip days. */
    private List<UsageLog> generateDaily(int days, int avg) {
        List<UsageLog> logs = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            String date = LocalDate.now().minusDays(i).format(DATE_FMT);
            if (RNG.nextDouble() < 0.2) {
                logs.add(new UsageLog(date, 0));
            } else {
                double u = RNG.nextDouble() + RNG.nextDouble() + RNG.nextDouble() - 1.5;
                int minutes = Math.max(0, (int) Math.round(avg + u * avg * 0.5));
                logs.add(new UsageLog(date, minutes));
            }
        }
        return logs;
    }

    /** Heavy use early in the period, decays toward the present. */
    private List<UsageLog> generateBinge(int days, int peak) {
        List<UsageLog> logs = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            String date = LocalDate.now().minusDays(i).format(DATE_FMT);
            double decayFactor = Math.pow((double) i / days, 0.8);
            int minutes = RNG.nextDouble() < 0.3
                    ? 0
                    : (int) Math.round(peak * decayFactor * (0.7 + RNG.nextDouble() * 0.6));
            logs.add(new UsageLog(date, Math.max(0, minutes)));
        }
        return logs;
    }

    /** Near-zero usage — 5% chance of any activity per day. */
    private List<UsageLog> generateGhost(int days) {
        List<UsageLog> logs = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            String date = LocalDate.now().minusDays(i).format(DATE_FMT);
            int minutes = RNG.nextDouble() < 0.05 ? (int) (10 + RNG.nextDouble() * 20) : 0;
            logs.add(new UsageLog(date, minutes));
        }
        return logs;
    }

    /** Active only on Sat/Sun. */
    private List<UsageLog> generateWeekend(int days, int avg) {
        List<UsageLog> logs = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate d = LocalDate.now().minusDays(i);
            String date = d.format(DATE_FMT);
            boolean isWeekend = d.getDayOfWeek().getValue() >= 6; // SAT=6, SUN=7
            int minutes = isWeekend ? (int) Math.round(avg * (0.6 + RNG.nextDouble() * 0.8)) : 0;
            logs.add(new UsageLog(date, minutes));
        }
        return logs;
    }
}
