<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// AUTOMATION OPERATIONS
// Status codes: -1=Error, 0=Building, 1=Ready, 2=Running,
//   3=Paused, 4=Stopped, 5=Scheduled, 6=Awaiting Confirmation,
//   7=Inactive, 8=Completed
// ============================================================

var AUTOMATION_STATUS = {
    "-1": "Error",
    "0": "Building/Idle",
    "1": "Ready",
    "2": "Running",
    "3": "Paused",
    "4": "Stopped",
    "5": "Scheduled",
    "6": "Awaiting Confirmation",
    "7": "Inactive/Deactivated",
    "8": "Completed"
};

// ------ RETRIEVE all automations (paginated) ------
function getAllAutomations() {
    var cols = [
        "Name", "Description", "CustomerKey", "IsActive",
        "CreatedDate", "ModifiedDate", "Status", "ProgramID",
        "CategoryID", "LastRunTime", "ScheduledTime",
        "LastSaveDate", "ModifiedBy", "LastSavedBy",
        "CreatedBy", "AutomationType", "RecurrenceID"
    ];

    var filter = {
        Property: "Status",
        SimpleOperator: "IN",
        Value: [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8]
    };

    var opts = { BatchSize: 300 };
    var props = { QueryAllAccounts: false };
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            moreData = false;
            if (reqID) props.ContinueRequest = reqID;
            var data = api.retrieve("Automation", cols, filter, opts, props);
            if (data != null && data.Status === "OK") {
                moreData = data.HasMoreRows;
                reqID = data.RequestID;
                for (var i = 0; i < data.Results.length; i++) {
                    allResults.push(data.Results[i]);
                }
            }
        }
        return { success: true, automations: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE automations by status ------
function getAutomationsByStatus(statusCode) {
    var cols = ["Name", "CustomerKey", "Status", "ProgramID", "LastRunTime", "ScheduledTime", "IsActive"];

    try {
        var res = api.retrieve("Automation", cols, {
            Property: "Status",
            SimpleOperator: "equals",
            Value: statusCode
        });
        if (res.Status === "OK") {
            return { success: true, automations: res.Results, count: res.Results.length };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE running automations ------
function getRunningAutomations() {
    return getAutomationsByStatus(2);
}

// ------ RETRIEVE scheduled automations ------
function getScheduledAutomations() {
    return getAutomationsByStatus(5);
}

// ------ RETRIEVE errored automations ------
function getErroredAutomations() {
    return getAutomationsByStatus(-1);
}

// ------ RETRIEVE automation by Name ------
function getAutomationByName(name) {
    var cols = ["Name", "CustomerKey", "Status", "ProgramID", "ObjectID", "LastRunTime", "ScheduledTime", "IsActive", "Description"];

    try {
        var res = api.retrieve("Automation", cols, {
            Property: "Name",
            SimpleOperator: "equals",
            Value: name
        });
        if (res.Status === "OK" && res.Results.length > 0) {
            var auto = res.Results[0];
            auto.StatusLabel = AUTOMATION_STATUS[String(auto.Status)] || "Unknown";
            return { success: true, automation: auto };
        }
        return { success: false, error: "Automation not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE automation by CustomerKey ------
function getAutomationByKey(customerKey) {
    var cols = ["Name", "CustomerKey", "Status", "ProgramID", "ObjectID", "LastRunTime", "ScheduledTime", "IsActive"];

    try {
        var res = api.retrieve("Automation", cols, {
            Property: "CustomerKey",
            SimpleOperator: "equals",
            Value: customerKey
        });
        if (res.Status === "OK" && res.Results.length > 0) {
            var auto = res.Results[0];
            auto.StatusLabel = AUTOMATION_STATUS[String(auto.Status)] || "Unknown";
            return { success: true, automation: auto };
        }
        return { success: false, error: "Automation not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ START an automation ------
function startAutomation(objectID) {
    try {
        var res = api.performItem("Automation", { ObjectID: objectID }, "start", {});
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ START automation by Name ------
function startAutomationByName(name) {
    var auto = getAutomationByName(name);
    if (auto.success) {
        return startAutomation(auto.automation.ObjectID);
    }
    return auto;
}

// ------ GET automation summary report ------
function getAutomationSummary() {
    var all = getAllAutomations();
    if (!all.success) return all;

    var summary = {
        total: all.count,
        byStatus: {}
    };

    for (var i = 0; i < all.automations.length; i++) {
        var statusCode = String(all.automations[i].Status);
        var statusLabel = AUTOMATION_STATUS[statusCode] || "Unknown (" + statusCode + ")";
        if (!summary.byStatus[statusLabel]) {
            summary.byStatus[statusLabel] = 0;
        }
        summary.byStatus[statusLabel]++;
    }

    return { success: true, summary: summary };
}

// ------ RETRIEVE activities (use "Activity", NOT "AutomationActivity") ------
function getActivities() {
    try {
        var res = api.retrieve("Activity", ["Name", "ObjectID", "ActivityType"], {
            Property: "Name",
            SimpleOperator: "isNotNull",
            Value: " "
        });
        if (res.Status === "OK") {
            return { success: true, activities: res.Results, count: res.Results.length };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- List all automations ---
var all = getAllAutomations();
for (var i = 0; i < all.automations.length; i++) {
    var a = all.automations[i];
    var label = AUTOMATION_STATUS[String(a.Status)] || "Unknown";
    Write(a.Name + " | Status: " + label + " | Last Run: " + a.LastRunTime + "<br>");
}

// --- Get running automations ---
var running = getRunningAutomations();
Write("Currently running: " + running.count);

// --- Get errored automations ---
var errors = getErroredAutomations();
Write("Errored: " + errors.count);

// --- Find and start automation ---
var auto = getAutomationByName("Daily_Import");
if (auto.success) {
    Write("Status: " + auto.automation.StatusLabel);
    startAutomation(auto.automation.ObjectID);
}

// --- Summary report ---
var summary = getAutomationSummary();
Write("Total: " + summary.summary.total + "<br>");
for (var status in summary.summary.byStatus) {
    Write(status + ": " + summary.summary.byStatus[status] + "<br>");
}
*/

</script>
