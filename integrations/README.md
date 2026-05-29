# WSProxy Integration Examples

This directory contains **end-to-end integration workflows** that demonstrate real-world patterns for using WSProxy in Salesforce Marketing Cloud.

Each script combines multiple WSProxy operations to solve complete business scenarios, going beyond individual SOAP object operations.

---

## Integration Scripts Overview

### 1. **Campaign Setup** (`campaign-setup.ssjs`)
**Purpose:** Automate the complete setup of an email campaign from scratch.

**Workflow:**
1. Create a campaign folder for organization
2. Create a sendable data extension (subscriber list)
3. Create an email with subject and content
4. Create a send definition linking email → list → sender
5. Create a triggered send definition for transactional sends
6. Create an automation with a query activity for segmentation
7. Start the automation

**Use Cases:**
- Onboarding new campaigns programmatically
- Rapid campaign deployment
- Standardized campaign setup with consistent configuration
- Building on top of existing templates

**Key Functions:**
- `setupCampaign(config)` — Main workflow orchestrator
- `createCampaignFolder()` — Folder hierarchy for organization
- `createCampaignDataExtension()` — Sendable DE with required fields
- `createCampaignEmail()` — Email template with HTML/text
- `createCampaignSendDefinition()` — Maps email → list → sender
- `createCampaignTriggeredSend()` — Transactional send setup
- `createCampaignAutomation()` — Automation with query activities

**Configuration Example:**
```javascript
var config = {
    campaignName: "Spring_Promo_2025",
    emailName: "Spring Promotion",
    emailSubject: "Save 30% this spring!",
    emailContent: "<h1>Spring Sale</h1><p>Get 30% off everything</p>",
    daysToRun: 30,
    automationName: "Spring_Promo_Automation"
};

var result = setupCampaign(config);
```

**Output:** Returns workflow status, step-by-step execution log, IDs of all created objects

---

### 2. **Subscriber Lifecycle** (`subscriber-lifecycle.ssjs`)
**Purpose:** Manage a subscriber through their complete journey: creation → preferences → engagement → unsubscribe.

**Workflow:**
1. Create or retrieve subscriber by email
2. Add subscriber to marketing lists
3. Set subscriber preferences (newsletter, SMS, push)
4. Analyze engagement (opens, clicks over 6 months)
5. Handle unsubscribe requests
6. Archive subscriber data for GDPR compliance

**Use Cases:**
- Welcome flow automation
- Preference management interfaces
- Engagement scoring
- GDPR/CCPA data deletion
- Subscriber onboarding and offboarding

**Key Functions:**
- `manageSubscriberLifecycle(config)` — Main lifecycle manager
- `createOrGetSubscriber()` — Create if new, retrieve if exists
- `addSubscriberToLists()` — Bulk list assignment
- `setSubscriberPreferences()` — Store preference attributes
- `analyzeSubscriberEngagement()` — Calculate engagement score
- `unsubscribeSubscriber()` — Handle opt-outs
- `archiveSubscriberData()` — GDPR-compliant archival

**Configuration Example:**
```javascript
var config = {
    email: "user@example.com",
    firstName: "John",
    lastName: "Doe",
    listIDs: [123, 456],
    preferences: { Newsletter: "true", SMS: "false" },
    action: "create"  // or "unsub", "archive"
};

var result = manageSubscriberLifecycle(config);
```

**Output:** Subscriber key, engagement score, list of completed actions

---

### 3. **Data Archival & Cleanup** (`data-archival-cleanup.ssjs`)
**Purpose:** Manage data lifecycle: archive old tracking events, aggregate metrics, and clean up temporary data.

**Workflow:**
1. Retrieve tracking events older than retention cutoff (default 90 days)
2. Aggregate metrics (sent, opens, clicks, bounces) by send
3. Store aggregated metrics to archive DE
4. Archive detailed events to historical DE
5. Delete processed events from production (optional)
6. Clean up temporary/staging data extensions
7. Generate compliance report

**Use Cases:**
- Monthly/quarterly data housekeeping
- Performance data archival before deletion
- GDPR data retention compliance
- Storage optimization
- Historical analysis and trend reporting

**Key Functions:**
- `archiveAndCleanup(config)` — Main archival orchestrator
- `retrieveOldTrackingEvents()` — Get events by age
- `aggregateMetrics()` — Calculate summary statistics
- `archiveDetailedEvents()` — Copy to archive DE
- `cleanupStagingData()` — Remove temporary data
- `generateComplianceReport()` — Document the operation

**Configuration Example:**
```javascript
var config = {
    retentionDays: 90,
    trackingDEKey: "engagement_archive_de",
    metricsDEKey: "engagement_metrics_de",
    stagingDEKey: "staging_data_de",
    complianceLogDEKey: "compliance_log_de"
};

var result = archiveAndCleanup(config);
Write("Archived " + result.archive.eventsCopied + " events");
```

**Output:** Archival report, events processed count, compliance status

---

### 4. **Bulk Segmentation** (`bulk-segmentation.ssjs`)
**Purpose:** Segment subscribers based on criteria, create segment DEs, and set up query activities for automations.

**Workflow:**
1. Validate segment definitions
2. Create data extension for each segment
3. Retrieve subscribers matching segment criteria
4. Populate segment DEs with relevant subscribers (batched)
5. Create query activities for each segment
6. Sync segment lists to master subscriber list
7. Generate segmentation report

**Use Cases:**
- RFM segmentation (Recency, Frequency, Monetary)
- Engagement-based segmentation (high/low/medium)
- Demographic segmentation
- Behavioral segmentation
- Pre-built segment groups for campaigns

**Key Functions:**
- `bulkSegmentation(config)` — Main segmentation orchestrator
- `createSegmentDataExtension()` — One DE per segment
- `segmentSubscribers()` — Populate segments with matching subscribers
- `createSegmentQueryActivity()` — Query activity for automation
- `syncSegmentsToList()` — Update master list with segment status
- `generateSegmentationReport()` — Output segment breakdown

**Configuration Example:**
```javascript
var config = {
    segmentDefinitions: [
        { name: "HighEngagement", query: "SELECT * WHERE Opens > 10" },
        { name: "LowEngagement", query: "SELECT * WHERE Opens <= 2" },
        { name: "HighValue", query: "SELECT * WHERE Purchases > 1000" }
    ],
    masterListID: 789,
    batchSize: 2000,
    overwrite: false
};

var result = bulkSegmentation(config);
```

**Output:** Segment counts, records segmented per segment, query activity IDs

---

### 5. **Send Performance Monitoring** (`send-performance-monitoring.ssjs`)
**Purpose:** Monitor email send performance, track KPIs, detect anomalies, and store metrics.

**Workflow:**
1. Retrieve sends from recent period (default 7 days)
2. Aggregate tracking events (sent, open, click, bounce, unsub) per send
3. Calculate KPIs (open rate, click rate, bounce rate, CTR)
4. Compare against industry benchmarks
5. Identify performance anomalies
6. Store metrics to tracking DE
7. Generate performance report with recommendations

**Use Cases:**
- Daily/weekly performance dashboards
- Anomaly detection (bounce spike, unsubscribe spike)
- Trend analysis
- Campaign comparison
- Automated alerts on underperformance

**Key Functions:**
- `monitorSendPerformance(config)` — Main monitoring orchestrator
- `getRecentSends()` — Retrieve sends by date range
- `aggregateSendMetrics()` — Calculate all KPIs per send
- `compareAgainstBenchmarks()` — Detect deviations
- `storePerformanceMetrics()` — Archive metrics to DE
- `generatePerformanceReport()` — Detailed analysis + recommendations

**Configuration Example:**
```javascript
var config = {
    days: 7,
    metricsDeKey: "send_performance_metrics_de",
    anomalyThreshold: 20,  // % deviation from benchmark
    minSendSize: 100
};

var result = monitorSendPerformance(config);
Write("Open Rate: " + result.performance.overallOpenRate + "%");
```

**Output:** KPIs, anomalies detected, top/worst performers, recommendations

---

## Real-World Patterns & Best Practices

### Pattern 1: Error Handling with Graceful Degradation
Every integration script uses a **workflow object** that tracks:
- **steps:** Executed operations (log for user visibility)
- **errors:** Failed operations (continue or warn)
- **status:** Overall state (STARTED → COMPLETE/FAILED)

```javascript
var workflow = { success: false, steps: [], errors: [], status: "STARTED" };

// At each step:
if (!stepRes.success) {
    workflow.errors.push("Step failed: " + stepRes.error);
    workflow.status = "WARNING_AT_STEP";  // Don't fail entirely
    continue;  // Move to next step
}
```

### Pattern 2: Pagination for Large Results
All scripts retrieve data using safe pagination:

```javascript
var moreData = true;
var reqID = null;
var results = [];

while (moreData && results.length < SAFETY_LIMIT) {
    var data = reqID == null
        ? api.retrieve(objectType, cols, filter)
        : api.getNextBatch(objectType, reqID);

    if (data && data.Status === "OK") {
        results = results.concat(data.Results);
        moreData = data.HasMoreRows;
        reqID = data.RequestID;
    } else {
        moreData = false;
    }
}
```

### Pattern 3: Batch Operations for Performance
Instead of looping single creates, use batch operations:

```javascript
// SLOW: 1000 API calls
for (var i = 0; i < rows.length; i++) {
    api.createItem("DataExtensionObject", rows[i]);
}

// FAST: 1 API call for 2000, then 1 more for remainder
for (var i = 0; i < rows.length; i += 2000) {
    var chunk = rows.slice(i, Math.min(i + 2000, rows.length));
    api.createBatch("DataExtensionObject", chunk);
}
```

### Pattern 4: setClientId for Automation Operations
Automation creation requires Business Unit context:

```javascript
var memberID = Platform.Function.AuthenticatedMemberID();
var employeeID = Platform.Function.AuthenticatedEmployeeID();

api.setClientId({ "ID": memberID, "UserID": employeeID });
// Create automations here
api.resetClientIds();
```

### Pattern 5: Configuration Objects
Each integration accepts a config object with sensible defaults:

```javascript
function processData(config) {
    var retentionDays = config.retentionDays || 90;
    var batchSize = config.batchSize || 2000;
    var minSendSize = config.minSendSize || 100;
    // ...
}
```

### Pattern 6: Status Code Checking
Always check Status before accessing Results:

```javascript
var res = api.retrieve(...);
if (res.Status === "OK") {
    // Safe to access res.Results
    for (var i = 0; i < res.Results.length; i++) {
        // ...
    }
} else {
    return { success: false, error: Stringify(res) };
}
```

### Pattern 7: Compliance & Audit Logging
All destructive operations are logged:

```javascript
function logComplianceEvent(action, objectID, details) {
    try {
        api.createItem("DataExtensionObject", {
            CustomerKey: "compliance_log_de",
            Properties: [
                { Name: "Timestamp", Value: new Date().toISOString() },
                { Name: "Action", Value: action },
                { Name: "ObjectID", Value: objectID },
                { Name: "UserID", Value: String(Platform.Function.AuthenticatedEmployeeID()) },
                { Name: "Details", Value: details }
            ]
        });
    } catch (e) {
        // Silently fail to not block main flow
    }
}
```

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Main Workflow                        │
│          (setupCampaign, manageSubscriber, etc.)        │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴───────────┐
        │                      │
   ┌────▼─────────┐    ┌──────▼──────────┐
   │ Step 1: Prep │    │ Step N: Report  │
   │  ├─ Validate │    │  ├─ Aggregate   │
   │  ├─ Retrieve │    │  ├─ Store       │
   │  └─ Filter   │    │  └─ Summarize   │
   └────┬─────────┘    └──────┬──────────┘
        │                      │
        │ ┌────────────────────┘
        │ │
   ┌────▼─▼──────────────────────┐
   │   WSProxy Core Operations    │
   │  ├─ retrieve()               │
   │  ├─ createBatch()            │
   │  ├─ updateBatch()            │
   │  ├─ getNextBatch()           │
   │  └─ describe()               │
   └─────────────────────────────┘
```

---

## Common Integration Patterns Across Scripts

| Pattern | Used In | Benefit |
|---------|---------|---------|
| **Pagination** | All 5 scripts | Handle datasets of any size safely |
| **Batch Operations** | Campaign, Lifecycle, Segmentation, Cleanup | 10-100x performance improvement |
| **Error Collection** | All 5 scripts | Graceful degradation, user visibility |
| **Status Tracking** | All 5 scripts | Know exactly where failures occur |
| **Logging/Audit** | Lifecycle, Cleanup, Monitoring | Compliance and troubleshooting |
| **Configuration Objects** | All 5 scripts | Flexibility and reusability |
| **Workflow Orchestration** | All 5 scripts | Clear separation of concerns |

---

## Data Extension Dependencies

Create these DEs before running integrations:

```javascript
// Tracking/Archive DEs
api.createItem("DataExtension", {
    Name: "engagement_archive_de",
    CustomerKey: "engagement_archive_de",
    Fields: [
        { Name: "SubscriberKey", FieldType: "Text", IsPrimaryKey: true },
        { Name: "EventType", FieldType: "Text" },
        { Name: "EventDate", FieldType: "Date" },
        { Name: "ArchivedDate", FieldType: "Date" },
        { Name: "EventData", FieldType: "Text" }
    ]
});

// Metrics DEs
api.createItem("DataExtension", {
    Name: "send_performance_metrics_de",
    CustomerKey: "send_performance_metrics_de",
    Fields: [
        { Name: "SendID", FieldType: "Number", IsPrimaryKey: true },
        { Name: "MetricDate", FieldType: "Date" },
        { Name: "OpenRate", FieldType: "Decimal" },
        { Name: "ClickRate", FieldType: "Decimal" },
        { Name: "BounceRate", FieldType: "Decimal" }
    ]
});

// Compliance/Audit DEs
api.createItem("DataExtension", {
    Name: "compliance_log_de",
    CustomerKey: "compliance_log_de",
    Fields: [
        { Name: "Timestamp", FieldType: "Date", IsPrimaryKey: true },
        { Name: "Action", FieldType: "Text" },
        { Name: "ObjectID", FieldType: "Text" },
        { Name: "UserID", FieldType: "Number" },
        { Name: "Details", FieldType: "Text" }
    ]
});
```

---

## Performance Expectations

| Script | Typical Duration | Scaling Notes |
|--------|------------------|----------------|
| Campaign Setup | 10-15 seconds | Constant (all operations are single creates) |
| Subscriber Lifecycle | 5-30 seconds | Depends on engagement query complexity |
| Data Archival | 30-120 seconds | Scales with event volume (pagination handles it) |
| Bulk Segmentation | 60-300 seconds | Scales with subscriber count, batching helps |
| Performance Monitoring | 45-180 seconds | Scales with send volume, but metrics aggregation is fast |

**Timeout Warning:** 60-second SSJS limit. For large operations:
- Break into multiple script executions
- Use chunking (Campaign: multi-step automation)
- Run during off-peak hours
- Consider native SFMC scheduled activities

---

## Extending the Integration Scripts

### Add Custom Segmentation Logic
```javascript
// In bulk-segmentation.ssjs, modify segmentSubscribers():
if (engagement > 50) {
    segment = "HighEngagement";
} else if (recency < 30) {
    segment = "RecentActive";
} else {
    segment = "Dormant";
}
```

### Add Email Personalization
```javascript
// In campaign-setup.ssjs, modify createCampaignEmail():
var content = "<h1>Hi %%FirstName%%</h1>";
content += "<p>Your next %%ProductCategory%% is ready!</p>";
// Store as DynamicContent for AMPscript rendering
```

### Add Cross-BU Operations
```javascript
// In any integration, wrap in BU loop:
for (var buID of authorizedBusinessUnits) {
    api.setClientId({ "ID": buID });
    // Run integration logic
    api.resetClientIds();
}
```

---

## Troubleshooting Integration Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Campaign DE not created | SendableDataExtensionField missing | Ensure "Email" field exists and is marked sendable |
| setClientId fails | Not authenticated as admin | Use employee ID, not member ID alone |
| Segmentation timeout | Too many subscribers in segment | Reduce batch size, split into multiple runs |
| describe() returns undefined | Used top-level Status check | Check Results array existence instead |
| Archive fails silently | DE doesn't exist | Create archive DE with correct CustomerKey |
| Performance anomalies missing | Benchmark thresholds too loose | Lower anomalyThreshold from 20 to 10 |

---

## Next Steps

1. **Setup Prerequisites:** Create required DEs (tracking, metrics, archive, compliance)
2. **Test Individual Scripts:** Run campaign-setup first, then others
3. **Integrate into Automations:** Use as scheduled activities or triggered by data import
4. **Monitor & Tune:** Track execution times, adjust batch sizes
5. **Extend:** Add custom logic, integrate with external systems

---

## Related Documentation

- `../docs/wsproxy-reference.md` — Method signatures and parameters
- `../docs/performance-and-optimization.md` — Batch vs loop benchmarks
- `../docs/security-and-compliance.md` — PII/GDPR patterns
- `../docs/error-handling-and-troubleshooting.md` — Common errors
- `../scripts/utilities.ssjs` — Reusable helper functions
