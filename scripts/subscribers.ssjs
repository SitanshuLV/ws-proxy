<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// SUBSCRIBER OPERATIONS
// ============================================================

// ------ CREATE a subscriber ------
function createSubscriber(emailAddress, subscriberKey, listIDs) {
    var config = {
        EmailAddress: emailAddress,
        SubscriberKey: subscriberKey || emailAddress
    };

    if (listIDs && listIDs.length > 0) {
        config.Lists = [];
        for (var i = 0; i < listIDs.length; i++) {
            config.Lists.push({ ID: listIDs[i], Status: "Active" });
        }
    }

    try {
        var res = api.createItem("Subscriber", config);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ CREATE or UPDATE subscriber (upsert) ------
function upsertSubscriber(emailAddress, subscriberKey, listIDs) {
    var config = {
        EmailAddress: emailAddress,
        SubscriberKey: subscriberKey || emailAddress
    };

    if (listIDs && listIDs.length > 0) {
        config.Lists = [];
        for (var i = 0; i < listIDs.length; i++) {
            config.Lists.push({ ID: listIDs[i], Status: "Active" });
        }
    }

    var options = {
        SaveOptions: [{ PropertyName: '*', SaveAction: 'UpdateAdd' }]
    };

    try {
        var res = api.createItem("Subscriber", config, options);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ BATCH CREATE subscribers ------
function createSubscribersBatch(subscribers) {
    // subscribers = [{ EmailAddress, SubscriberKey, ListIDs[] }]
    var items = [];
    for (var s = 0; s < subscribers.length; s++) {
        var config = {
            EmailAddress: subscribers[s].EmailAddress,
            SubscriberKey: subscribers[s].SubscriberKey || subscribers[s].EmailAddress
        };
        if (subscribers[s].ListIDs && subscribers[s].ListIDs.length > 0) {
            config.Lists = [];
            for (var l = 0; l < subscribers[s].ListIDs.length; l++) {
                config.Lists.push({ ID: subscribers[s].ListIDs[l], Status: "Active" });
            }
        }
        items.push(config);
    }

    var options = {
        SaveOptions: [{ PropertyName: '*', SaveAction: 'UpdateAdd' }]
    };

    try {
        var res = api.createBatch("Subscriber", items, options);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE subscriber by SubscriberKey ------
function getSubscriber(subscriberKey) {
    try {
        var res = api.retrieve(
            "Subscriber",
            ["SubscriberKey", "EmailAddress", "Status", "CreatedDate", "UnsubscribedDate"],
            {
                Property: "SubscriberKey",
                SimpleOperator: "equals",
                Value: subscriberKey
            }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, subscriber: res.Results[0] };
        }
        return { success: false, error: "Subscriber not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE subscriber by Email ------
function getSubscriberByEmail(emailAddress) {
    try {
        var res = api.retrieve(
            "Subscriber",
            ["SubscriberKey", "EmailAddress", "Status", "CreatedDate"],
            {
                Property: "EmailAddress",
                SimpleOperator: "equals",
                Value: emailAddress
            }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, subscriber: res.Results[0] };
        }
        return { success: false, error: "Subscriber not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE subscribers by Status ------
function getSubscribersByStatus(status) {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("Subscriber", ["SubscriberKey", "EmailAddress", "Status", "CreatedDate"], {
                    Property: "Status",
                    SimpleOperator: "equals",
                    Value: status
                })
                : api.getNextBatch("Subscriber", reqID);

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
        return { success: true, subscribers: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ UPDATE subscriber email ------
function updateSubscriberEmail(subscriberKey, newEmail) {
    try {
        var res = api.updateItem("Subscriber", {
            SubscriberKey: subscriberKey,
            EmailAddress: newEmail
        });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ UPDATE subscriber status on a list ------
function updateSubscriberListStatus(subscriberKey, listID, status) {
    // status: "Active", "Unsubscribed", "Held"
    try {
        var res = api.updateItem("Subscriber", {
            SubscriberKey: subscriberKey,
            Lists: [{
                ID: listID,
                Status: status
            }]
        });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ UNSUBSCRIBE subscriber from a list ------
function unsubscribeFromList(subscriberKey, listID) {
    return updateSubscriberListStatus(subscriberKey, listID, "Unsubscribed");
}

// ------ DELETE a subscriber ------
function deleteSubscriber(subscriberKey) {
    try {
        var sub = getSubscriber(subscriberKey);
        if (!sub.success) return sub;

        var res = api.deleteItem("Subscriber", {
            SubscriberKey: subscriberKey
        });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE list membership for a subscriber ------
function getSubscriberLists(subscriberKey) {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("ListSubscriber", ["ListID", "SubscriberKey", "Status", "CreatedDate"], {
                    Property: "SubscriberKey",
                    SimpleOperator: "equals",
                    Value: subscriberKey
                })
                : api.getNextBatch("ListSubscriber", reqID);

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
        return { success: true, lists: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Create subscriber ---
var result = createSubscriber("jane@example.com", "jane_001", [123, 456]);

// --- Upsert subscriber ---
var result = upsertSubscriber("jane@example.com", "jane_001", [789]);

// --- Get subscriber ---
var sub = getSubscriber("jane_001");
Write("Email: " + sub.subscriber.EmailAddress + ", Status: " + sub.subscriber.Status);

// --- Update email ---
updateSubscriberEmail("jane_001", "jane.new@example.com");

// --- Unsubscribe from list ---
unsubscribeFromList("jane_001", 123);

// --- Check which lists a subscriber belongs to ---
var lists = getSubscriberLists("jane_001");
for (var i = 0; i < lists.lists.length; i++) {
    Write("List " + lists.lists[i].ListID + ": " + lists.lists[i].Status + "<br>");
}

// --- Batch create ---
var subs = [
    { EmailAddress: "a@test.com", SubscriberKey: "a_001", ListIDs: [123] },
    { EmailAddress: "b@test.com", SubscriberKey: "b_001", ListIDs: [123] }
];
var result = createSubscribersBatch(subs);
*/

</script>
