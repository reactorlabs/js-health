const fs = require("fs");
const async = require("async");
const data = require("./data.js");
const git = require("./git.js");

let langspec = null;

let Q = null;

let errors = 0;
let projects = 0;
let commits = 0;
let files = 0;
let snapshots = 0;

let snapshotHashes = {};
let commitHashes = {};


function report() {
    console.log(
	"P: " + projects +
	" E: " + errors +
	" C: " + commits +
	" F: " + files +
	" S: " + snapshots
    );
   
}



module.exports = {

    Verify : () => {
        let args = process.argv.slice(3);
        data.ParseArguments(args);
	for (let i = 0; i < args.length; ++i) {
	    let arg = args[i];
	    if (arg.startsWith("--language=")) {
		let lang = arg.substr(11);
		if (langspec !== null) {
		    console.log("Language can be specified only once");
		    console.log("read README.md");
		    process.exit(-1);
		}
		langspec = require("../languages/" + lang + ".js");
	    }
	}
	Q = async.queue(VerifyProject, 5);
	Q.drain = () => {
	    report();
	    console.log("DONE.");
	    process.exit();
	}
	ReadProjects();
	setInterval(report, 10000);
    }
}

function ReadProjects() {
    console.log("reading projects...");
    let projectsFolder = data.OutputDir() + "projects";
    let dirs = fs.readdirSync(projectsFolder);
    for (let d of dirs) {
	if (d === "." || d == "..")
	    continue;
	for (let p of fs.readdirSync(projectsFolder + "/" + d)) {
	    if (p === "." || p === "..")
		continue;
	    Q.push({ name: p});
	}
    }
    console.log("verifying...");
}




/** Verifies that the stored data for the project are complete and valid.
 */
function VerifyProject(fullName, callback) {
    fullName = data.Project.Demangle(fullName.name);
    //console.log(fullName);
//    ++projects;
//    return callback();
    let callback2 = (err) => {
	if (err) {
	    console.log(err);
	    ++errors;
	}
	++projects;
	callback();
    }

    let project = new data.Project(fullName);
    project.exists((does) => {
	if (! does)
	    return callback2("Project not found");
	project.load((err) => {
	    if (err)
		return callback2("Cannot read project info");
	    // since we only work with main branch for now, only verify the main branch
	    VerifyBranch(project, project.metadata.default_branch, callback2);
	    // TODO add more branches when we do analyze them
	});
    });
}


/** Verifying a branch simply means to see that the branch has its latest commit recorded in the project info and then verifying this latest commit.
 */
function VerifyBranch(project, branchName, callback) {
    let b = project.branches[branchName];
    if (b === undefined)
	return callback("Unknown branch " + branchName);
    VerifyCommit(project, b, callback);
}

/** Verifying commit means two things - verifying all its snapshots and verifying all its parent commits.
  */
function VerifyCommit(project, commitHash, callback) {
    if (commitHashes[commitHash])
	return callback();
    commitHashes[commitHash] = true;
    let commit = new data.Commit(commitHash);
    commit.exists((does) => {
	if (! does)
	    return callback("Unknown commit " + commitHash);
	commit.load((err) => {
	    if (err)
		return callback("Cannot read commit info " + commitHash + err);
	    // now that we have the commit's info, verify its parent commits and verify its snapshots
            let f = (index) => {
		if (index >= commit.parents.length)
		    return VerifySnapshots(project, commit, callback);
		// repair fix when initial commits have empty string as a parent.
		if (commit.parents[index] === "" && commit.parents.length === 1) {
		    commit.parents = [];
		    //commit.hash += "fixed";
		    commit.save((err) => {
			if (err)
			    return callback("Cannot repair commit");
		        VerifySnapshots(project, commit, callback);
		    })
		} else {
		    VerifyCommit(project, commit.parents[index], (err) => {
		        // if the parent commit fails, no need to check further
		        if (err)
			    return callback(err);
		        // otherwise see if there are other parents
		        f(index + 1);
		    });
		}
	    }
	    f(0);
	})
    })

}

/** For given commit, verifies that snapshots belonging to the specified language are stored.
 */
function VerifySnapshots(project, commit, callback) {
    let f = (index) => {
	// if we have seen all files, we are done
        if (index >= commit.files.length) {
	    ++commits; 
	    return callback();
	}
	// otherwise take the index-th snapshot
	let snapshot = commit.files[index];
	if (snapshotHashes[snapshot.hash] === undefined) {
	    snapshotHashes[snapshot.hash] = true;
	    ++files;
	    if (snapshot.hash !== "0000000000000000000000000000000000000000" && langspec.TrackFile(null, snapshot.path)) {
		// check that the file exists
	        data.Snapshot.Exists(snapshot.hash, (does) => {
		    if (! does)
		        return callback("Cannot find snapshot " + snapshot.hash);
		    // check that the hash is valid
		    let path = data.Snapshot.GetPath_(snapshot.hash);
		    
		    git.HashObject(path.dir + path.filename, (err, hash) => {
			if (err)
			    return callback("Unable to obtain hash for snapshot " + snapshot.hash + err);
			if (hash !== snapshot.hash)
			    return callback("Hash for snapshot " + snapshot.hash + " does not match its contents.");
			++snapshots;
			f(index + 1);
		    })
	        });
		return;
	    }
	}
        f(index + 1);
    }
    f(0);
}

