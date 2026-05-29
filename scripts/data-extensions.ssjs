<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// DATA EXTENSION OPERATIONS
// ============================================================

// ------ CREATE a basic Data Extension ------
function createDataExtension(name, fields, categoryID) {
    var config = {
        "CustomerKey": String(Platform.Function.GUID()).toUpperCase(),
        "Name": name,
        "CategoryID": categoryID || 0,
        "Fields": fields
    };

    try {
        var res = api.createItem("DataExtension", config);
        if (res.Status === "OK") {
            return { success: true, customerKey: config.CustomerKey, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ CREATE a Sendable Data Extension ------
function createSendableDE(name, fields, subscriberFieldName, categoryID) {
    var config = {
        "CustomerKey": String(Platform.Function.GUID()).toUpperCase(),
        "Name": name,
        "CategoryID": categoryID || 0,
        "IsSendable": true,
        "SendableDataExtensionField": {
            "Name": subscriberFieldName,
            "FieldType": "EmailAddress"
        },
        "SendableSubscriberField": {
            "Name": "Subscriber Key"
        },
        "Fields": fields
    };

    try {
        var res = api.createItem("DataExtension", config);
        if (res.Status === "OK") {
            return { success: true, customerKey: config.CustomerKey, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ CREATE a Data Extension with Retention ------
function createRetentionDE(name, fields, retentionDays, categoryID) {
    var config = {
        "CustomerKey": String(Platform.Function.GUID()).toUpperCase(),
        "Name": name,
        "CategoryID": categoryID || 0,
        "DataRetentionPeriodLength": retentionDays,
        "DataRetentionPeriod": "Days",
        "RowBasedRetention": true,
        "ResetRetentionPeriodOnImport": true,
        "DeleteAtEndOfRetentionPeriod": true,
        "Fields": fields
    };

    try {
        var res = api.createItem("DataExtension", config);
        if (res.Status === "OK") {
            return { success: true, customerKey: config.CustomerKey, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE Data Extension by Name ------
function getDEByName(deName) {
    try {
        var res = api.retrieve("DataExtension", ["CustomerKey", "ObjectID", "Name", "CategoryID", "IsSendable", "Status"], {
            Property: "Name",
            SimpleOperator: "equals",
            Value: deName
        });
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, de: res.Results[0] };
        }
        return { success: false, error: "DE not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE Data Extension by CustomerKey ------
function getDEByKey(customerKey) {
    try {
        var res = api.retrieve("DataExtension", ["CustomerKey", "ObjectID", "Name", "CategoryID", "IsSendable", "Status"], {
            Property: "CustomerKey",
            SimpleOperator: "equals",
            Value: customerKey
        });
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, de: res.Results[0] };
        }
        return { success: false, error: "DE not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE all Data Extensions (with pagination) ------
function getAllDEs() {
    var allResults = [];
    var moreData = true;
    var reqID = null;
    var filter = {
        Property: "CustomerKey",
        SimpleOperator: "isNotNull",
        Value: " "
    };

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("DataExtension", ["Name", "CustomerKey", "CategoryID", "IsSendable"], filter)
                : api.getNextBatch("DataExtension", reqID);

            if (data != null && data.Status === "OK") {
                moreData = data.HasMoreRows;
                reqID = data.RequestID;
                for (var i = 0; i < data.Results.length; i++) {
                    // Skip system DEs
                    if (data.Results[i].Name.indexOf("_") !== 0) {
                        allResults.push(data.Results[i]);
                    }
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

// ------ UPDATE Data Extension (move to folder) ------
function moveDEToFolder(customerKey, targetCategoryID) {
    try {
        var res = api.updateItem("DataExtension", {
            "CustomerKey": customerKey,
            "CategoryID": targetCategoryID
        });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ DELETE a Data Extension ------
function deleteDE(customerKey) {
    try {
        var objReq = api.retrieve("DataExtension", ["ObjectID"], {
            Property: "CustomerKey",
            SimpleOperator: "equals",
            Value: customerKey
        });

        if (objReq.Status === "OK" && objReq.Results.length > 0) {
            var res = api.deleteItem("DataExtension", { "ObjectID": objReq.Results[0].ObjectID });
            return { success: res.Status === "OK", result: res };
        }
        return { success: false, error: "DE not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ CLEAR all rows from a Data Extension ------
function clearDE(customerKey) {
    try {
        var res = api.performItem("DataExtension", { CustomerKey: customerKey }, "ClearData", {});
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ DESCRIBE Data Extension object ------
function describeDE() {
    try {
        var res = api.describe("DataExtension");
        var props = (res.Results && res.Results[0] && res.Results[0].Properties) ? res.Results[0].Properties : [];
        var retrievable = [];
        for (var i = 0; i < props.length; i++) {
            if (props[i].IsRetrievable) {
                retrievable.push({ Name: props[i].Name, DataType: props[i].DataType });
            }
        }
        return { success: true, retrievableProperties: retrievable, totalProperties: props.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// DATA EXTENSION ROW OPERATIONS
// ============================================================

// ------ INSERT a single row ------
function insertRow(customerKey, data) {
    var properties = [];
    for (var key in data) {
        properties.push({ "Name": key, "Value": data[key] });
    }

    try {
        var res = api.createItem("DataExtensionObject", {
            CustomerKey: customerKey,
            Properties: properties
        });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ UPSERT a single row ------
function upsertRow(customerKey, data) {
    var properties = [];
    for (var key in data) {
        properties.push({ "Name": key, "Value": data[key] });
    }

    var options = {
        SaveOptions: [{ PropertyName: '*', SaveAction: 'UpdateAdd' }]
    };

    try {
        var res = api.updateItem("DataExtensionObject", {
            CustomerKey: customerKey,
            Properties: properties
        }, options);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ BATCH INSERT rows ------
function insertRows(customerKey, dataArray) {
    var rows = [];
    for (var r = 0; r < dataArray.length; r++) {
        var properties = [];
        for (var key in dataArray[r]) {
            properties.push({ "Name": key, "Value": dataArray[r][key] });
        }
        rows.push({ CustomerKey: customerKey, Properties: properties });
    }

    try {
        var res = api.createBatch("DataExtensionObject", rows);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ BATCH UPSERT rows ------
function upsertRows(customerKey, dataArray) {
    var rows = [];
    for (var r = 0; r < dataArray.length; r++) {
        var properties = [];
        for (var key in dataArray[r]) {
            properties.push({ "Name": key, "Value": dataArray[r][key] });
        }
        rows.push({ CustomerKey: customerKey, Properties: properties });
    }

    var options = {
        SaveOptions: [{ PropertyName: '*', SaveAction: 'UpdateAdd' }]
    };

    try {
        var res = api.updateBatch("DataExtensionObject", rows, options);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE rows (with optional filter) ------
function getRows(customerKey, columns, filter) {
    try {
        var objectType = "DataExtensionObject[" + customerKey + "]";
        var res = filter
            ? api.retrieve(objectType, columns, filter)
            : api.retrieve(objectType, columns);

        if (res.Status === "OK") {
            return { success: true, data: res.Results, count: res.Results.length, hasMore: res.HasMoreRows, requestID: res.RequestID };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE all rows with pagination ------
function getAllRows(customerKey, columns, filter) {
    var allResults = [];
    var moreData = true;
    var reqID = null;
    var objectType = "DataExtensionObject[" + customerKey + "]";

    try {
        while (moreData) {
            var data = reqID == null
                ? (filter ? api.retrieve(objectType, columns, filter) : api.retrieve(objectType, columns))
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

// ------ DELETE a single row ------
function deleteRow(customerKey, primaryKeyName, primaryKeyValue) {
    try {
        var res = api.deleteItem("DataExtensionObject", {
            CustomerKey: customerKey,
            Keys: [{ Name: primaryKeyName, Value: primaryKeyValue }]
        });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ DELETE multiple rows ------
function deleteRows(customerKey, primaryKeyName, primaryKeyValues) {
    var items = [];
    for (var i = 0; i < primaryKeyValues.length; i++) {
        items.push({
            CustomerKey: customerKey,
            Keys: [{ Name: primaryKeyName, Value: primaryKeyValues[i] }]
        });
    }

    try {
        var res = api.deleteBatch("DataExtensionObject", items);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// DATA EXTENSION FIELD OPERATIONS
// ============================================================

// ------ RETRIEVE field definitions ------
function getFields(customerKey) {
    try {
        var res = api.retrieve(
            "DataExtensionField",
            ["Name", "FieldType", "MaxLength", "IsPrimaryKey", "IsRequired", "DefaultValue", "ObjectID"],
            {
                Property: "DataExtension.CustomerKey",
                SimpleOperator: "equals",
                Value: customerKey
            }
        );
        if (res.Status === "OK") {
            return { success: true, fields: res.Results, count: res.Results.length };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ ADD new fields to existing DE ------
function addFields(customerKey, newFields) {
    try {
        var res = api.updateItem("DataExtension", {
            "CustomerKey": customerKey,
            "Fields": newFields
        });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ UPDATE a field's default value ------
function updateFieldDefault(customerKey, fieldName, defaultValue) {
    try {
        // First get the field ObjectID
        var fieldReq = api.retrieve("DataExtensionField", ["ObjectID"], {
            LeftOperand: {
                Property: "DataExtension.CustomerKey",
                SimpleOperator: "equals",
                Value: customerKey
            },
            LogicalOperator: "AND",
            RightOperand: {
                Property: "Name",
                SimpleOperator: "equals",
                Value: fieldName
            }
        });

        if (fieldReq.Status === "OK" && fieldReq.Results.length > 0) {
            var res = api.updateItem("DataExtension", {
                CustomerKey: customerKey,
                Fields: [{
                    Name: fieldName,
                    DefaultValue: defaultValue,
                    ObjectID: fieldReq.Results[0].ObjectID
                }]
            });
            return { success: res.Status === "OK", result: res };
        }
        return { success: false, error: "Field not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Create a DE ---
var fields = [
    { "Name": "Email", "FieldType": "EmailAddress", "IsPrimaryKey": true, "IsRequired": true, "MaxLength": 254 },
    { "Name": "FirstName", "FieldType": "Text", "MaxLength": 50 },
    { "Name": "Score", "FieldType": "Number" }
];
var result = createDataExtension("My_Contacts", fields);
Write(Stringify(result));

// --- Insert rows ---
var rows = [
    { Email: "alice@test.com", FirstName: "Alice", Score: "85" },
    { Email: "bob@test.com", FirstName: "Bob", Score: "92" }
];
var result = insertRows(customerKey, rows);

// --- Upsert a row ---
var result = upsertRow(customerKey, { Email: "alice@test.com", Score: "99" });

// --- Retrieve with filter ---
var result = getRows(customerKey, ["Email", "FirstName", "Score"], {
    Property: "Score",
    SimpleOperator: "greaterThan",
    Value: "80"
});

// --- Delete a row ---
var result = deleteRow(customerKey, "Email", "bob@test.com");

// --- Add a field ---
var result = addFields(customerKey, [
    { "Name": "Country", "FieldType": "Text", "MaxLength": 50 }
]);

// --- Clear and delete DE ---
clearDE(customerKey);
deleteDE(customerKey);
*/

</script>
