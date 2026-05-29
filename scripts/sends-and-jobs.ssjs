<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// SEND / SENDEFINITION OPERATIONS
// ============================================================

// ------ CREATE a SendDefinition ------
function createSendDefinition(name, emailID, listID, senderProfileKey, categoryID) {
    var config = {
        Name: name,
        CustomerKey: Platform.Function.GUID(),
        CategoryID: categoryID || 0,
        Email: {
            ID: emailID
        },
        List: {
            ID: listID
        },
        SenderProfile: {
            CustomerKey: senderProfileKey || "default"
        }
    };

    try {
        var res = api.createItem("SendDefinition", config);
        if (res.Status === "OK") {
            return { success: true, customerKey: config.CustomerKey, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE SendDefinitions ------
function getSendDefinitions() {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("SendDefinition",
                    ["ObjectID", "Name", "CustomerKey", "Email.ID", "List.ID", "CreatedDate", "ModifiedDate", "Status"],
                    { Property: "Name", SimpleOperator: "isNotNull", Value: " " }
                )
                : api.getNextBatch("SendDefinition", reqID);

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
        return { success: true, sendDefinitions: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE SendDefinition by Name ------
function getSendDefinitionByName(name) {
    try {
        var res = api.retrieve("SendDefinition",
            ["ObjectID", "Name", "CustomerKey", "Email.ID", "List.ID", "Status"],
            { Property: "Name", SimpleOperator: "equals", Value: name }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, sendDefinition: res.Results[0] };
        }
        return { success: false, error: "SendDefinition not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ UPDATE SendDefinition ------
function updateSendDefinition(objectID, updates) {
    // updates = { Name, Email, List, SenderProfile }
    var config = { ObjectID: objectID };
    if (updates.Name) config.Name = updates.Name;
    if (updates.Email) config.Email = updates.Email;
    if (updates.List) config.List = updates.List;
    if (updates.SenderProfile) config.SenderProfile = updates.SenderProfile;

    try {
        var res = api.updateItem("SendDefinition", config);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ DELETE SendDefinition ------
function deleteSendDefinition(objectID) {
    try {
        var res = api.deleteItem("SendDefinition", { ObjectID: objectID });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// SEND JOB OPERATIONS
// ============================================================

// ------ RETRIEVE Send jobs ------
function getSendJobs() {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("Send",
                    ["ID", "Email.ID", "List.ID", "Status", "CreatedDate", "SendDate", "FromName", "FromAddress"],
                    { Property: "ID", SimpleOperator: "isNotNull", Value: " " }
                )
                : api.getNextBatch("Send", reqID);

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
        return { success: true, sends: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE Send job by ID ------
function getSendJobByID(jobID) {
    try {
        var res = api.retrieve("Send",
            ["ID", "Email.ID", "List.ID", "Status", "CreatedDate", "SendDate", "FromName", "FromAddress", "Subject"],
            { Property: "ID", SimpleOperator: "equals", Value: jobID }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, send: res.Results[0] };
        }
        return { success: false, error: "Send job not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE recent Send jobs ------
function getRecentSends(days) {
    var daysBack = days || 7;
    var startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    var startDateISO = startDate.toISOString();

    try {
        var res = api.retrieve("Send",
            ["ID", "Email.ID", "Status", "CreatedDate", "SendDate"],
            {
                Property: "CreatedDate",
                SimpleOperator: "greaterThanOrEqual",
                Value: startDateISO
            }
        );
        if (res.Status === "OK") {
            return { success: true, sends: res.Results, count: res.Results.length };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ GET Send job status ------
function getSendStatus(jobID) {
    var sendJob = getSendJobByID(jobID);
    if (!sendJob.success) return sendJob;

    var send = sendJob.send;
    return {
        success: true,
        jobID: send.ID,
        status: send.Status,
        emailID: send["Email.ID"],
        listID: send["List.ID"],
        createdDate: send.CreatedDate,
        sendDate: send.SendDate
    };
}

// ============================================================
// SEND STATISTICS / SUMMARY
// ============================================================

// ------ GET send summary statistics ------
function getSendSummary(jobID) {
    // Combine sent events with bounce/unsub to get summary
    var summary = {
        jobID: jobID,
        sent: 0,
        bounced: 0,
        unsubscribed: 0,
        opens: 0,
        clicks: 0
    };

    try {
        // Get sent count
        var sentRes = api.retrieve("SentEvent", ["SendID"],
            { Property: "SendID", SimpleOperator: "equals", Value: jobID }
        );
        if (sentRes.Status === "OK") {
            summary.sent = sentRes.Results.length;
        }

        // Get bounce count
        var bounceRes = api.retrieve("BounceEvent", ["SendID"],
            { Property: "SendID", SimpleOperator: "equals", Value: jobID }
        );
        if (bounceRes.Status === "OK") {
            summary.bounced = bounceRes.Results.length;
        }

        // Get unsub count
        var unsubRes = api.retrieve("UnsubEvent", ["SendID"],
            { Property: "SendID", SimpleOperator: "equals", Value: jobID }
        );
        if (unsubRes.Status === "OK") {
            summary.unsubscribed = unsubRes.Results.length;
        }

        // Get open count
        var openRes = api.retrieve("OpenEvent", ["SendID"],
            { Property: "SendID", SimpleOperator: "equals", Value: jobID }
        );
        if (openRes.Status === "OK") {
            summary.opens = openRes.Results.length;
        }

        // Get click count
        var clickRes = api.retrieve("ClickEvent", ["SendID"],
            { Property: "SendID", SimpleOperator: "equals", Value: jobID }
        );
        if (clickRes.Status === "OK") {
            summary.clicks = clickRes.Results.length;
        }

        // Calculate rates
        if (summary.sent > 0) {
            summary.openRate = ((summary.opens / summary.sent) * 100).toFixed(2) + "%";
            summary.clickRate = ((summary.clicks / summary.sent) * 100).toFixed(2) + "%";
            summary.bounceRate = ((summary.bounced / summary.sent) * 100).toFixed(2) + "%";
            summary.unsubRate = ((summary.unsubscribed / summary.sent) * 100).toFixed(2) + "%";
        }

        return { success: true, summary: summary };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Create a SendDefinition ---
var sendDef = createSendDefinition("Weekly_Newsletter", 123, 456, "default");

// --- Get all SendDefinitions ---
var defs = getSendDefinitions();
for (var i = 0; i < defs.sendDefinitions.length; i++) {
    Write(defs.sendDefinitions[i].Name + "<br>");
}

// --- Get recent sends ---
var recent = getRecentSends(7);
Write("Sends in last 7 days: " + recent.count);

// --- Get send job status ---
var status = getSendStatus(12345);
Write("Status: " + status.status);

// --- Get send summary ---
var summary = getSendSummary(12345);
Write("Sent: " + summary.summary.sent);
Write("Opens: " + summary.summary.openRate);
Write("Clicks: " + summary.summary.clickRate);
Write("Bounces: " + summary.summary.bounceRate);
*/

</script>
