<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// TRACKING EVENT OPERATIONS
// Shared properties: SendID, SubscriberKey, EventDate, BatchID,
//                    ListID, TriggeredSendDefinitionObjectID
// ============================================================

// ------ GENERIC paginated event retriever ------
function retrieveEvents(eventType, columns, filter) {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data;
            if (reqID == null) {
                data = filter
                    ? api.retrieve(eventType, columns, filter)
                    : api.retrieve(eventType, columns);
            } else {
                data = api.getNextBatch(eventType, reqID);
            }

            if (data != null && data.Status === "OK") {
                moreData = data.HasMoreRows;
                reqID = data.RequestID;
                for (var i = 0; i < data.Results.length; i++) {
                    allResults.push(data.Results[i]);
                }
            } else {
                moreData = false;
            }
        }
        return { success: true, events: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// SENT EVENTS
// ============================================================

function getSentEvents(filter) {
    var cols = ["SendID", "SubscriberKey", "EventDate", "BatchID", "ListID", "TriggeredSendDefinitionObjectID"];
    return retrieveEvents("SentEvent", cols, filter);
}

function getSentEventsByJob(jobID) {
    return getSentEvents({
        Property: "SendID",
        SimpleOperator: "equals",
        Value: jobID
    });
}

function getSentEventsByDate(startDate, endDate) {
    return getSentEvents({
        Property: "EventDate",
        SimpleOperator: "between",
        Value: [startDate, endDate]
    });
}

function getSentEventsBySubscriber(subscriberKey) {
    return getSentEvents({
        Property: "SubscriberKey",
        SimpleOperator: "equals",
        Value: subscriberKey
    });
}

// ============================================================
// OPEN EVENTS
// ============================================================

function getOpenEvents(filter) {
    var cols = ["SendID", "SubscriberKey", "EventDate", "BatchID", "ListID", "TriggeredSendDefinitionObjectID"];
    return retrieveEvents("OpenEvent", cols, filter);
}

function getOpenEventsByJob(jobID) {
    return getOpenEvents({
        Property: "SendID",
        SimpleOperator: "equals",
        Value: jobID
    });
}

function getOpenEventsByDate(startDate, endDate) {
    return getOpenEvents({
        Property: "EventDate",
        SimpleOperator: "between",
        Value: [startDate, endDate]
    });
}

// ============================================================
// CLICK EVENTS
// ============================================================

function getClickEvents(filter) {
    var cols = ["SendID", "SubscriberKey", "EventDate", "URL", "BatchID", "ListID", "TriggeredSendDefinitionObjectID"];
    return retrieveEvents("ClickEvent", cols, filter);
}

function getClickEventsByJob(jobID) {
    return getClickEvents({
        Property: "SendID",
        SimpleOperator: "equals",
        Value: jobID
    });
}

function getClickEventsByDate(startDate, endDate) {
    return getClickEvents({
        Property: "EventDate",
        SimpleOperator: "between",
        Value: [startDate, endDate]
    });
}

function getClickEventsByURL(url) {
    return getClickEvents({
        Property: "URL",
        SimpleOperator: "like",
        Value: "%" + url + "%"
    });
}

// ============================================================
// BOUNCE EVENTS
// ============================================================

function getBounceEvents(filter) {
    var cols = ["SendID", "SubscriberKey", "EventDate", "BounceCategory", "BounceType", "SMTPCode", "BatchID", "ListID"];
    return retrieveEvents("BounceEvent", cols, filter);
}

function getBounceEventsByJob(jobID) {
    return getBounceEvents({
        Property: "SendID",
        SimpleOperator: "equals",
        Value: jobID
    });
}

function getBounceEventsByDate(startDate, endDate) {
    return getBounceEvents({
        Property: "EventDate",
        SimpleOperator: "between",
        Value: [startDate, endDate]
    });
}

function getHardBounces(startDate, endDate) {
    return getBounceEvents({
        LeftOperand: {
            Property: "EventDate",
            SimpleOperator: "between",
            Value: [startDate, endDate]
        },
        LogicalOperator: "AND",
        RightOperand: {
            Property: "BounceType",
            SimpleOperator: "equals",
            Value: "Hard"
        }
    });
}

// ============================================================
// UNSUBSCRIBE EVENTS
// ============================================================

function getUnsubEvents(filter) {
    var cols = ["SendID", "SubscriberKey", "EventDate", "BatchID", "ListID", "TriggeredSendDefinitionObjectID"];
    return retrieveEvents("UnsubEvent", cols, filter);
}

function getUnsubEventsByJob(jobID) {
    return getUnsubEvents({
        Property: "SendID",
        SimpleOperator: "equals",
        Value: jobID
    });
}

function getUnsubEventsByDate(startDate, endDate) {
    return getUnsubEvents({
        Property: "EventDate",
        SimpleOperator: "between",
        Value: [startDate, endDate]
    });
}

// ============================================================
// NOT SENT EVENTS
// ============================================================

function getNotSentEvents(filter) {
    var cols = ["SendID", "SubscriberKey", "EventDate", "BatchID", "ListID", "TriggeredSendDefinitionObjectID"];
    return retrieveEvents("NotSentEvent", cols, filter);
}

function getNotSentEventsByJob(jobID) {
    return getNotSentEvents({
        Property: "SendID",
        SimpleOperator: "equals",
        Value: jobID
    });
}

function getNotSentEventsByDate(startDate, endDate) {
    return getNotSentEvents({
        Property: "EventDate",
        SimpleOperator: "between",
        Value: [startDate, endDate]
    });
}

// ============================================================
// COMBINED TRACKING REPORT FOR A JOB
// ============================================================

function getJobTrackingReport(jobID) {
    var report = {
        jobID: jobID,
        sent: getSentEventsByJob(jobID),
        opens: getOpenEventsByJob(jobID),
        clicks: getClickEventsByJob(jobID),
        bounces: getBounceEventsByJob(jobID),
        unsubs: getUnsubEventsByJob(jobID),
        notSent: getNotSentEventsByJob(jobID)
    };

    report.summary = {
        sentCount: report.sent.success ? report.sent.count : 0,
        openCount: report.opens.success ? report.opens.count : 0,
        clickCount: report.clicks.success ? report.clicks.count : 0,
        bounceCount: report.bounces.success ? report.bounces.count : 0,
        unsubCount: report.unsubs.success ? report.unsubs.count : 0,
        notSentCount: report.notSent.success ? report.notSent.count : 0
    };

    var s = report.summary;
    if (s.sentCount > 0) {
        s.openRate = ((s.openCount / s.sentCount) * 100).toFixed(2) + "%";
        s.clickRate = ((s.clickCount / s.sentCount) * 100).toFixed(2) + "%";
        s.bounceRate = ((s.bounceCount / s.sentCount) * 100).toFixed(2) + "%";
        s.unsubRate = ((s.unsubCount / s.sentCount) * 100).toFixed(2) + "%";
    }

    return report;
}

// ============================================================
// STORE EVENTS TO A DATA EXTENSION
// ============================================================

function storeEventsToDE(events, deCustomerKey) {
    if (!events || events.length === 0) return { success: true, count: 0 };

    var batchSize = 50;
    var totalStored = 0;

    try {
        for (var b = 0; b < events.length; b += batchSize) {
            var batch = [];
            var end = Math.min(b + batchSize, events.length);

            for (var i = b; i < end; i++) {
                var props = [];
                for (var key in events[i]) {
                    if (events[i].hasOwnProperty(key) && key !== "Client" && key !== "PartnerProperties") {
                        var val = events[i][key];
                        if (val !== null && val !== undefined) {
                            props.push({ "Name": key, "Value": String(val) });
                        }
                    }
                }
                batch.push({ CustomerKey: deCustomerKey, Properties: props });
            }

            var options = {
                SaveOptions: [{ PropertyName: '*', SaveAction: 'UpdateAdd' }]
            };

            var res = api.createBatch("DataExtensionObject", batch, options);
            if (res.Status === "OK") {
                totalStored += batch.length;
            }
        }
        return { success: true, count: totalStored };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Get sent events for a specific job ---
var sent = getSentEventsByJob(12345);
Write("Sent: " + sent.count);

// --- Get opens in a date range ---
var opens = getOpenEventsByDate("2024-01-01T00:00:00.000Z", "2024-12-31T23:59:59.999Z");
Write("Opens: " + opens.count);

// --- Get clicks by URL pattern ---
var clicks = getClickEventsByURL("promo-page");

// --- Get hard bounces ---
var bounces = getHardBounces("2024-01-01T00:00:00.000Z", "2024-06-30T23:59:59.999Z");

// --- Full job report ---
var report = getJobTrackingReport(12345);
Write("Sent: " + report.summary.sentCount);
Write("Open Rate: " + report.summary.openRate);
Write("Click Rate: " + report.summary.clickRate);
Write("Bounce Rate: " + report.summary.bounceRate);

// --- Store events to a DE for archival ---
var events = getSentEventsByDate("2024-01-01T00:00:00.000Z", "2024-01-31T23:59:59.999Z");
if (events.success) {
    storeEventsToDE(events.events, "tracking_archive_key");
}
*/

</script>
