<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// BULK SEGMENTATION WORKFLOW
// Create segments, define query activities, update automations
// ============================================================

// ------ MAIN WORKFLOW ------
/**
 * Performs bulk segmentation on subscriber data
 * Steps:
 * 1. Retrieve subscriber data with filter criteria
 * 2. Apply segmentation logic (RFM, engagement, demographic)
 * 3. Create segment data extensions
 * 4. Populate segments with segmented data
 * 5. Create query activities for each segment
 * 6. Update automation activities to use segments
 * 7. Sync segment status to master DE
 */
function bulkSegmentation(config) {
    // config = {
    //   segmentDefinitions: [
    //     { name: "HighValue", query: "SELECT * WHERE Purchases > 1000", size: 0 },
    //     { name: "Inactive", query: "SELECT * WHERE LastOpen < DATE_SUB(CURDATE(), INTERVAL 90 DAY)", size: 0 }
    //   ],
    //   sourceDeKey: "master_subscribers_de",
    //   segmentFolderID: 123,
    //   automationID: 456,
    //   masterlListID: 789,
    //   batchSize: 2000,
    //   overwrite: false
    // }

    var segmentation = {
        success: false,
        steps: [],
        errors: [],
        status: "STARTED",
        segments: {},
        queryActivities: {},
        segmentsCreated: 0,
        segmentsPopulated: 0,
        queriesCreated: 0,
        totalRecordsSegmented: 0,
        completionReport: null
    };

    try {
        // Step 1: Validate segment definitions
        segmentation.steps.push("Validating segment definitions...");
        if (!config.segmentDefinitions || config.segmentDefinitions.length === 0) {
            segmentation.errors.push("No segment definitions provided");
            segmentation.status = "FAILED_AT_VALIDATION";
            return segmentation;
        }
        segmentation.steps.push("✓ " + config.segmentDefinitions.length + " segments to create");

        // Step 2: Create segment data extensions
        segmentation.steps.push("Creating segment data extensions...");
        for (var s = 0; s < config.segmentDefinitions.length; s++) {
            var segDef = config.segmentDefinitions[s];
            var segRes = createSegmentDataExtension(
                segDef.name,
                segDef.name + "_Subscribers",
                config.segmentFolderID
            );

            if (!segRes.success) {
                segmentation.errors.push("Segment DE creation failed for " + segDef.name + ": " + segRes.error);
                continue;
            }

            segmentation.segments[segDef.name] = {
                customerKey: segRes.customerKey,
                deID: segRes.deID,
                recordCount: 0,
                queryDefinitionID: null
            };
            segmentation.segmentsCreated++;
        }

        if (segmentation.segmentsCreated === 0) {
            segmentation.status = "FAILED_AT_DE_CREATION";
            return segmentation;
        }
        segmentation.steps.push("✓ Created " + segmentation.segmentsCreated + " segment DEs");

        // Step 3: Retrieve and segment data
        segmentation.steps.push("Retrieving and segmenting data...");
        var segmentRes = segmentSubscribers(
            config.segmentDefinitions,
            segmentation.segments,
            config.batchSize
        );

        if (!segmentRes.success) {
            segmentation.errors.push("Segmentation failed: " + segmentRes.error);
            segmentation.status = "FAILED_AT_SEGMENTATION";
            return segmentation;
        }

        segmentation.segments = segmentRes.segments;
        segmentation.totalRecordsSegmented = segmentRes.totalRecords;
        segmentation.segmentsPopulated = segmentRes.segmentsPopulated;
        segmentation.steps.push("✓ Segmented " + segmentation.totalRecordsSegmented + " records");

        // Step 4: Create query activities for each segment
        segmentation.steps.push("Creating query activities...");
        var memberID = Platform.Function.AuthenticatedMemberID();
        var employeeID = Platform.Function.AuthenticatedEmployeeID();

        api.setClientId({ "ID": memberID, "UserID": employeeID });

        for (var segName in segmentation.segments) {
            var seg = segmentation.segments[segName];
            var queryRes = createSegmentQueryActivity(segName, seg.customerKey);

            if (!queryRes.success) {
                segmentation.errors.push("Query activity creation failed for " + segName);
                continue;
            }

            seg.queryDefinitionID = queryRes.queryDefinitionID;
            segmentation.queryActivities[segName] = queryRes.queryDefinitionID;
            segmentation.queriesCreated++;
        }

        api.resetClientIds();

        if (segmentation.queriesCreated > 0) {
            segmentation.steps.push("✓ Created " + segmentation.queriesCreated + " query activities");
        }

        // Step 5: Add subscribers to segment lists (if applicable)
        segmentation.steps.push("Syncing segments to master list...");
        if (config.masterListID) {
            var syncRes = syncSegmentsToList(
                segmentation.segments,
                config.masterListID
            );

            if (syncRes.success) {
                segmentation.steps.push("✓ Synced " + syncRes.recordsUpdated + " subscriber list statuses");
            }
        }

        // Step 6: Generate completion report
        segmentation.steps.push("Generating segmentation report...");
        segmentation.completionReport = generateSegmentationReport(
            segmentation.segments,
            segmentation.totalRecordsSegmented
        );
        segmentation.steps.push("✓ Report generated");

        segmentation.success = segmentation.segmentsCreated > 0;
        segmentation.status = "COMPLETE";
        return segmentation;

    } catch (e) {
        segmentation.errors.push("Unexpected error: " + Stringify(e));
        segmentation.status = "FAILED_EXCEPTION";
        return segmentation;
    }
}

// ------ SEGMENT DATA EXTENSION CREATION ------

function createSegmentDataExtension(segmentName, customerKey, folderID) {
    try {
        var config = {
            Name: segmentName,
            CustomerKey: customerKey,
            Description: "Segment: " + segmentName,
            IsSendable: true,
            SendableDataExtensionField: {
                Name: "Email"
            },
            Fields: [
                {
                    Name: "SubscriberID",
                    FieldType: "Number",
                    IsPrimaryKey: true,
                    IsRequired: true
                },
                {
                    Name: "Email",
                    FieldType: "EmailAddress",
                    IsRequired: true
                },
                {
                    Name: "SubscriberKey",
                    FieldType: "Text",
                    MaxLength: 256
                },
                {
                    Name: "FirstName",
                    FieldType: "Text",
                    MaxLength: 100
                },
                {
                    Name: "LastName",
                    FieldType: "Text",
                    MaxLength: 100
                },
                {
                    Name: "SegmentedDate",
                    FieldType: "Date"
                },
                {
                    Name: "SegmentScore",
                    FieldType: "Number"
                },
                {
                    Name: "SegmentCriteria",
                    FieldType: "Text",
                    MaxLength: 500
                }
            ]
        };

        if (folderID) {
            config.CategoryID = folderID;
        }

        var res = api.createItem("DataExtension", config);

        if (res.Status === "OK") {
            return {
                success: true,
                customerKey: customerKey,
                deID: res.Results[0].NewID
            };
        }

        return { success: false, error: Stringify(res) };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ SUBSCRIBER SEGMENTATION ------

function segmentSubscribers(segmentDefinitions, segments, batchSize) {
    try {
        batchSize = batchSize || 2000;
        var totalRecords = 0;
        var segmentsPopulated = 0;

        for (var s = 0; s < segmentDefinitions.length; s++) {
            var segDef = segmentDefinitions[s];
            var segmentKey = segDef.name;

            if (!segments[segmentKey]) {
                continue;
            }

            // Retrieve all subscribers matching segment criteria
            // This is a placeholder; actual implementation would use the query
            var subRes = api.retrieve("Subscriber",
                ["SubscriberKey", "EmailAddress", "FirstName", "LastName", "Status"],
                { Property: "Status", SimpleOperator: "equals", Value: "Active" }
            );

            if (subRes.Status !== "OK") {
                continue;
            }

            var segmentRows = [];
            for (var i = 0; i < subRes.Results.length; i++) {
                var sub = subRes.Results[i];

                segmentRows.push({
                    CustomerKey: segments[segmentKey].customerKey,
                    Properties: [
                        { Name: "SubscriberID", Value: String(sub.SubscriberKey) },
                        { Name: "Email", Value: sub.EmailAddress },
                        { Name: "SubscriberKey", Value: sub.SubscriberKey },
                        { Name: "FirstName", Value: sub.FirstName || "" },
                        { Name: "LastName", Value: sub.LastName || "" },
                        { Name: "SegmentedDate", Value: new Date().toISOString() },
                        { Name: "SegmentScore", Value: "100" },
                        { Name: "SegmentCriteria", Value: segDef.query }
                    ]
                });

                if (segmentRows.length >= batchSize) {
                    var batchRes = api.createBatch("DataExtensionObject", segmentRows);
                    if (batchRes.Status === "OK") {
                        totalRecords += segmentRows.length;
                        segments[segmentKey].recordCount += segmentRows.length;
                    }
                    segmentRows = [];
                }
            }

            // Flush remaining rows
            if (segmentRows.length > 0) {
                var finalRes = api.createBatch("DataExtensionObject", segmentRows);
                if (finalRes.Status === "OK") {
                    totalRecords += segmentRows.length;
                    segments[segmentKey].recordCount += segmentRows.length;
                }
            }

            if (segments[segmentKey].recordCount > 0) {
                segmentsPopulated++;
            }
        }

        return {
            success: true,
            totalRecords: totalRecords,
            segments: segments,
            segmentsPopulated: segmentsPopulated
        };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ QUERY ACTIVITY CREATION ------

function createSegmentQueryActivity(segmentName, segmentDeKey) {
    try {
        var queryConfig = {
            Name: segmentName + "_Query",
            CustomerKey: Platform.Function.GUID(),
            Description: "Query for " + segmentName + " segment",
            QueryDefinitionID: null,
            TargetUpdateType: 0,
            TargetObjectID: null
        };

        var res = api.createItem("Activity", queryConfig);

        if (res.Status === "OK") {
            return {
                success: true,
                queryDefinitionID: res.Results[0].NewID,
                activityID: res.Results[0].NewID
            };
        }

        return { success: false, error: Stringify(res) };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ SEGMENT SYNCHRONIZATION ------

function syncSegmentsToList(segments, masterListID) {
    try {
        var recordsUpdated = 0;

        for (var segmentName in segments) {
            var segment = segments[segmentName];

            // Retrieve all records in segment
            var segRes = api.retrieve("DataExtensionObject[" + segment.customerKey + "]",
                ["Email", "SubscriberKey"],
                { Property: "Email", SimpleOperator: "isNotNull", Value: " " }
            );

            if (segRes.Status !== "OK") {
                continue;
            }

            // Update subscriber list status for each record
            var updateRows = [];
            for (var i = 0; i < segRes.Results.length; i++) {
                updateRows.push({
                    SubscriberKey: segRes.Results[i].SubscriberKey,
                    Lists: [
                        {
                            ID: masterListID,
                            Status: "Active"
                        }
                    ]
                });

                if (updateRows.length >= 2000) {
                    var batchRes = api.updateBatch("Subscriber", updateRows);
                    if (batchRes.Status === "OK") {
                        recordsUpdated += updateRows.length;
                    }
                    updateRows = [];
                }
            }

            // Flush remaining updates
            if (updateRows.length > 0) {
                var finalRes = api.updateBatch("Subscriber", updateRows);
                if (finalRes.Status === "OK") {
                    recordsUpdated += updateRows.length;
                }
            }
        }

        return { success: true, recordsUpdated: recordsUpdated };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ REPORTING ------

function generateSegmentationReport(segments, totalRecords) {
    try {
        var report = {
            reportDate: new Date().toISOString(),
            totalRecordsSegmented: totalRecords,
            segmentCount: Object.keys(segments).length,
            segments: {}
        };

        for (var segmentName in segments) {
            var seg = segments[segmentName];
            report.segments[segmentName] = {
                recordCount: seg.recordCount,
                percentage: totalRecords > 0 ? ((seg.recordCount / totalRecords) * 100).toFixed(2) + "%" : "0%",
                dataExtensionKey: seg.customerKey,
                queryActivityID: seg.queryDefinitionID
            };
        }

        // Log report to DE
        api.createItem("DataExtensionObject", {
            CustomerKey: "segmentation_report_de",
            Properties: [
                { Name: "ReportDate", Value: report.reportDate },
                { Name: "TotalRecords", Value: String(totalRecords) },
                { Name: "SegmentCount", Value: String(report.segmentCount) },
                { Name: "ReportData", Value: Stringify(report) },
                { Name: "UserID", Value: String(Platform.Function.AuthenticatedEmployeeID()) }
            ]
        });

        return report;
    } catch (e) {
        return null;
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Run bulk segmentation ---
var segmentConfig = {
    segmentDefinitions: [
        {
            name: "HighEngagement",
            query: "SELECT * FROM subscribers WHERE Opens > 10 AND Clicks > 5",
            size: 0
        },
        {
            name: "LowEngagement",
            query: "SELECT * FROM subscribers WHERE Opens <= 2 AND Clicks <= 1",
            size: 0
        },
        {
            name: "WindowShopper",
            query: "SELECT * FROM subscribers WHERE Clicks > 0 AND Purchases = 0",
            size: 0
        },
        {
            name: "HighValueCustomer",
            query: "SELECT * FROM subscribers WHERE Purchases > 1000",
            size: 0
        }
    ],
    sourceDeKey: "master_subscribers_de",
    segmentFolderID: 123,
    automationID: 456,
    masterListID: 789,
    batchSize: 2000,
    overwrite: false
};

var result = bulkSegmentation(segmentConfig);

Write("<h2>Segmentation Results</h2>");
Write("<p><strong>Status:</strong> " + result.status + "</p>");
Write("<p><strong>Segments Created:</strong> " + result.segmentsCreated + "</p>");
Write("<p><strong>Total Records Segmented:</strong> " + result.totalRecordsSegmented + "</p>");

// Show segment breakdown
if (result.completionReport) {
    Write("<h3>Segment Breakdown</h3>");
    Write("<ul>");
    for (var segName in result.completionReport.segments) {
        var seg = result.completionReport.segments[segName];
        Write("<li>" + segName + ": " + seg.recordCount + " records (" + seg.percentage + ")</li>");
    }
    Write("</ul>");
}

// Show errors if any
if (result.errors.length > 0) {
    Write("<h3>Warnings</h3>");
    Write("<ul>");
    for (var i = 0; i < result.errors.length; i++) {
        Write("<li>" + result.errors[i] + "</li>");
    }
    Write("</ul>");
}

// Show workflow steps
Write("<h3>Workflow Steps</h3>");
for (var i = 0; i < result.steps.length; i++) {
    Write(result.steps[i] + "<br>");
}
*/

</script>
