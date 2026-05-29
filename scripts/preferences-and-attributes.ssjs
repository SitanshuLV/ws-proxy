<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// ATTRIBUTE OPERATIONS
// ============================================================

// ------ RETRIEVE all attributes ------
function getAllAttributes() {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("Attribute",
                    ["ID", "Name", "Description", "AttributeType", "CreatedDate", "ModifiedDate", "ObjectID"],
                    { Property: "Name", SimpleOperator: "isNotNull", Value: " " }
                )
                : api.getNextBatch("Attribute", reqID);

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
        return { success: true, attributes: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE attribute by Name ------
function getAttributeByName(name) {
    try {
        var res = api.retrieve("Attribute",
            ["ID", "Name", "Description", "AttributeType", "ObjectID"],
            { Property: "Name", SimpleOperator: "equals", Value: name }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, attribute: res.Results[0] };
        }
        return { success: false, error: "Attribute not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ CREATE an attribute ------
function createAttribute(name, description, attributeType) {
    // attributeType: "text", "number", "date", "boolean", etc.
    var config = {
        Name: name,
        Description: description || "",
        AttributeType: attributeType || "text"
    };

    try {
        var res = api.createItem("Attribute", config);
        if (res.Status === "OK") {
            return { success: true, attributeID: res.Results[0].NewID, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ UPDATE an attribute ------
function updateAttribute(attributeID, updates) {
    // updates = { Name, Description }
    var config = { ID: attributeID };
    if (updates.Name) config.Name = updates.Name;
    if (updates.Description) config.Description = updates.Description;

    try {
        var res = api.updateItem("Attribute", config);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ DELETE an attribute ------
function deleteAttribute(attributeID) {
    try {
        var res = api.deleteItem("Attribute", { ID: attributeID });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// ATTRIBUTE GROUP OPERATIONS
// ============================================================

// ------ RETRIEVE all attribute groups ------
function getAllAttributeGroups() {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("AttributeGroup",
                    ["ObjectID", "Name", "Description", "CreatedDate", "ModifiedDate"],
                    { Property: "Name", SimpleOperator: "isNotNull", Value: " " }
                )
                : api.getNextBatch("AttributeGroup", reqID);

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
        return { success: true, attributeGroups: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE attribute group by Name ------
function getAttributeGroupByName(name) {
    try {
        var res = api.retrieve("AttributeGroup",
            ["ObjectID", "Name", "Description", "CreatedDate"],
            { Property: "Name", SimpleOperator: "equals", Value: name }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, attributeGroup: res.Results[0] };
        }
        return { success: false, error: "AttributeGroup not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ CREATE an attribute group ------
function createAttributeGroup(name, description) {
    var config = {
        Name: name,
        Description: description || ""
    };

    try {
        var res = api.createItem("AttributeGroup", config);
        if (res.Status === "OK") {
            return { success: true, attributeGroupID: res.Results[0].NewID, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// SUBSCRIBER ATTRIBUTE / PREFERENCE OPERATIONS
// ============================================================

// ------ GET subscriber preferences/attributes ------
function getSubscriberPreferences(subscriberKey) {
    try {
        var res = api.retrieve("SubscriberAttribute",
            ["Attribute.Name", "Value", "SubscriberKey"],
            { Property: "SubscriberKey", SimpleOperator: "equals", Value: subscriberKey }
        );
        if (res.Status === "OK") {
            var prefs = {};
            for (var i = 0; i < res.Results.length; i++) {
                var attrName = res.Results[i]["Attribute.Name"];
                prefs[attrName] = res.Results[i].Value;
            }
            return { success: true, preferences: prefs, count: res.Results.length };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ SET subscriber attribute/preference ------
function setSubscriberAttribute(subscriberKey, attributeName, value) {
    var config = {
        SubscriberKey: subscriberKey,
        Attributes: [
            { Name: attributeName, Value: value }
        ]
    };

    try {
        var res = api.updateItem("Subscriber", config);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ BULK set subscriber attributes ------
function bulkSetSubscriberAttributes(subscriberKey, attributesObject) {
    // attributesObject = { attr1: "value1", attr2: "value2" }
    var attributes = [];
    for (var key in attributesObject) {
        attributes.push({ Name: key, Value: attributesObject[key] });
    }

    var config = {
        SubscriberKey: subscriberKey,
        Attributes: attributes
    };

    try {
        var res = api.updateItem("Subscriber", config);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// PREFERENCE CENTER OPERATIONS
// ============================================================

// ------ RETRIEVE preference centers ------
function getPreferenceCenters() {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("PreferenceCenter",
                    ["ObjectID", "Name", "Description", "CreatedDate", "ModifiedDate", "Status"],
                    { Property: "Name", SimpleOperator: "isNotNull", Value: " " }
                )
                : api.getNextBatch("PreferenceCenter", reqID);

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
        return { success: true, preferenceCenters: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE preference center by Name ------
function getPreferenceCenterByName(name) {
    try {
        var res = api.retrieve("PreferenceCenter",
            ["ObjectID", "Name", "Description", "Status"],
            { Property: "Name", SimpleOperator: "equals", Value: name }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, preferenceCenter: res.Results[0] };
        }
        return { success: false, error: "PreferenceCenter not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ GET preference center URL for subscriber ------
function getPreferenceCenterURL(preferenceCenterID, subscriberKey) {
    // This constructs the URL pattern; actual implementation may vary by instance
    try {
        var url = "/cloud/preference-center/" + preferenceCenterID + "?sk=" + encodeURIComponent(subscriberKey);
        return { success: true, url: url };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Get all attributes ---
var attrs = getAllAttributes();
Write("Total attributes: " + attrs.count);

// --- Create an attribute ---
var attr = createAttribute("Preference_Newsletter", "Newsletter preference", "boolean");

// --- Get subscriber preferences ---
var prefs = getSubscriberPreferences("subscriber_key_123");
Write("Email Preference: " + prefs.preferences.EmailPreference);

// --- Set subscriber attribute ---
setSubscriberAttribute("subscriber_key_123", "PreferenceNewsletter", "true");

// --- Bulk set attributes ---
var attrMap = {
    Preference_Newsletter: "true",
    Preference_SMS: "false",
    Preference_PushNotification: "true"
};
bulkSetSubscriberAttributes("subscriber_key_123", attrMap);

// --- Get all preference centers ---
var centers = getPreferenceCenters();
for (var i = 0; i < centers.preferenceCenters.length; i++) {
    Write(centers.preferenceCenters[i].Name + "<br>");
}

// --- Get preference center URL ---
var pcURL = getPreferenceCenterURL(1, "subscriber_key_123");
Write("URL: " + pcURL.url);
*/

</script>
