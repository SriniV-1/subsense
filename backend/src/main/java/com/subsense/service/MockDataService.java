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
 * Generates synthetic subscription + usage data for 20 subscriptions.
 * Designed to surface all alert types for demo purposes:
 *   - 6 dead-weight subscriptions (zero usage)
 *   - 4 sentinel alerts (renewal ≤ 2 days + usage drop ≥ 50%)
 *   - 2 binge-and-abandon subscriptions
 *   - 1 chronic-low-usage subscription
 *   - Multiple category overlaps (Entertainment x6, AI Tools x2, etc.)
 *   - Budget overflow ($330+/mo against $150 budget)
 */
@Service
public class MockDataService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final Random RNG = new Random(42);

    private final List<Subscription> subscriptions;
    private final List<SwapOption>   swapOptions;
    private final UserProfile        userProfile;

    public MockDataService() {
        this.userProfile = new UserProfile(
                "Alex Chen", "alex@devsws.io", "AC",
                300.0,   // monthlyBudget
                15.0,    // alertThresholdCPH
                50       // sentinelDropThreshold
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

    // ── Public API ─────────────────────────────────────────────────────────────

    public List<Subscription> getSubscriptions() { return subscriptions; }

    public Subscription getSubscription(String id) {
        return subscriptions.stream().filter(s -> s.id().equals(id)).findFirst().orElse(null);
    }

    public List<SwapOption>  getSwapOptions()  { return swapOptions; }
    public UserProfile       getUserProfile()  { return userProfile; }

    // ── Catalog ────────────────────────────────────────────────────────────────

    private record CatalogEntry(
            String id, String name, String category, double monthlyCost,
            String accentColor, String bgGradient, String icon, String tier,
            int renewalOffset, String usagePattern, int avgMinutes
    ) {}

    private List<Subscription> buildSubscriptions() {
        List<CatalogEntry> catalog = List.of(

            // ── Streaming / Entertainment (6 subs — heavy overlap alert) ──────
            new CatalogEntry("netflix",  "Netflix",        "Entertainment", 15.49,
                    "#E50914", "from-red-900/30 to-slate-900",    "🎬", "Standard",     3,  "binge",        95),
            new CatalogEntry("disney",   "Disney+",        "Entertainment", 13.99,
                    "#0063E5", "from-blue-900/30 to-slate-900",   "✨", "Basic",         1,  "ghost",         0),
            new CatalogEntry("hulu",     "Hulu",           "Entertainment", 17.99,
                    "#3DBB3D", "from-lime-900/30 to-slate-900",   "📺", "No Ads",        2,  "ghost",         0),
            new CatalogEntry("prime",    "Amazon Prime",   "Entertainment",  8.99,
                    "#FF9900", "from-amber-900/30 to-slate-900",  "📦", "Video",         5,  "daily",        60),
            new CatalogEntry("appletv",  "Apple TV+",      "Entertainment",  9.99,
                    "#555555", "from-gray-900/30 to-slate-900",   "🍎", "Standard",      1,  "ghost",         0),
            new CatalogEntry("youtube",  "YouTube Premium","Entertainment", 13.99,
                    "#FF0000", "from-red-800/30 to-slate-900",    "▶️", "Individual",   14,  "daily",       130),

            // ── Music ─────────────────────────────────────────────────────────
            new CatalogEntry("spotify",  "Spotify",        "Music",         10.99,
                    "#1DB954", "from-green-900/30 to-slate-900",  "🎵", "Premium",       7,  "daily",        80),

            // ── AI Tools (2 subs — overlap alert) ─────────────────────────────
            new CatalogEntry("chatgpt",  "ChatGPT Plus",   "AI Tools",      20.00,
                    "#10A37F", "from-emerald-900/30 to-slate-900","🤖", "Plus",         12,  "daily",        55),
            new CatalogEntry("claudepro","Claude Pro",     "AI Tools",      20.00,
                    "#D97706", "from-amber-800/30 to-slate-900",  "⚡", "Pro",          20,  "daily",        70),

            // ── Dev Tools ─────────────────────────────────────────────────────
            new CatalogEntry("github",   "GitHub Copilot", "Dev Tools",     10.00,
                    "#6e40c9", "from-purple-900/30 to-slate-900", "👾", "Individual",  18, "weekend",       110),

            // ── Productivity (2 subs — overlap alert) ─────────────────────────
            new CatalogEntry("notion",   "Notion",         "Productivity",   8.00,
                    "#333333", "from-slate-700/30 to-slate-900",  "📝", "Plus",         22,  "daily",        40),
            new CatalogEntry("grammarly","Grammarly",      "Productivity",  12.00,
                    "#15C39A", "from-teal-900/30 to-slate-900",   "✍️", "Premium",       9,  "daily",        30),

            // ── Creative (2 subs — overlap alert) ────────────────────────────
            new CatalogEntry("adobe",    "Adobe CC",       "Creative",      54.99,
                    "#FF0000", "from-orange-900/30 to-slate-900", "🎨", "All Apps",     30, "weekend",       70),
            new CatalogEntry("canva",    "Canva Pro",      "Creative",      12.99,
                    "#00C4CC", "from-cyan-900/30 to-slate-900",   "🖌️", "Pro",          28, "weekend",       80),

            // ── Professional (dead weight — high cost) ─────────────────────────
            new CatalogEntry("linkedin", "LinkedIn Premium","Professional", 39.99,
                    "#0077B5", "from-blue-900/30 to-slate-900",   "💼", "Career",        8,  "ghost",         0),

            // ── Fitness (binge-abandon) ────────────────────────────────────────
            new CatalogEntry("peloton",  "Peloton Digital","Fitness",       12.99,
                    "#E62440", "from-rose-900/30 to-slate-900",   "🚴", "App",          11, "bingeAbandon",  90),

            // ── Wellness (ghost — dead weight, sentinel) ──────────────────────
            new CatalogEntry("calm",     "Calm",           "Wellness",       9.99,
                    "#4A90D9", "from-sky-900/30 to-slate-900",    "🧘", "Premium",       2,  "ghost",         0),

            // ── Storage (chronic low usage) ────────────────────────────────────
            new CatalogEntry("dropbox",  "Dropbox Plus",   "Storage",       11.99,
                    "#0061FF", "from-blue-900/30 to-slate-900",   "📁", "Plus",         17,  "daily",         4),

            // ── Education (binge-abandon) ──────────────────────────────────────
            new CatalogEntry("duolingo", "Duolingo Plus",  "Education",      6.99,
                    "#58CC02", "from-green-800/30 to-slate-900",  "🦜", "Plus",         25, "bingeAbandon",  45),

            // ── Security (ghost — dead weight) ────────────────────────────────
            new CatalogEntry("expressvpn","ExpressVPN",    "Security",       8.32,
                    "#DA1E28", "from-red-900/30 to-slate-900",    "🔒", "Annual/12",     6,  "ghost",         0)
        );

        List<Subscription> result = new ArrayList<>();
        for (CatalogEntry e : catalog) {
            List<UsageLog> logs = buildLogs(e.usagePattern(), e.avgMinutes());
            int totalMinutes = logs.stream().mapToInt(UsageLog::minutes).sum();
            String renewalDate = LocalDate.now().plusDays(e.renewalOffset()).format(DATE_FMT);
            result.add(new Subscription(
                    e.id(), e.name(), e.category(), e.monthlyCost(),
                    e.accentColor(), e.bgGradient(), e.icon(), e.tier(),
                    renewalDate, e.usagePattern(), logs, totalMinutes
            ));
        }
        return result;
    }

    // ── Usage pattern generators ──────────────────────────────────────────────

    private List<UsageLog> buildLogs(String pattern, int avgMinutes) {
        return switch (pattern) {
            case "binge"        -> generateBinge(30, avgMinutes > 0 ? avgMinutes : 90);
            case "ghost"        -> generateGhost(30);
            case "weekend"      -> generateWeekend(30, avgMinutes > 0 ? avgMinutes : 80);
            case "bingeAbandon" -> generateBingeAbandon(30, avgMinutes > 0 ? avgMinutes : 75);
            default             -> generateDaily(30, avgMinutes > 0 ? avgMinutes : 45);
        };
    }

    /** Steady daily usage with random variance and occasional skip days. */
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
            boolean isWeekend = d.getDayOfWeek().getValue() >= 6;
            int minutes = isWeekend ? (int) Math.round(avg * (0.6 + RNG.nextDouble() * 0.8)) : 0;
            logs.add(new UsageLog(d.format(DATE_FMT), minutes));
        }
        return logs;
    }

    /**
     * Binge-and-abandon: heavy usage in the first half of the window,
     * near-zero in the second half (New Year's-resolution pattern).
     */
    private List<UsageLog> generateBingeAbandon(int days, int peak) {
        List<UsageLog> logs = new ArrayList<>();
        int abandonAfter = days / 2; // go cold after the midpoint
        for (int i = days - 1; i >= 0; i--) {
            String date = LocalDate.now().minusDays(i).format(DATE_FMT);
            int minutes;
            if (i > abandonAfter) {
                // Active phase
                minutes = RNG.nextDouble() < 0.15
                        ? 0
                        : (int) Math.round(peak * (0.6 + RNG.nextDouble() * 0.8));
            } else {
                // Abandoned phase
                minutes = RNG.nextDouble() < 0.05 ? (int) (5 + RNG.nextDouble() * 10) : 0;
            }
            logs.add(new UsageLog(date, Math.max(0, minutes)));
        }
        return logs;
    }
}
