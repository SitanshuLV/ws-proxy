<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// SUBSCRIBER LIFECYCLE MANAGEMENT
// Complete workflow: Create → Lists → Preferences → Engagement → Unsub
// ============================================================

// ------ MAIN WORKFLOW ------
/**
 * Manages a subscriber through their complete lifecycle
 * Steps:
 * 1. Create or retrieve subscriber
 * 2. Add to lists
 * 3. Set preferences
 * 4. Track engagement (opens, clicks, sends)
 * 5. Handle unsubscribe
 * 6. Archive subscriber data for compliance
 */
function manageSubscriberLifecycle(config) {
    // config = {
    //   email: "user@example.com",
    //   firstName: "John",
    //   lastName: "Doe",
    //   attributes: { Phone: "555-1234", Company: "Acme" },
    //   listIDs: [123, 456],
    //   preferences: { Newsletter: "true", SMS: "false" },
    //   trackingDeKey: "tracking_de",
    //   action: "create" | "update" | "unsub" | "archive"
    // }

    var lifecycle = {
        success: false,
        subscriberKey: null,
        steps: [],
        errors: [],
        engagementScore: 0,
        status: "STARTED",
        events: {
            created: false,
            listsAdded: false,
            preferencesSet: false,
            engagement: {},
            unsubscribed: false,
            archived: false
        }
    };

    try {
        // Step 1: Create or retrieve subscriber
        lifecycle.steps.push("Creating/retrieving subscriber...");
        var subRes = createOrGetSubscriber(config.email, config.firstName, config.lastName, config.attributes);
        if (!subRes.success) {
            lifecycle.errors.push("Subscriber creation failed: " + subRes.error);
            lifecycle.status = "FAILED_AT_SUBSCRIBER";
            return lifecycle;
        }
        lifecycle.subscriberKey = subRes.subscriberKey;
        lifecycle.events.created = true;
        lifecycle.steps.push("✓ Subscriber acquired: " + lifecycle.subscriberKey);

        // Step 2: Add subscriber to lists
        if (config.listIDs && config.listIDs.length > 0) {
            lifecycle.steps.push("Adding to lists...");
            var listRes = addSubscriberToLists(lifecycle.subscriberKey, config.listIDs);
            if (!listRes.success) {
                lifecycle.errors.push("List addition failed: " + listRes.error);
                lifecycle.status = "WARNING_LISTS";
            } else {
                lifecycle.events.listsAdded = true;
                lifecycle.steps.push("✓ Added to " + config.listIDs.length + " lists");
            }
        }

        // Step 3: Set subscriber preferences
        if (config.preferences && Object.keys(config.preferences).length > 0) {
            lifecycle.steps.push("Setting preferences...");
            var prefRes = setSubscriberPreferences(lifecycle.subscriberKey, config.preferences);
            if (!prefRes.success) {
                lifecycle.errors.push("Preference setting failed: " + prefRes.error);
                lifecycle.status = "WARNING_PREFS";
            } else {
                lifecycle.events.preferencesSet = true;
                lifecycle.steps.push("✓ Preferences set: " + Object.keys(config.preferences).join(", "));
            }
        }

        // Step 4: Retrieve engagement data
        lifecycle.steps.push("Analyzing engagement...");
        var engRes = analyzeSubscriberEngagement(lifecycle.subscriberKey);
        if (engRes.success) {
            lifecycle.engagementScore = engRes.engagementScore;
            lifecycle.events.engagement = engRes.metrics;
            lifecycle.steps.push("✓ Engagement score: " + engRes.engagementScore);
        }

        // Step 5: Handle action if specified
        if (config.action === "unsub") {
            lifecycle.steps.push("Processing unsubscribe...");
            var unsubRes = unsubscribeSubscriber(lifecycle.subscriberKey, config.listIDs);
            if (!unsubRes.success) {
                lifecycle.errors.push("Unsubscribe failed: " + unsubRes.error);
                lifecycle.status = "FAILED_AT_UNSUB";
                return lifecycle;
            }
            lifecycle.events.unsubscribed = true;
            lifecycle.steps.push("✓ Unsubscribed from lists");
        }

        // Step 6: Archive subscriber data (GDPR compliance)
        if (config.action === "archive") {
            lifecycle.steps.push("Archiving subscriber data...");
            var archRes = archiveSubscriberData(lifecycle.subscriberKey, config.trackingDeKey);
            if (!archRes.success) {
                lifecycle.errors.push("Archive failed: " + archRes.error);
                lifecycle.status = "WARNING_ARCHIVE";
            } else {
                lifecycle.events.archived = true;
                lifecycle.steps.push("✓ Data archived: " + archRes.recordsArchived + " records");
            }
        }

        lifecycle.success = true;
        lifecycle.status = "COMPLETE";
        return lifecycle;

    } catch (e) {
        lifecycle.errors.push("Unexpected error: " + Stringify(e));
        lifecycle.status = "FAILED_EXCEPTION";
        return lifecycle;
    }
}

// ------ SUBSCRIBER OPERATIONS ------

function createOrGetSubscriber(email, firstName, lastName, attributes) {
    try {
        // Try to retrieve first
        var getRes = api.retrieve("Subscriber", ["SubscriberKey", "EmailAddress", "Status"],
            { Property: "EmailAddress", SimpleOperator: "equals", Value: email }
        );

        if (getRes.Status === "OK" && getRes.Results.length > 0) {
            return {
                success: true,
                subscriberKey: getRes.Results[0].SubscriberKey,
                isNew: false
            };
        }

        // Create if not found
        var attributes_arr = [];
        if (attributes) {
            for (var key in attributes) {
                attributes_arr.push({
                    Name: key,
                    Value: attributes[key]
                });
            }
        }

        var config = {
            EmailAddress: email,
            Attributes: attributes_arr
        };

        if (firstName) {
            config.Attributes.push({ Name: "FirstName", Value: firstName });
        }
        if (lastName) {
            config.Attributes.push({ Name: "LastName", Value: lastName });
        }

        var createRes = api.createItem("Subscriber", config);

        if (createRes.Status === "OK") {
            return {
                success: true,
                subscriberKey: createRes.Results[0].NewID,
                isNew: true
            };
        }

        return { success: false, error: Stringify(createRes) };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

function addSubscriberToLists(subscriberKey, listIDs) {
    try {
        var lists = [];
        for (var i = 0; i < listIDs.length; i++) {
            lists.push({
                ID: listIDs[i],
                Status: "Active"
            });
        }

        var res = api.updateItem("Subscriber", {
            SubscriberKey: subscriberKey,
            Lists: lists
        });

        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

function setSubscriberPreferences(subscriberKey, preferencesObject) {
    try {
        var attributes = [];
        for (var key in preferencesObject) {
            attributes.push({
                Name: key,
                Value: String(preferencesObject[key])
            });
        }

        var res = api.updateItem("Subscriber", {
            SubscriberKey: subscriberKey,
            Attributes: attributes
        });

        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ ENGAGEMENT ANALYSIS ------

function analyzeSubscriberEngagement(subscriberKey) {
    try {
        var metrics = {
            sends: 0,
            opens: 0,
            clicks: 0,
            bounces: 0,
            unsubscribes: 0
        };

        // Get recent sends (last 6 months)
        var sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        var dateFilter = sixMonthsAgo.toISOString();

        // Count sent events
        var sentRes = api.retrieve("SentEvent", ["EventID"],
            {
                LeftOperand: {
                    Property: "SubscriberKey",
                    SimpleOperator: "equals",
                    Value: subscriberKey
                },
                LogicalOperator: "AND",
                RightOperand: {
                    Property: "EventDate",
                    SimpleOperator: "greaterThanOrEqual",
                    Value: dateFilter
                }
            }
        );
        if (sentRes.Status === "OK") {
            metrics.sends = sentRes.Results.length;
        }

        // Count open events
        var openRes = api.retrieve("OpenEvent", ["EventID"],
            {
                LeftOperand: {
                    Property: "SubscriberKey",
                    SimpleOperator: "equals",
                    Value: subscriberKey
                },
                LogicalOperator: "AND",
                RightOperand: {
                    Property: "EventDate",
                    SimpleOperator: "greaterThanOrEqual",
                    Value: dateFilter
                }
            }
        );
        if (openRes.Status === "OK") {
            metrics.opens = openRes.Results.length;
        }

        // Count click events
        var clickRes = api.retrieve("ClickEvent", ["EventID"],
            {
                LeftOperand: {
                    Property: "SubscriberKey",
                    SimpleOperator: "equals",
                    Value: subscriberKey
                },
                LogicalOperator: "AND",
                RightOperand: {
                    Property: "EventDate",
                    SimpleOperator: "greaterThanOrEqual",
                    Value: dateFilter
                }
            }
        );
        if (clickRes.Status === "OK") {
            metrics.clicks = clickRes.Results.length;
        }

        // Calculate engagement score (0-100)
        var engagementScore = 0;
        if (metrics.sends > 0) {
            var openRate = (metrics.opens / metrics.sends) * 100;
            var clickRate = (metrics.clicks / metrics.sends) * 100;
            engagementScore = Math.round((openRate + clickRate) / 2);
        }

        return {
            success: true,
            metrics: metrics,
            engagementScore: Math.min(engagementScore, 100),
            lastActivityDate: new Date().toISOString()
        };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ UNSUBSCRIBE HANDLING ------

function unsubscribeSubscriber(subscriberKey, listIDs) {
    try {
        if (!listIDs || listIDs.length === 0) {
            // Unsubscribe from all lists
            var lists = [];
            var allListsRes = api.retrieve("List", ["ID"], {});
            if (allListsRes.Status === "OK") {
                for (var i = 0; i < allListsRes.Results.length; i++) {
                    lists.push({
                        ID: allListsRes.Results[i].ID,
                        Status: "Unsubscribed"
                    });
                }
            }
        } else {
            // Unsubscribe from specific lists
            lists = [];
            for (var i = 0; i < listIDs.length; i++) {
                lists.push({
                    ID: listIDs[i],
                    Status: "Unsubscribed"
                });
            }
        }

        var res = api.updateItem("Subscriber", {
            SubscriberKey: subscriberKey,
            Lists: lists
        });

        // Log unsubscribe event
        if (res.Status === "OK") {
            logComplianceEvent("UNSUBSCRIBE", subscriberKey, "Subscriber unsubscribed from lists");
        }

        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ DATA ARCHIVAL FOR COMPLIANCE ------

function archiveSubscriberData(subscriberKey, trackingDeKey) {
    try {
        var recordsArchived = 0;

        // Retrieve all engagement events for this subscriber
        var sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        var dateFilter = sixMonthsAgo.toISOString();

        var eventTypes = ["SentEvent", "OpenEvent", "ClickEvent", "BounceEvent"];
        var archiveData = [];

        for (var t = 0; t < eventTypes.length; t++) {
            var eventRes = api.retrieve(eventTypes[t], ["*"],
                {
                    LeftOperand: {
                        Property: "SubscriberKey",
                        SimpleOperator: "equals",
                        Value: subscriberKey
                    },
                    LogicalOperator: "AND",
                    RightOperand: {
                        Property: "EventDate",
                        SimpleOperator: "greaterThanOrEqual",
                        Value: dateFilter
                    }
                }
            );

            if (eventRes.Status === "OK") {
                for (var i = 0; i < eventRes.Results.length; i++) {
                    archiveData.push({
                        EventType: eventTypes[t],
                        SubscriberKey: subscriberKey,
                        EventDate: new Date().toISOString(),
                        EventRecord: Stringify(eventRes.Results[i])
                    });
                }
            }
        }

        // Store archived data to tracking DE
        if (archiveData.length > 0 && trackingDeKey) {
            var archiveRows = [];
            for (var i = 0; i < archiveData.length; i++) {
                archiveRows.push({
                    CustomerKey: trackingDeKey,
                    Properties: [
                        { Name: "SubscriberKey", Value: subscriberKey },
                        { Name: "EventType", Value: archiveData[i].EventType },
                        { Name: "ArchivedDate", Value: archiveData[i].EventDate },
                        { Name: "EventData", Value: archiveData[i].EventRecord }
                    ]
                });
            }

            if (archiveRows.length > 0) {
                var archiveRes = api.createBatch("DataExtensionObject", archiveRows);
                if (archiveRes.Status === "OK") {
                    recordsArchived = archiveRows.length;
                }
            }
        }

        // Log archival for compliance
        logComplianceEvent("ARCHIVE", subscriberKey, "Archived " + recordsArchived + " engagement records");

        return { success: true, recordsArchived: recordsArchived };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ COMPLIANCE LOGGING ------

function logComplianceEvent(action, subscriberKey, details) {
    try {
        api.createItem("DataExtensionObject", {
            CustomerKey: "compliance_log_de",
            Properties: [
                { Name: "Timestamp", Value: new Date().toISOString() },
                { Name: "Action", Value: action },
                { Name: "SubscriberKey", Value: subscriberKey },
                { Name: "Details", Value: details },
                { Name: "UserID", Value: String(Platform.Function.AuthenticatedEmployeeID()) }
            ]
        });
    } catch (e) {
        // Silently fail to not block main flow
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Create new subscriber with preferences ---
var config1 = {
    email: "john@example.com",
    firstName: "John",
    lastName: "Doe",
    attributes: { Phone: "555-1234", Company: "Acme Corp" },
    listIDs: [123, 456],
    preferences: { Newsletter: "true", SMS: "false", PushNotification: "true" },
    trackingDeKey: "engagement_archive_de",
    action: "create"
};

var result1 = manageSubscriberLifecycle(config1);
Write(Stringify(result1, null, 2));

// --- Update existing subscriber ---
var config2 = {
    email: "john@example.com",
    preferences: { Newsletter: "false", SMS: "true" },
    action: "update"
};

var result2 = manageSubscriberLifecycle(config2);
for (var i = 0; i < result2.steps.length; i++) {
    Write(result2.steps[i] + "<br>");
}

// --- Unsubscribe subscriber ---
var config3 = {
    email: "john@example.com",
    listIDs: [123],
    action: "unsub"
};

var result3 = manageSubscriberLifecycle(config3);
Write("Engagement score: " + result3.engagementScore);

// --- Archive and comply with GDPR ---
var config4 = {
    email: "john@example.com",
    trackingDeKey: "gdpr_archive_de",
    action: "archive"
};

var result4 = manageSubscriberLifecycle(config4);
Write("Records archived: " + result4.events.archived);
*/

</script>
