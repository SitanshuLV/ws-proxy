<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// SEND PERFORMANCE MONITORING
// Retrieve sends, aggregate tracking, calculate KPIs, store metrics
// ============================================================

// ------ MAIN WORKFLOW ------
/**
 * Monitors send performance and tracks KPIs
 * Steps:
 * 1. Retrieve recent sends
 * 2. Aggregate tracking events (sent, open, click, bounce)
 * 3. Calculate KPIs (open rate, click rate, bounce rate, etc.)
 * 4. Compare against historical benchmarks
 * 5. Identify anomalies
 * 6. Store metrics to tracking DE
 * 7. Generate performance report
 */
function monitorSendPerformance(config) {
    // config = {
    //   days: 7,
    //   emailID: null,
    //   sendDefinitionID: null,
    //   metricsDeKey: "send_performance_metrics_de",
    //   benchmarkDeKey: "performance_benchmarks_de",
    //   anomalyThreshold: 20,  // % deviation from benchmark
    //   minSendSize: 100
    // }

    var monitoring = {
        success: false,
        steps: [],
        errors: [],
        status: "STARTED",
        sendsMonitored: 0,
        totalRecipients: 0,
        metrics: [],
        anomalies: [],
        performance: {
            overallOpenRate: 0,
            overallClickRate: 0,
            overallBounceRate: 0,
            bestPerformer: null,
            worstPerformer: null
        },
        report: null
    };

    try {
        // Step 1: Retrieve recent sends
        monitoring.steps.push("Retrieving sends from last " + config.days + " days...");
        var sendsRes = getRecentSends(config.days, config.emailID, config.sendDefinitionID);

        if (!sendsRes.success || sendsRes.sends.length === 0) {
            monitoring.errors.push("No sends found: " + (sendsRes.error || "Empty result"));
            monitoring.status = "NO_DATA";
            return monitoring;
        }

        monitoring.sendsMonitored = sendsRes.sends.length;
        monitoring.steps.push("✓ Found " + monitoring.sendsMonitored + " sends");

        // Step 2 & 3: Aggregate tracking and calculate KPIs
        monitoring.steps.push("Aggregating metrics and calculating KPIs...");
        var metricsRes = aggregateSendMetrics(sendsRes.sends, config.minSendSize);

        if (!metricsRes.success) {
            monitoring.errors.push("Metrics aggregation failed: " + metricsRes.error);
            monitoring.status = "FAILED_AT_AGGREGATION";
            return monitoring;
        }

        monitoring.metrics = metricsRes.sendMetrics;
        monitoring.totalRecipients = metricsRes.totalRecipients;
        monitoring.performance = metricsRes.aggregateMetrics;
        monitoring.steps.push("✓ Calculated KPIs for " + monitoring.metrics.length + " valid sends");

        // Step 4: Compare against benchmarks
        monitoring.steps.push("Comparing against benchmarks...");
        var benchRes = compareAgainstBenchmarks(
            monitoring.metrics,
            config.benchmarkDeKey,
            config.anomalyThreshold
        );

        if (benchRes.anomalies.length > 0) {
            monitoring.anomalies = benchRes.anomalies;
            monitoring.steps.push("⚠ Found " + benchRes.anomalies.length + " performance anomalies");
        } else {
            monitoring.steps.push("✓ All sends performing within normal range");
        }

        // Step 5: Store metrics to DE
        monitoring.steps.push("Storing metrics to tracking DE...");
        var storeRes = storePerformanceMetrics(
            monitoring.metrics,
            monitoring.performance,
            config.metricsDeKey
        );

        if (!storeRes.success) {
            monitoring.errors.push("Failed to store metrics: " + storeRes.error);
            monitoring.status = "WARNING_STORAGE";
        } else {
            monitoring.steps.push("✓ Stored " + storeRes.recordsStored + " metric records");
        }

        // Step 6: Generate report
        monitoring.steps.push("Generating performance report...");
        monitoring.report = generatePerformanceReport(
            monitoring.metrics,
            monitoring.performance,
            monitoring.anomalies,
            config.days
        );
        monitoring.steps.push("✓ Report generated");

        // Step 7: Log summary
        logPerformanceSummary(monitoring.performance, monitoring.anomalies);

        monitoring.success = true;
        monitoring.status = "COMPLETE";
        return monitoring;

    } catch (e) {
        monitoring.errors.push("Unexpected error: " + Stringify(e));
        monitoring.status = "FAILED_EXCEPTION";
        return monitoring;
    }
}

// ------ SEND RETRIEVAL ------

function getRecentSends(days, emailID, sendDefinitionID) {
    try {
        var daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - days);
        var startDate = daysAgo.toISOString();

        var filter = {
            Property: "CreatedDate",
            SimpleOperator: "greaterThanOrEqual",
            Value: startDate
        };

        if (emailID) {
            filter = {
                LeftOperand: { Property: "Email.ID", SimpleOperator: "equals", Value: emailID },
                LogicalOperator: "AND",
                RightOperand: { Property: "CreatedDate", SimpleOperator: "greaterThanOrEqual", Value: startDate }
            };
        }

        var allSends = [];
        var moreData = true;
        var reqID = null;

        while (moreData) {
            var res = reqID == null
                ? api.retrieve("Send", ["ID", "Email.ID", "Status", "CreatedDate", "SendDate", "FromName"], filter)
                : api.getNextBatch("Send", reqID);

            if (res && res.Status === "OK") {
                for (var i = 0; i < res.Results.length; i++) {
                    allSends.push(res.Results[i]);
                }
                moreData = res.HasMoreRows;
                reqID = res.RequestID;
            } else {
                moreData = false;
            }
        }

        return { success: true, sends: allSends };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ METRICS AGGREGATION ------

function aggregateSendMetrics(sends, minSendSize) {
    try {
        minSendSize = minSendSize || 100;
        var sendMetrics = [];
        var totalSent = 0;
        var totalOpens = 0;
        var totalClicks = 0;
        var totalBounces = 0;
        var totalUnsubscribes = 0;

        for (var s = 0; s < sends.length; s++) {
            var send = sends[s];
            var sendID = send.ID;

            // Get sent count
            var sentRes = api.retrieve("SentEvent", ["EventID"],
                { Property: "SendID", SimpleOperator: "equals", Value: sendID }
            );

            var sentCount = sentRes.Status === "OK" ? sentRes.Results.length : 0;

            // Skip if below minimum threshold
            if (sentCount < minSendSize) {
                continue;
            }

            // Get open count
            var openRes = api.retrieve("OpenEvent", ["EventID"],
                { Property: "SendID", SimpleOperator: "equals", Value: sendID }
            );
            var openCount = openRes.Status === "OK" ? openRes.Results.length : 0;

            // Get click count
            var clickRes = api.retrieve("ClickEvent", ["EventID"],
                { Property: "SendID", SimpleOperator: "equals", Value: sendID }
            );
            var clickCount = clickRes.Status === "OK" ? clickRes.Results.length : 0;

            // Get bounce count
            var bounceRes = api.retrieve("BounceEvent", ["EventID"],
                { Property: "SendID", SimpleOperator: "equals", Value: sendID }
            );
            var bounceCount = bounceRes.Status === "OK" ? bounceRes.Results.length : 0;

            // Get unsubscribe count
            var unsubRes = api.retrieve("UnsubEvent", ["EventID"],
                { Property: "SendID", SimpleOperator: "equals", Value: sendID }
            );
            var unsubCount = unsubRes.Status === "OK" ? unsubRes.Results.length : 0;

            // Calculate rates
            var openRate = sentCount > 0 ? ((openCount / sentCount) * 100).toFixed(2) : 0;
            var clickRate = sentCount > 0 ? ((clickCount / sentCount) * 100).toFixed(2) : 0;
            var bounceRate = sentCount > 0 ? ((bounceCount / sentCount) * 100).toFixed(2) : 0;
            var unsubRate = sentCount > 0 ? ((unsubCount / sentCount) * 100).toFixed(2) : 0;

            // Store metrics
            var metric = {
                SendID: sendID,
                EmailID: send["Email.ID"],
                SentDate: send.SendDate || send.CreatedDate,
                SentCount: sentCount,
                OpenCount: openCount,
                ClickCount: clickCount,
                BounceCount: bounceCount,
                UnsubCount: unsubCount,
                OpenRate: parseFloat(openRate),
                ClickRate: parseFloat(clickRate),
                BounceRate: parseFloat(bounceRate),
                UnsubRate: parseFloat(unsubRate),
                CTR: (parseFloat(clickRate) / parseFloat(openRate)) > 0 ? (parseFloat(clickRate) / parseFloat(openRate)) : 0
            };

            sendMetrics.push(metric);
            totalSent += sentCount;
            totalOpens += openCount;
            totalClicks += clickCount;
            totalBounces += bounceCount;
            totalUnsubscribes += unsubCount;
        }

        var aggregateMetrics = {
            overallOpenRate: totalSent > 0 ? parseFloat(((totalOpens / totalSent) * 100).toFixed(2)) : 0,
            overallClickRate: totalSent > 0 ? parseFloat(((totalClicks / totalSent) * 100).toFixed(2)) : 0,
            overallBounceRate: totalSent > 0 ? parseFloat(((totalBounces / totalSent) * 100).toFixed(2)) : 0,
            overallUnsubRate: totalSent > 0 ? parseFloat(((totalUnsubscribes / totalSent) * 100).toFixed(2)) : 0,
            bestPerformer: getBestPerformer(sendMetrics),
            worstPerformer: getWorstPerformer(sendMetrics)
        };

        return {
            success: true,
            sendMetrics: sendMetrics,
            totalRecipients: totalSent,
            aggregateMetrics: aggregateMetrics
        };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

function getBestPerformer(metrics) {
    if (metrics.length === 0) return null;
    var best = metrics[0];
    for (var i = 1; i < metrics.length; i++) {
        if (metrics[i].OpenRate > best.OpenRate) {
            best = metrics[i];
        }
    }
    return best;
}

function getWorstPerformer(metrics) {
    if (metrics.length === 0) return null;
    var worst = metrics[0];
    for (var i = 1; i < metrics.length; i++) {
        if (metrics[i].OpenRate < worst.OpenRate) {
            worst = metrics[i];
        }
    }
    return worst;
}

// ------ BENCHMARK COMPARISON ------

function compareAgainstBenchmarks(metrics, benchmarkDeKey, anomalyThreshold) {
    try {
        anomalyThreshold = anomalyThreshold || 20;
        var anomalies = [];

        // Retrieve industry benchmarks
        var benchmarks = {
            openRate: 20,
            clickRate: 2.5,
            bounceRate: 2,
            unsubRate: 0.5
        };

        for (var m = 0; m < metrics.length; m++) {
            var metric = metrics[m];
            var deviations = {
                SendID: metric.SendID,
                anomalies: []
            };

            // Check for open rate deviation
            var openDeviation = ((benchmarks.openRate - metric.OpenRate) / benchmarks.openRate * 100);
            if (Math.abs(openDeviation) > anomalyThreshold) {
                deviations.anomalies.push({
                    type: "OpenRate",
                    actual: metric.OpenRate,
                    benchmark: benchmarks.openRate,
                    deviation: openDeviation.toFixed(2) + "%"
                });
            }

            // Check for bounce rate spike
            if (metric.BounceRate > benchmarks.bounceRate * (1 + anomalyThreshold / 100)) {
                deviations.anomalies.push({
                    type: "BounceRate",
                    actual: metric.BounceRate,
                    benchmark: benchmarks.bounceRate,
                    deviation: ((metric.BounceRate - benchmarks.bounceRate) / benchmarks.bounceRate * 100).toFixed(2) + "%"
                });
            }

            // Check for unsub spike
            if (metric.UnsubRate > benchmarks.unsubRate * (1 + anomalyThreshold / 100)) {
                deviations.anomalies.push({
                    type: "UnsubRate",
                    actual: metric.UnsubRate,
                    benchmark: benchmarks.unsubRate,
                    deviation: ((metric.UnsubRate - benchmarks.unsubRate) / benchmarks.unsubRate * 100).toFixed(2) + "%"
                });
            }

            if (deviations.anomalies.length > 0) {
                anomalies.push(deviations);
            }
        }

        return { success: true, anomalies: anomalies };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ METRICS STORAGE ------

function storePerformanceMetrics(metrics, aggregateMetrics, metricsDeKey) {
    try {
        if (!metricsDeKey) {
            return { success: true, recordsStored: 0 };
        }

        var rows = [];
        var timestamp = new Date().toISOString();

        // Store individual send metrics
        for (var m = 0; m < metrics.length; m++) {
            var metric = metrics[m];
            rows.push({
                CustomerKey: metricsDeKey,
                Properties: [
                    { Name: "MetricDate", Value: timestamp },
                    { Name: "SendID", Value: String(metric.SendID) },
                    { Name: "SentCount", Value: String(metric.SentCount) },
                    { Name: "OpenCount", Value: String(metric.OpenCount) },
                    { Name: "ClickCount", Value: String(metric.ClickCount) },
                    { Name: "BounceCount", Value: String(metric.BounceCount) },
                    { Name: "UnsubCount", Value: String(metric.UnsubCount) },
                    { Name: "OpenRate", Value: String(metric.OpenRate) },
                    { Name: "ClickRate", Value: String(metric.ClickRate) },
                    { Name: "BounceRate", Value: String(metric.BounceRate) },
                    { Name: "MetricType", Value: "SEND_PERFORMANCE" }
                ]
            });
        }

        // Store aggregate metrics
        rows.push({
            CustomerKey: metricsDeKey,
            Properties: [
                { Name: "MetricDate", Value: timestamp },
                { Name: "SendID", Value: "AGGREGATE" },
                { Name: "OpenRate", Value: String(aggregateMetrics.overallOpenRate) },
                { Name: "ClickRate", Value: String(aggregateMetrics.overallClickRate) },
                { Name: "BounceRate", Value: String(aggregateMetrics.overallBounceRate) },
                { Name: "MetricType", Value: "AGGREGATE" }
            ]
        });

        // Batch store
        var totalStored = 0;
        for (var i = 0; i < rows.length; i += 2000) {
            var chunk = rows.slice(i, Math.min(i + 2000, rows.length));
            var res = api.createBatch("DataExtensionObject", chunk);
            if (res.Status === "OK") {
                totalStored += chunk.length;
            }
        }

        return { success: true, recordsStored: totalStored };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ REPORTING ------

function generatePerformanceReport(metrics, aggregateMetrics, anomalies, days) {
    try {
        var report = {
            reportDate: new Date().toISOString(),
            periodDays: days,
            summaryMetrics: {
                sendsMonitored: metrics.length,
                totalRecipients: 0,
                overallOpenRate: aggregateMetrics.overallOpenRate,
                overallClickRate: aggregateMetrics.overallClickRate,
                overallBounceRate: aggregateMetrics.overallBounceRate,
                overallUnsubRate: aggregateMetrics.overallUnsubRate
            },
            topPerformers: [],
            lowPerformers: [],
            anomaliesDetected: anomalies.length,
            recommendations: generateRecommendations(aggregateMetrics, anomalies)
        };

        // Sort and get top/bottom performers
        var sortedByOpen = metrics.slice().sort(function(a, b) { return b.OpenRate - a.OpenRate; });
        report.topPerformers = sortedByOpen.slice(0, 3);
        report.lowPerformers = sortedByOpen.slice(-3);

        return report;
    } catch (e) {
        return null;
    }
}

function generateRecommendations(metrics, anomalies) {
    var recommendations = [];

    if (metrics.overallOpenRate < 15) {
        recommendations.push("⚠ Open rate below 15% - consider A/B testing subject lines");
    }

    if (metrics.overallClickRate < 2) {
        recommendations.push("⚠ Click rate below 2% - review call-to-action visibility");
    }

    if (metrics.overallBounceRate > 3) {
        recommendations.push("⚠ Bounce rate above 3% - review list quality and email validation");
    }

    if (anomalies.length > 0) {
        recommendations.push("⚠ Anomalies detected - investigate " + anomalies.length + " send(s)");
    }

    if (recommendations.length === 0) {
        recommendations.push("✓ Send performance is healthy");
    }

    return recommendations;
}

function logPerformanceSummary(aggregateMetrics, anomalies) {
    try {
        api.createItem("DataExtensionObject", {
            CustomerKey: "performance_summary_log",
            Properties: [
                { Name: "LogDate", Value: new Date().toISOString() },
                { Name: "OpenRate", Value: String(aggregateMetrics.overallOpenRate) },
                { Name: "ClickRate", Value: String(aggregateMetrics.overallClickRate) },
                { Name: "BounceRate", Value: String(aggregateMetrics.overallBounceRate) },
                { Name: "AnomaliesFound", Value: String(anomalies.length) },
                { Name: "Status", Value: anomalies.length > 0 ? "WARNING" : "HEALTHY" }
            ]
        });
    } catch (e) {
        // Silently fail
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Monitor last 7 days ---
var config = {
    days: 7,
    emailID: null,
    sendDefinitionID: null,
    metricsDeKey: "send_performance_metrics_de",
    benchmarkDeKey: "performance_benchmarks_de",
    anomalyThreshold: 20,
    minSendSize: 100
};

var result = monitorSendPerformance(config);

Write("<h2>Send Performance Report - Last 7 Days</h2>");
Write("<p><strong>Status:</strong> " + result.status + "</p>");
Write("<p><strong>Sends Monitored:</strong> " + result.sendsMonitored + "</p>");
Write("<p><strong>Total Recipients:</strong> " + result.totalRecipients + "</p>");

if (result.report) {
    Write("<h3>Key Metrics</h3>");
    Write("<ul>");
    Write("<li>Open Rate: " + result.performance.overallOpenRate + "%</li>");
    Write("<li>Click Rate: " + result.performance.overallClickRate + "%</li>");
    Write("<li>Bounce Rate: " + result.performance.overallBounceRate + "%</li>");
    Write("</ul>");

    if (result.anomalies.length > 0) {
        Write("<h3>Anomalies (" + result.anomalies.length + ")</h3>");
        Write("<ul>");
        for (var i = 0; i < result.anomalies.length; i++) {
            var anom = result.anomalies[i];
            Write("<li>Send " + anom.SendID + ": " + anom.anomalies.length + " anomaly(ies)</li>");
        }
        Write("</ul>");
    }
}

// Log workflow
for (var i = 0; i < result.steps.length; i++) {
    Write(result.steps[i] + "<br>");
}
*/

</script>
