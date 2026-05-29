<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// CAMPAIGN OPERATIONS
// ============================================================

// ------ CREATE a campaign ------
function createCampaign(name, description, categoryID) {
    var config = {
        Name: name,
        Description: description || "",
        CategoryID: categoryID || 0,
        Status: "Active"
    };

    try {
        var res = api.createItem("Campaign", config);
        if (res.Status === "OK") {
            return { success: true, campaignID: res.Results[0].NewID, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE campaign by ID ------
function getCampaignByID(campaignID) {
    try {
        var res = api.retrieve("Campaign",
            ["ID", "Name", "Description", "Status", "CreatedDate", "ModifiedDate", "CategoryID"],
            { Property: "ID", SimpleOperator: "equals", Value: campaignID }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, campaign: res.Results[0] };
        }
        return { success: false, error: "Campaign not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE campaign by Name ------
function getCampaignByName(name) {
    try {
        var res = api.retrieve("Campaign",
            ["ID", "Name", "Description", "Status", "CreatedDate"],
            { Property: "Name", SimpleOperator: "equals", Value: name }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, campaign: res.Results[0] };
        }
        return { success: false, error: "Campaign not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE all campaigns ------
function getAllCampaigns() {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("Campaign",
                    ["ID", "Name", "Description", "Status", "CreatedDate", "ModifiedDate"],
                    { Property: "Name", SimpleOperator: "isNotNull", Value: " " }
                )
                : api.getNextBatch("Campaign", reqID);

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
        return { success: true, campaigns: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ UPDATE campaign ------
function updateCampaign(campaignID, updates) {
    // updates = { Name, Description, Status }
    var config = { ID: campaignID };
    if (updates.Name) config.Name = updates.Name;
    if (updates.Description) config.Description = updates.Description;
    if (updates.Status) config.Status = updates.Status;

    try {
        var res = api.updateItem("Campaign", config);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ DELETE campaign ------
function deleteCampaign(campaignID) {
    try {
        var res = api.deleteItem("Campaign", { ID: campaignID });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// BUSINESS UNIT / CLIENT OPERATIONS
// ============================================================

// ------ GET current Business Unit ID ------
function getCurrentBusinessUnitID() {
    try {
        var buID = Platform.Function.AuthenticatedMemberID();
        return { success: true, businessUnitID: buID };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE all business units ------
function getAllBusinessUnits() {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("BusinessUnit",
                    ["ID", "Name", "ParentID", "Description", "CreatedDate", "Status"],
                    { Property: "Name", SimpleOperator: "isNotNull", Value: " " }
                )
                : api.getNextBatch("BusinessUnit", reqID);

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
        return { success: true, businessUnits: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE business unit by ID ------
function getBusinessUnitByID(buID) {
    try {
        var res = api.retrieve("BusinessUnit",
            ["ID", "Name", "ParentID", "Description", "CreatedDate", "Status"],
            { Property: "ID", SimpleOperator: "equals", Value: buID }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, businessUnit: res.Results[0] };
        }
        return { success: false, error: "Business Unit not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE business unit by Name ------
function getBusinessUnitByName(name) {
    try {
        var res = api.retrieve("BusinessUnit",
            ["ID", "Name", "ParentID", "Description", "Status"],
            { Property: "Name", SimpleOperator: "equals", Value: name }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, businessUnit: res.Results[0] };
        }
        return { success: false, error: "Business Unit not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ SWITCH to different Business Unit context ------
function switchToBusinessUnit(buID) {
    try {
        api.setClientId({ "ID": buID });
        return { success: true, message: "Switched to Business Unit " + buID };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RESET to default Business Unit ------
function resetToDefaultBusinessUnit() {
    try {
        api.resetClientIds();
        return { success: true, message: "Reset to default Business Unit" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ OPERATION in different Business Unit ------
function operateInBusinessUnit(buID, operation) {
    // operation = function that uses api
    try {
        api.setClientId({ "ID": buID });
        var result = operation();
        api.resetClientIds();
        return result;
    } catch (e) {
        api.resetClientIds();
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE Business Unit hierarchy ------
function getBusinessUnitHierarchy() {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("BusinessUnit",
                    ["ID", "Name", "ParentID"],
                    { Property: "Name", SimpleOperator: "isNotNull", Value: " " }
                )
                : api.getNextBatch("BusinessUnit", reqID);

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

        // Build hierarchy map
        var hierarchy = {};
        for (var j = 0; j < allResults.length; j++) {
            var bu = allResults[j];
            if (!hierarchy[bu.ParentID]) hierarchy[bu.ParentID] = [];
            hierarchy[bu.ParentID].push(bu);
        }

        return { success: true, businessUnits: allResults, hierarchy: hierarchy, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Create a campaign ---
var campaign = createCampaign("Q1_2025_Email", "Q1 email campaign", 0);
Write("Campaign ID: " + campaign.campaignID);

// --- Get all campaigns ---
var campaigns = getAllCampaigns();
Write("Total campaigns: " + campaigns.count);

// --- Get current BU ID ---
var bu = getCurrentBusinessUnitID();
Write("Current BU ID: " + bu.businessUnitID);

// --- Get all business units ---
var allBUs = getAllBusinessUnits();
for (var i = 0; i < allBUs.businessUnits.length; i++) {
    Write(allBUs.businessUnits[i].Name + " (ID: " + allBUs.businessUnits[i].ID + ")<br>");
}

// --- Switch to another BU and retrieve DEs ---
switchToBusinessUnit(7654321);
var otherBUDEs = api.retrieve("DataExtension", ["Name", "CustomerKey"],
    { Property: "CustomerKey", SimpleOperator: "isNotNull", Value: " " });
resetToDefaultBusinessUnit();

// --- Get BU hierarchy ---
var hierarchy = getBusinessUnitHierarchy();
Write("Total Business Units: " + hierarchy.count);
*/

</script>
