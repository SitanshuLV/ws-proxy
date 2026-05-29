<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();
var log = [];
var testDE_Key = null;

function logResult(step, result) {
    var status = result ? result.Status : "NULL";
    log.push("[" + status + "] " + step);
    if (status !== "OK") {
        log.push("  Detail: " + Stringify(result));
    }
}

try {

    /* ========================================================
       STEP 1: Create a test Data Extension
       ======================================================== */
    testDE_Key = String(Platform.Function.GUID()).toUpperCase();
    var deName = "WSProxy_Test_" + testDE_Key.substring(0, 8);

    var fields = [
        { "Name": "SubscriberKey", "FieldType": "Text", "MaxLength": 254, "IsPrimaryKey": true, "IsRequired": true },
        { "Name": "EmailAddress", "FieldType": "EmailAddress", "MaxLength": 254, "IsRequired": true },
        { "Name": "FirstName", "FieldType": "Text", "MaxLength": 50 },
        { "Name": "LastName", "FieldType": "Text", "MaxLength": 80 },
        { "Name": "Score", "FieldType": "Number" },
        { "Name": "CreatedDate", "FieldType": "Date" }
    ];

    var deConfig = {
        "CustomerKey": testDE_Key,
        "Name": deName,
        "Fields": fields
    };

    var res = api.createItem("DataExtension", deConfig);
    logResult("1. Create DE '" + deName + "'", res);

    if (res.Status !== "OK") {
        throw "DE creation failed — cannot continue tests.";
    }

    /* ========================================================
       STEP 2: Insert rows via createBatch
       ======================================================== */
    var rows = [
        {
            CustomerKey: testDE_Key,
            Properties: [
                { "Name": "SubscriberKey", "Value": "test_001" },
                { "Name": "EmailAddress", "Value": "alice@test.com" },
                { "Name": "FirstName", "Value": "Alice" },
                { "Name": "LastName", "Value": "Martin" },
                { "Name": "Score", "Value": "85" }
            ]
        },
        {
            CustomerKey: testDE_Key,
            Properties: [
                { "Name": "SubscriberKey", "Value": "test_002" },
                { "Name": "EmailAddress", "Value": "bob@test.com" },
                { "Name": "FirstName", "Value": "Bob" },
                { "Name": "LastName", "Value": "Dupont" },
                { "Name": "Score", "Value": "92" }
            ]
        },
        {
            CustomerKey: testDE_Key,
            Properties: [
                { "Name": "SubscriberKey", "Value": "test_003" },
                { "Name": "EmailAddress", "Value": "claire@test.com" },
                { "Name": "FirstName", "Value": "Claire" },
                { "Name": "LastName", "Value": "Bernard" },
                { "Name": "Score", "Value": "78" }
            ]
        }
    ];

    res = api.createBatch("DataExtensionObject", rows);
    logResult("2. Insert 3 rows (createBatch)", res);

    /* ========================================================
       STEP 3: Retrieve all rows
       ======================================================== */
    res = api.retrieve(
        "DataExtensionObject[" + testDE_Key + "]",
        ["SubscriberKey", "EmailAddress", "FirstName", "LastName", "Score"]
    );
    logResult("3. Retrieve all rows (" + (res.Results ? res.Results.length : 0) + " found)", res);

    /* ========================================================
       STEP 4: Retrieve with filter (Score > 80)
       ======================================================== */
    var filter = {
        Property: "Score",
        SimpleOperator: "greaterThan",
        Value: "80"
    };

    res = api.retrieve(
        "DataExtensionObject[" + testDE_Key + "]",
        ["SubscriberKey", "FirstName", "Score"],
        filter
    );
    logResult("4. Filtered retrieve Score > 80 (" + (res.Results ? res.Results.length : 0) + " found)", res);

    /* ========================================================
       STEP 5: Update a row (upsert via UpdateAdd)
       ======================================================== */
    var updateProps = {
        CustomerKey: testDE_Key,
        Properties: [
            { "Name": "SubscriberKey", "Value": "test_001" },
            { "Name": "LastName", "Value": "Martin-Updated" },
            { "Name": "Score", "Value": "99" }
        ]
    };

    var updateOptions = {
        SaveOptions: [{
            PropertyName: '*',
            SaveAction: 'UpdateAdd'
        }]
    };

    res = api.updateItem("DataExtensionObject", updateProps, updateOptions);
    logResult("5. Update row test_001 (LastName + Score)", res);

    /* ========================================================
       STEP 6: Verify update — retrieve the updated row
       ======================================================== */
    res = api.retrieve(
        "DataExtensionObject[" + testDE_Key + "]",
        ["SubscriberKey", "LastName", "Score"],
        {
            Property: "SubscriberKey",
            SimpleOperator: "equals",
            Value: "test_001"
        }
    );
    logResult("6. Verify update on test_001", res);

    if (res.Status === "OK" && res.Results.length > 0) {
        var props = res.Results[0].Properties;
        for (var p = 0; p < props.length; p++) {
            log.push("  " + props[p].Name + " = " + props[p].Value);
        }
    }

    /* ========================================================
       STEP 7: Delete a single row
       ======================================================== */
    res = api.deleteItem("DataExtensionObject", {
        CustomerKey: testDE_Key,
        Keys: [{ Name: "SubscriberKey", Value: "test_003" }]
    });
    logResult("7. Delete row test_003", res);

    /* ========================================================
       STEP 8: Retrieve remaining rows (should be 2)
       ======================================================== */
    res = api.retrieve(
        "DataExtensionObject[" + testDE_Key + "]",
        ["SubscriberKey", "FirstName"]
    );
    logResult("8. Final row count: " + (res.Results ? res.Results.length : 0), res);

    /* ========================================================
       STEP 9: Describe the DataExtension object (metadata)
       ======================================================== */
    res = api.describe("DataExtension");
    var retrievableCount = 0;
    if (res.Results) {
        for (var d = 0; d < res.Results.length; d++) {
            if (res.Results[d].IsRetrievable) retrievableCount++;
        }
    }
    logResult("9. Describe DataExtension (" + retrievableCount + " retrievable props)", res);

    /* ========================================================
       STEP 10: Retrieve DE field definitions
       ======================================================== */
    res = api.retrieve(
        "DataExtensionField",
        ["Name", "FieldType", "MaxLength", "IsPrimaryKey", "IsRequired"],
        {
            Property: "DataExtension.CustomerKey",
            SimpleOperator: "equals",
            Value: testDE_Key
        }
    );
    logResult("10. Retrieve field definitions (" + (res.Results ? res.Results.length : 0) + " fields)", res);

    if (res.Status === "OK") {
        for (var f = 0; f < res.Results.length; f++) {
            var fld = res.Results[f];
            log.push("  " + fld.Name + " | " + fld.FieldType + " | PK:" + fld.IsPrimaryKey + " | Required:" + fld.IsRequired);
        }
    }

    /* ========================================================
       STEP 11: Clear all data from DE (performItem)
       ======================================================== */
    res = api.performItem("DataExtension", { CustomerKey: testDE_Key }, "ClearData", {});
    logResult("11. ClearData (performItem)", res);

    /* ========================================================
       STEP 12: Delete the test DE (cleanup)
       ======================================================== */
    var objReq = api.retrieve("DataExtension", ["ObjectID"], {
        Property: "CustomerKey",
        SimpleOperator: "equals",
        Value: testDE_Key
    });

    if (objReq.Status === "OK" && objReq.Results.length > 0) {
        res = api.deleteItem("DataExtension", { "ObjectID": objReq.Results[0].ObjectID });
        logResult("12. Delete test DE (cleanup)", res);
    } else {
        log.push("[SKIP] 12. Could not find DE to delete");
    }

} catch (e) {
    log.push("[EXCEPTION] " + Stringify(e));

    // Attempt cleanup on failure
    if (testDE_Key) {
        try {
            var cleanup = api.retrieve("DataExtension", ["ObjectID"], {
                Property: "CustomerKey",
                SimpleOperator: "equals",
                Value: testDE_Key
            });
            if (cleanup.Status === "OK" && cleanup.Results.length > 0) {
                api.deleteItem("DataExtension", { "ObjectID": cleanup.Results[0].ObjectID });
                log.push("[CLEANUP] Test DE deleted");
            }
        } catch (ce) {
            log.push("[CLEANUP FAILED] " + Stringify(ce));
        }
    }
}

/* ========================================================
   OUTPUT RESULTS
   ======================================================== */
Write("<h2>WSProxy Test Results</h2>");
Write("<pre>");
for (var i = 0; i < log.length; i++) {
    Write(log[i] + "\n");
}
Write("</pre>");

</script>
