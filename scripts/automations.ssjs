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
// CREATE AUTOMATION
// IMPORTANT: setClientId is REQUIRED to avoid "Create Access is denied!"
// ============================================================

// ------ CREATE an automation (empty shell) ------
function createAutomation(name, description, categoryID) {
    try {
        // setClientId is required for automation creation
        api.setClientId({
            "ID": Platform.Function.AuthenticatedMemberID(),
            "UserID": Platform.Function.AuthenticatedEmployeeID()
        });

        var config = {
            Name: name,
            CustomerKey: Platform.Function.GUID(),
            Description: description || "",
            AutomationType: "Scheduled",
            CategoryID: categoryID || null
        };

        var res = api.createItem("Automation", config);
        api.resetClientIds();

        if (res.Status === "OK") {
            return { success: true, customerKey: config.CustomerKey, objectID: res.Results[0].NewObjectID, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        api.resetClientIds();
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// AUTOMATION ACTIVITY CREATION
// Create individual activities that can be added to automations
// ============================================================

// ------ CREATE a SQL Query Activity (QueryDefinition) ------
function createQueryActivity(name, queryText, targetDEName, targetDEKey, updateType, categoryID) {
    // updateType: "Overwrite", "Update", "Append"
    var config = {
        Name: name,
        CustomerKey: Platform.Function.GUID(),
        CategoryID: categoryID || 0,
        QueryText: queryText,
        TargetType: "DE",
        TargetUpdateType: updateType || "Overwrite",
        DataExtensionTarget: {
            Name: targetDEName,
            CustomerKey: targetDEKey
        }
    };

    try {
        var res = api.createItem("QueryDefinition", config);
        if (res.Status === "OK") {
            return { success: true, customerKey: config.CustomerKey, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE Query Activities ------
function getQueryActivities() {
    return retrieveAllPaginated("QueryDefinition",
        ["Name", "CustomerKey", "ObjectID", "QueryText", "TargetType", "TargetUpdateType", "CategoryID", "Status"],
        { Property: "Name", SimpleOperator: "isNotNull", Value: " " }
    );
}

// ------ RETRIEVE a Query Activity by Name ------
function getQueryActivityByName(name) {
    try {
        var res = api.retrieve("QueryDefinition",
            ["Name", "CustomerKey", "ObjectID", "QueryText", "TargetType", "TargetUpdateType", "Status"],
            { Property: "Name", SimpleOperator: "equals", Value: name }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, query: res.Results[0] };
        }
        return { success: false, error: "Query Activity not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ UPDATE a Query Activity (change SQL) ------
function updateQueryActivity(customerKey, newQueryText) {
    try {
        var res = api.updateItem("QueryDefinition", {
            CustomerKey: customerKey,
            QueryText: newQueryText
        });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ DELETE a Query Activity ------
function deleteQueryActivity(objectID) {
    try {
        var res = api.deleteItem("QueryDefinition", { ObjectID: objectID });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ CREATE an Import Definition ------
function createImportDefinition(name, sourceDE_Key, destDE_Key, updateType, categoryID) {
    // updateType: "Overwrite", "AddAndUpdate", "AddAndDoNotUpdate", "UpdateButDoNotAdd"
    var config = {
        Name: name,
        CustomerKey: Platform.Function.GUID(),
        CategoryID: categoryID || 0,
        AllowErrors: true,
        UpdateType: updateType || "AddAndUpdate",
        DestinationObject: {
            ObjectID: destDE_Key
        },
        SourceObject: {
            ObjectID: sourceDE_Key
        },
        FieldMappingType: "InferFromColumnHeadings"
    };

    try {
        var res = api.createItem("ImportDefinition", config);
        if (res.Status === "OK") {
            return { success: true, customerKey: config.CustomerKey, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE Import Definitions ------
function getImportDefinitions() {
    return retrieveAllPaginated("ImportDefinition",
        ["Name", "CustomerKey", "ObjectID", "UpdateType", "CategoryID", "Status"],
        { Property: "Name", SimpleOperator: "isNotNull", Value: " " }
    );
}

// ------ CREATE a Script Activity (SSJS Activity) ------
function createScriptActivity(name, scriptContent, categoryID) {
    var config = {
        Name: name,
        CustomerKey: Platform.Function.GUID(),
        CategoryID: categoryID || 0,
        Script: scriptContent
    };

    try {
        var res = api.createItem("ScriptActivity", config);
        if (res.Status === "OK") {
            return { success: true, customerKey: config.CustomerKey, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ BULK create Query Activities ------
function createQueryActivitiesBulk(queries) {
    // queries = [{ name, queryText, targetDEName, targetDEKey, updateType }]
    var results = [];
    for (var i = 0; i < queries.length; i++) {
        var q = queries[i];
        var res = createQueryActivity(q.name, q.queryText, q.targetDEName, q.targetDEKey, q.updateType, q.categoryID);
        results.push({ name: q.name, success: res.success, customerKey: res.customerKey, error: res.success ? null : res.error });
    }

    var successCount = 0;
    for (var j = 0; j < results.length; j++) {
        if (results[j].success) successCount++;
    }
    return { total: results.length, succeeded: successCount, failed: results.length - successCount, details: results };
}

// ------ Helper: paginated retrieve for activities ------
function retrieveAllPaginated(objectType, columns, filter) {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve(objectType, columns, filter)
                : api.getNextBatch(objectType, reqID);

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
        return { success: true, data: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Create an automation shell ---
var auto = createAutomation("Daily_Import_Process", "Runs daily data import");
Write("Automation ObjectID: " + auto.objectID);

// --- Create a SQL Query Activity ---
var sql = "SELECT s.SubscriberKey, s.EmailAddress FROM _Subscribers s WHERE s.Status = 'active'";
var qa = createQueryActivity("Active_Subscribers_Query", sql, "Active_Subs_DE", "active-subs-de-key", "Overwrite");
Write("Query Activity Key: " + qa.customerKey);

// --- Bulk create queries ---
var queries = [
    { name: "Query_Segment_A", queryText: "SELECT * FROM [Master_DE] WHERE Segment = 'A'", targetDEName: "Segment_A", targetDEKey: "seg-a-key" },
    { name: "Query_Segment_B", queryText: "SELECT * FROM [Master_DE] WHERE Segment = 'B'", targetDEName: "Segment_B", targetDEKey: "seg-b-key" }
];
var result = createQueryActivitiesBulk(queries);
Write("Created: " + result.succeeded + "/" + result.total);

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
