<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// REUSABLE UTILITY FUNCTIONS
// ============================================================

// ------ PAGINATED RETRIEVE (generic) ------
// Works with any SOAP object type
function retrieveAll(objectType, columns, filter) {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data;
            if (reqID == null) {
                data = filter
                    ? api.retrieve(objectType, columns, filter)
                    : api.retrieve(objectType, columns);
            } else {
                data = api.getNextBatch(objectType, reqID);
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
        return { success: true, data: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ PAGINATED RETRIEVE with batch size and limit ------
function retrieveWithLimit(objectType, columns, filter, maxRecords) {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData && allResults.length < maxRecords) {
            var data;
            if (reqID == null) {
                data = filter
                    ? api.retrieve(objectType, columns, filter)
                    : api.retrieve(objectType, columns);
            } else {
                data = api.getNextBatch(objectType, reqID);
            }

            if (data != null && data.Status === "OK") {
                moreData = data.HasMoreRows;
                reqID = data.RequestID;
                for (var i = 0; i < data.Results.length && allResults.length < maxRecords; i++) {
                    allResults.push(data.Results[i]);
                }
            } else {
                moreData = false;
            }
        }
        return { success: true, data: allResults, count: allResults.length, truncated: moreData };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ DESCRIBE any SOAP object ------
// Returns retrievable properties with their data types
function describeObject(objectType) {
    try {
        var res = api.describe(objectType);
        var props = (res.Results && res.Results[0] && res.Results[0].Properties) ? res.Results[0].Properties : [];

        var retrievable = [];
        var creatable = [];
        var updatable = [];
        var filterable = [];

        for (var i = 0; i < props.length; i++) {
            var p = props[i];
            var info = { Name: p.Name, DataType: p.DataType, IsRequired: p.IsRequired };
            if (p.IsRetrievable) retrievable.push(info);
            if (p.IsCreatable) creatable.push(info);
            if (p.IsUpdatable) updatable.push(info);
            if (p.IsFilterable) filterable.push(info);
        }

        return {
            success: true,
            objectType: objectType,
            totalProperties: props.length,
            retrievable: retrievable,
            creatable: creatable,
            updatable: updatable,
            filterable: filterable
        };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ ERROR HANDLER wrapper ------
// Wraps any WSProxy call with consistent error handling
function safeCall(fn) {
    try {
        var result = fn();
        if (result && result.Status === "OK") {
            return { success: true, result: result };
        } else if (result && result.Status) {
            return { success: false, status: result.Status, result: result };
        }
        return { success: true, result: result };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ BATCH PROCESSOR ------
// Process large arrays in chunks to avoid timeouts
function processBatch(items, batchSize, processFn) {
    var results = [];
    var totalSuccess = 0;
    var totalFailed = 0;

    for (var i = 0; i < items.length; i += batchSize) {
        var chunk = items.slice(i, Math.min(i + batchSize, items.length));
        try {
            var res = processFn(chunk);
            results.push(res);
            if (res.Status === "OK") {
                totalSuccess += chunk.length;
            } else {
                totalFailed += chunk.length;
            }
        } catch (e) {
            totalFailed += chunk.length;
            results.push({ Status: "Error", error: Stringify(e) });
        }
    }

    return {
        success: totalFailed === 0,
        totalProcessed: items.length,
        succeeded: totalSuccess,
        failed: totalFailed,
        batches: results
    };
}

// ------ CROSS-BU RETRIEVE ------
// Retrieve from a different Business Unit
function retrieveFromBU(buMID, objectType, columns, filter) {
    try {
        api.setClientId({ "ID": buMID });
        var result = retrieveAll(objectType, columns, filter);
        api.resetClientIds();
        return result;
    } catch (e) {
        api.resetClientIds();
        return { success: false, error: Stringify(e) };
    }
}

// ------ CROSS-BU CREATE ------
function createInBU(buMID, objectType, properties) {
    try {
        api.setClientId({ "ID": buMID });
        var res = api.createItem(objectType, properties);
        api.resetClientIds();
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        api.resetClientIds();
        return { success: false, error: Stringify(e) };
    }
}

// ------ QUERY ALL ACCOUNTS ------
function retrieveAllAccounts(objectType, columns, filter) {
    var allResults = [];
    var moreData = true;
    var reqID = null;
    var opts = {};
    var props = { QueryAllAccounts: true };

    try {
        while (moreData) {
            moreData = false;
            if (reqID) props.ContinueRequest = reqID;
            var data = api.retrieve(objectType, columns, filter, opts, props);
            if (data != null && data.Status === "OK") {
                moreData = data.HasMoreRows;
                reqID = data.RequestID;
                for (var i = 0; i < data.Results.length; i++) {
                    allResults.push(data.Results[i]);
                }
            }
        }
        return { success: true, data: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ BUILD SIMPLE FILTER ------
function simpleFilter(property, operator, value) {
    return {
        Property: property,
        SimpleOperator: operator,
        Value: value
    };
}

// ------ BUILD COMPLEX FILTER (AND/OR) ------
function complexFilter(leftProp, leftOp, leftVal, logicalOp, rightProp, rightOp, rightVal) {
    return {
        LeftOperand: {
            Property: leftProp,
            SimpleOperator: leftOp,
            Value: leftVal
        },
        LogicalOperator: logicalOp,
        RightOperand: {
            Property: rightProp,
            SimpleOperator: rightOp,
            Value: rightVal
        }
    };
}

// ------ BUILD DATE RANGE FILTER ------
function dateFilter(property, startDate, endDate) {
    return {
        Property: property,
        SimpleOperator: "between",
        Value: [startDate, endDate]
    };
}

// ------ FORMAT DE ROW RESULTS ------
// Convert WSProxy DE row results into simple key-value objects
function formatDERows(results) {
    var formatted = [];
    for (var i = 0; i < results.length; i++) {
        var row = {};
        var props = results[i].Properties;
        for (var p = 0; p < props.length; p++) {
            row[props[p].Name] = props[p].Value;
        }
        formatted.push(row);
    }
    return formatted;
}

// ------ LOG OUTPUT HELPER ------
function writeJSON(data) {
    Write("<pre>" + Stringify(data) + "</pre>");
}

function writeTable(data, columns) {
    if (!data || data.length === 0) {
        Write("<p>No data</p>");
        return;
    }

    var cols = columns || Object.keys(data[0]);
    Write("<table border='1' cellpadding='5' cellspacing='0'>");
    Write("<tr>");
    for (var c = 0; c < cols.length; c++) {
        Write("<th>" + cols[c] + "</th>");
    }
    Write("</tr>");

    for (var r = 0; r < data.length; r++) {
        Write("<tr>");
        for (var c2 = 0; c2 < cols.length; c2++) {
            Write("<td>" + (data[r][cols[c2]] || "") + "</td>");
        }
        Write("</tr>");
    }
    Write("</table>");
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Paginated retrieve any object ---
var allDEs = retrieveAll("DataExtension", ["Name", "CustomerKey"]);
Write("Total DEs: " + allDEs.count);

// --- Describe any object ---
var desc = describeObject("Subscriber");
Write("Retrievable properties: " + desc.retrievable.length);
for (var i = 0; i < desc.retrievable.length; i++) {
    Write(desc.retrievable[i].Name + " (" + desc.retrievable[i].DataType + ")<br>");
}

// --- Cross-BU retrieve ---
var otherBU = retrieveFromBU(7654321, "DataExtension", ["Name", "CustomerKey"]);
Write("DEs in other BU: " + otherBU.count);

// --- Build filters easily ---
var f1 = simpleFilter("Status", "equals", "Active");
var f2 = dateFilter("EventDate", "2024-01-01", "2024-12-31");
var f3 = complexFilter("Status", "equals", "Active", "AND", "Score", "greaterThan", "80");

// --- Format DE rows for easy access ---
var rows = api.retrieve("DataExtensionObject[myKey]", ["Email", "Name"]);
var formatted = formatDERows(rows.Results);
// formatted = [{ Email: "...", Name: "..." }, ...]

// --- Output as HTML table ---
writeTable(formatted, ["Email", "Name"]);
*/

</script>
