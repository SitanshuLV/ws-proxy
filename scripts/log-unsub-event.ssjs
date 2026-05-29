<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// LOG UNSUB EVENT OPERATIONS
// Uses execute() — note: parameter order is (properties, requestName)
// ============================================================

// ------ ONE-CLICK UNSUBSCRIBE (from email context) ------
// Use this on a CloudPage linked from an email
function oneClickUnsub() {
    var subkey = Attribute.GetValue("_subscriberkey");
    var jid = Attribute.GetValue("jobid");
    var lid = Attribute.GetValue("listid");
    var bid = Attribute.GetValue("_JobSubscriberBatchID");

    return logUnsubEvent(subkey, jid, lid, bid, "One-click unsubscribe");
}

// ------ LOG UNSUB EVENT with explicit parameters ------
function logUnsubEvent(subscriberKey, jobID, listID, batchID, reason) {
    var props = [
        { Name: "SubscriberKey", Value: subscriberKey },
        { Name: "JobID", Value: jobID },
        { Name: "ListID", Value: listID },
        { Name: "BatchID", Value: batchID },
        { Name: "Reason", Value: reason || "Unsubscribed via WSProxy" }
    ];

    try {
        // execute() takes (properties, requestName) — properties FIRST
        var res = api.execute(props, "LogUnsubEvent");
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ CUSTOM UNSUBSCRIBE PAGE ------
// Full implementation for a custom unsub CloudPage
function handleUnsubPage() {
    var subkey = Request.GetQueryStringParameter("sk");
    var jid = Request.GetQueryStringParameter("jid");
    var lid = Request.GetQueryStringParameter("lid");
    var bid = Request.GetQueryStringParameter("bid");
    var reason = Request.GetQueryStringParameter("reason") || "Custom unsubscribe page";

    if (!subkey || !jid || !lid || !bid) {
        return { success: false, error: "Missing required parameters (sk, jid, lid, bid)" };
    }

    return logUnsubEvent(subkey, jid, lid, bid, reason);
}

// ------ BATCH UNSUBSCRIBE ------
// Unsubscribe multiple subscribers from a list
function batchUnsub(subscriberKeys, jobID, listID, batchID, reason) {
    var results = [];

    for (var i = 0; i < subscriberKeys.length; i++) {
        var res = logUnsubEvent(subscriberKeys[i], jobID, listID, batchID, reason);
        results.push({
            subscriberKey: subscriberKeys[i],
            success: res.success,
            error: res.success ? null : res.error
        });
    }

    var successCount = 0;
    for (var j = 0; j < results.length; j++) {
        if (results[j].success) successCount++;
    }

    return {
        success: successCount === results.length,
        total: results.length,
        succeeded: successCount,
        failed: results.length - successCount,
        details: results
    };
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- One-click unsub (from email context on a CloudPage) ---
var result = oneClickUnsub();
if (result.success) {
    Write("<h1>You have been unsubscribed.</h1>");
} else {
    Write("<h1>Error processing your request.</h1>");
    Write("<p>" + Stringify(result.error) + "</p>");
}

// --- Manual unsub with known parameters ---
var result = logUnsubEvent("subscriber_key_123", "67890", "456", "1", "Preference center unsub");

// --- Custom unsub page (parameters from query string) ---
// URL: cloudpage.com/unsub?sk=xxx&jid=123&lid=456&bid=1
var result = handleUnsubPage();

// --- Batch unsub ---
var keys = ["sub_001", "sub_002", "sub_003"];
var result = batchUnsub(keys, "67890", "456", "1", "List cleanup");
Write("Unsubscribed: " + result.succeeded + "/" + result.total);
*/

</script>
