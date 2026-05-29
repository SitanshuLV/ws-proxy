<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// TRIGGERED SEND DEFINITION OPERATIONS
// ============================================================

// ------ CREATE a Triggered Send Definition ------
function createTSD(name, emailID, listCustomerKey, sendClassKey, senderProfileKey) {
    var config = {
        Name: name,
        CustomerKey: Platform.Function.GUID(),
        SendClassification: {
            CustomerKey: sendClassKey || "Default Transactional"
        },
        Email: {
            ID: emailID
        },
        List: {
            CustomerKey: listCustomerKey
        },
        SenderProfile: {
            CustomerKey: senderProfileKey || "default"
        }
    };

    try {
        var res = api.createItem("TriggeredSendDefinition", config);
        if (res.Status === "OK") {
            return { success: true, customerKey: config.CustomerKey, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE Triggered Send Definitions ------
function getTSDs(statusFilter) {
    var cols = ["Name", "CustomerKey", "TriggeredSendStatus", "CreatedDate", "Email.ID"];
    var filter = null;

    if (statusFilter) {
        filter = {
            Property: "TriggeredSendStatus",
            SimpleOperator: "equals",
            Value: statusFilter  // "Active", "Inactive", "New", "Moved", "Deleted"
        };
    }

    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data;
            if (reqID == null) {
                data = filter
                    ? api.retrieve("TriggeredSendDefinition", cols, filter)
                    : api.retrieve("TriggeredSendDefinition", cols);
            } else {
                data = api.getNextBatch("TriggeredSendDefinition", reqID);
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
        return { success: true, tsds: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE a single TSD by CustomerKey ------
function getTSD(customerKey) {
    try {
        var res = api.retrieve(
            "TriggeredSendDefinition",
            ["Name", "CustomerKey", "TriggeredSendStatus", "CreatedDate", "Email.ID"],
            {
                Property: "CustomerKey",
                SimpleOperator: "equals",
                Value: customerKey
            }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, tsd: res.Results[0] };
        }
        return { success: false, error: "TSD not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ START a Triggered Send Definition ------
function startTSD(customerKey) {
    try {
        var res = api.performItem("TriggeredSendDefinition", { CustomerKey: customerKey }, "start", {});
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ STOP a Triggered Send Definition ------
function stopTSD(customerKey) {
    try {
        var res = api.performItem("TriggeredSendDefinition", { CustomerKey: customerKey }, "stop", {});
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// TRIGGERED SEND (FIRE EMAIL) OPERATIONS
// ============================================================

// ------ SEND triggered email to one subscriber ------
function sendTriggeredEmail(tsdKey, emailAddress, subscriberKey, attributes) {
    var subscriber = {
        EmailAddress: emailAddress,
        SubscriberKey: subscriberKey || emailAddress
    };

    if (attributes) {
        subscriber.Attributes = [];
        for (var key in attributes) {
            subscriber.Attributes.push({ Name: key, Value: attributes[key] });
        }
    }

    var config = {
        TriggeredSendDefinition: {
            CustomerKey: tsdKey
        },
        Subscribers: [subscriber]
    };

    try {
        var res = api.createItem("TriggeredSend", config);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ SEND triggered email to multiple subscribers ------
function sendTriggeredEmailBatch(tsdKey, subscriberList) {
    // subscriberList = [{ EmailAddress, SubscriberKey, Attributes: { key: value } }]
    var subscribers = [];

    for (var s = 0; s < subscriberList.length; s++) {
        var sub = {
            EmailAddress: subscriberList[s].EmailAddress,
            SubscriberKey: subscriberList[s].SubscriberKey || subscriberList[s].EmailAddress
        };

        if (subscriberList[s].Attributes) {
            sub.Attributes = [];
            for (var key in subscriberList[s].Attributes) {
                sub.Attributes.push({ Name: key, Value: subscriberList[s].Attributes[key] });
            }
        }

        subscribers.push(sub);
    }

    var config = {
        TriggeredSendDefinition: {
            CustomerKey: tsdKey
        },
        Subscribers: subscribers
    };

    try {
        var res = api.createItem("TriggeredSend", config);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Create and start a TSD ---
var tsd = createTSD("Welcome_Email", 123188, "All Subscribers - 456", "Default Transactional", "default");
if (tsd.success) {
    startTSD(tsd.customerKey);
}

// --- Send a triggered email ---
var result = sendTriggeredEmail(
    "Welcome_Email_Key",
    "jane@example.com",
    "jane_001",
    { FirstName: "Jane", CompanyName: "Acme Corp" }
);

// --- Batch send ---
var result = sendTriggeredEmailBatch("Notification_Key", [
    { EmailAddress: "user1@test.com", SubscriberKey: "u1", Attributes: { FirstName: "Alice" } },
    { EmailAddress: "user2@test.com", SubscriberKey: "u2", Attributes: { FirstName: "Bob" } }
]);

// --- List all active TSDs ---
var active = getTSDs("Active");
for (var i = 0; i < active.tsds.length; i++) {
    Write(active.tsds[i].Name + " (" + active.tsds[i].CustomerKey + ")<br>");
}

// --- Stop a TSD ---
stopTSD("Welcome_Email_Key");
*/

</script>
