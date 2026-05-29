<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// LIST OPERATIONS
// ============================================================

// ------ CREATE a list ------
function createList(listName, description, type) {
    // type: "Public", "Private", "SalesForce"
    var config = {
        ListName: listName,
        Description: description || "",
        Type: type || "Public"
    };

    try {
        var res = api.createItem("List", config);
        if (res.Status === "OK") {
            return { success: true, listID: res.Results[0].NewID, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE list by Name ------
function getListByName(listName) {
    try {
        var res = api.retrieve("List", ["ID", "ListName", "Description", "Type", "CustomerKey"], {
            Property: "ListName",
            SimpleOperator: "equals",
            Value: listName
        });
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, list: res.Results[0] };
        }
        return { success: false, error: "List not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE list by ID ------
function getListByID(listID) {
    try {
        var res = api.retrieve("List", ["ID", "ListName", "Description", "Type", "CustomerKey"], {
            Property: "ID",
            SimpleOperator: "equals",
            Value: listID
        });
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, list: res.Results[0] };
        }
        return { success: false, error: "List not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE all lists ------
function getAllLists() {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("List", ["ID", "ListName", "Description", "Type", "CustomerKey"], {
                    Property: "ListName",
                    SimpleOperator: "isNotNull",
                    Value: " "
                })
                : api.getNextBatch("List", reqID);

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

// ------ RETRIEVE lists by Type ------
function getListsByType(type) {
    try {
        var res = api.retrieve("List", ["ID", "ListName", "Description", "Type"], {
            Property: "Type",
            SimpleOperator: "equals",
            Value: type
        });
        if (res.Status === "OK") {
            return { success: true, lists: res.Results, count: res.Results.length };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ UPDATE a list ------
function updateList(listID, updates) {
    // updates = { ListName, Description, Type }
    var config = { ID: listID };
    if (updates.ListName) config.ListName = updates.ListName;
    if (updates.Description) config.Description = updates.Description;
    if (updates.Type) config.Type = updates.Type;

    try {
        var res = api.updateItem("List", config);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ DELETE a list ------
function deleteList(listID) {
    try {
        var res = api.deleteItem("List", { ID: listID });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ GET subscribers on a list ------
function getListSubscribers(listID) {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("ListSubscriber", ["SubscriberKey", "ListID", "Status", "CreatedDate"], {
                    Property: "ListID",
                    SimpleOperator: "equals",
                    Value: listID
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
        return { success: true, subscribers: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ GET active subscriber count on a list ------
function getListActiveCount(listID) {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("ListSubscriber", ["SubscriberKey"], {
                    LeftOperand: {
                        Property: "ListID",
                        SimpleOperator: "equals",
                        Value: listID
                    },
                    LogicalOperator: "AND",
                    RightOperand: {
                        Property: "Status",
                        SimpleOperator: "equals",
                        Value: "Active"
                    }
                })
                : api.getNextBatch("ListSubscriber", reqID);

            if (data != null && data.Status === "OK") {
                moreData = data.HasMoreRows;
                reqID = data.RequestID;
                allResults = allResults.concat(data.Results);
            } else {
                moreData = false;
            }
        }
        return { success: true, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Create a list ---
var result = createList("VIP_Customers", "VIP customer list", "Public");
Write("List ID: " + result.listID);

// --- Get all lists ---
var all = getAllLists();
for (var i = 0; i < all.lists.length; i++) {
    Write(all.lists[i].ListName + " (ID: " + all.lists[i].ID + ", Type: " + all.lists[i].Type + ")<br>");
}

// --- Get subscribers on a list ---
var subs = getListSubscribers(123);
Write("Total subscribers: " + subs.count);

// --- Get active count ---
var active = getListActiveCount(123);
Write("Active subscribers: " + active.count);

// --- Delete list ---
deleteList(123);
*/

</script>
