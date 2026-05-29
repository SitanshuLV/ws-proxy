<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// EMAIL OPERATIONS
// ============================================================

// ------ CREATE an email ------
function createEmail(name, subject, htmlBody, categoryID) {
    var config = {
        Name: name,
        CustomerKey: String(Platform.Function.GUID()).toUpperCase(),
        Subject: subject,
        HTMLBody: htmlBody,
        IsHTMLPaste: true
    };
    if (categoryID) config.CategoryID = categoryID;

    try {
        var res = api.createItem("Email", config);
        if (res.Status === "OK") {
            return { success: true, emailID: res.Results[0].NewID, customerKey: config.CustomerKey, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE email by ID ------
function getEmailByID(emailID) {
    try {
        var res = api.retrieve("Email", ["ID", "Name", "Subject", "HTMLBody", "CustomerKey", "CreatedDate", "ModifiedDate", "CategoryID", "Status"], {
            Property: "ID",
            SimpleOperator: "equals",
            Value: emailID
        });
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, email: res.Results[0] };
        }
        return { success: false, error: "Email not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE email by Name ------
function getEmailByName(emailName) {
    try {
        var res = api.retrieve("Email", ["ID", "Name", "Subject", "CustomerKey", "CreatedDate", "Status"], {
            Property: "Name",
            SimpleOperator: "equals",
            Value: emailName
        });
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, email: res.Results[0] };
        }
        return { success: false, error: "Email not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE all emails (paginated) ------
function getAllEmails() {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("Email", ["ID", "Name", "Subject", "CustomerKey", "CreatedDate", "Status"], {
                    Property: "Name",
                    SimpleOperator: "isNotNull",
                    Value: " "
                })
                : api.getNextBatch("Email", reqID);

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
        return { success: true, emails: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ UPDATE an email ------
function updateEmail(emailID, updates) {
    // updates = { Name, Subject, HTMLBody }
    var config = { ID: emailID };
    if (updates.Name) config.Name = updates.Name;
    if (updates.Subject) config.Subject = updates.Subject;
    if (updates.HTMLBody) config.HTMLBody = updates.HTMLBody;

    try {
        var res = api.updateItem("Email", config);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ DELETE an email ------
function deleteEmail(emailID) {
    try {
        var res = api.deleteItem("Email", { ID: emailID });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ PERFORM content check on an email ------
function checkEmailContent(emailID) {
    try {
        var res = api.performItem("EmailContentCheck", { ID: emailID }, "start", {});
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Create an email ---
var html = "<html><body><h1>Hello %%FirstName%%</h1><p>Welcome!</p></body></html>";
var result = createEmail("Welcome_Email_v1", "Welcome to our platform!", html);
Write("Email ID: " + result.emailID);

// --- Get email details ---
var email = getEmailByID(123);
Write("Subject: " + email.email.Subject);

// --- Update subject ---
updateEmail(123, { Subject: "Updated: Welcome to our platform!" });

// --- Check email content ---
var check = checkEmailContent(123);
Write(Stringify(check));

// --- List all emails ---
var all = getAllEmails();
Write("Total emails: " + all.count);

// --- Delete email ---
deleteEmail(123);
*/

</script>
