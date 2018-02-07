const data = require("./data.js");


module.exports = {

    Verify : () => {
        let args = process.argv.slice(3);
        data.ParseArguments(args);
    }
}


function VerifyProject(fullName, callback) {
    let project = new data.Project(fullName);
    project.verificationErrors = [];
    // first check that the project exists
    project.exists((does) => {
        if (! does) {
            project.verificationErrors.push({ type: "project", fullName : fullName, msg : "not found" });
            return callback(true);
        }
        project.load((err) => {
            if (err) {
                project.verificationErrors.push({ type: "project", fullName : fullName, msg : "invalid data format" });
                return callback(true);
            }
            VerifyBranch(project, project.getMetadata.default_branch, (err) => {
                if (err)
                    return callback(true);
                // otherwise we are done, and no errors were found while checking the project
                callback(null);
            })

        })


    })


}


/** Check that the project contains the commit captured for the branch, then check the commit itself.
 */
function VerifyBranch(project, branchName, callback) {

}

/** Check that the commit json file exists and can be downloaded, check that it has the required fields. Then check that all traced files snapshots exist and finally check the parent commits. */
function VerifyCommit(project, commitHash, callback) {

}

/** Just check that the snapshot file exists.  */
function VerifySnapshot(project, snapshotHash, callback) {

}

