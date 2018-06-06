const async = require("async");
const request = require("request")
const fs = require("fs");
const readline = require("readline")
const mkdirp = require("mkdirp")
const tmp = require("tmp");
const child_process = require("child_process");

// helpers which should eventually go to utils

/** Creates a directory asynchronously. 
 */
function mkdir(where, name, callback) {
    fs.mkdir(where + "/" + name, (err) => {
        if (err && err.code != "EEXIST")
            callback(err);
        else 
            callback(null);
    });
}

module.exports = {

    download : function(settings) {
        let projectsFile = settings.filteredProjects;
        let outputDir = settings.outputDir;
        let apiTokens = settings.apiTokens;
        let numApiWorkers = settings.numApiWorkers;;
        let numDownloadWorkers = settings.numDownloadWorkers;

        projectOutputDir = outputDir + "/projects";
        snapshotOutputDir = outputDir + "/files";

        console.time("all");
        mkdirp.sync(projectOutputDir);
        mkdirp.sync(snapshotOutputDir);

        apiTokens_ = apiTokens;
        console.log("Loading Github API Tokens from " + apiTokens)
        console.log("Initialized with " + apiTokens_.length + " Github API tokens...");
        console.log("Loading projects...");
        projects = []

        let input = readline.createInterface({
            input : fs.createReadStream(projectsFile)
        });
        input.on("line", (line) => {
            let fullName = line.split(",")[0]
            projects.push(fullName);
        });
        input.on("close", () => {
            console.log("Loaded " + projects.length + " projects.")
            console.log("Starting the API queue, workers: " + numApiWorkers);
            Qapi = async.queue(ApiTask, numApiWorkers);
            console.log("Starting the download queue, workers: " + numDownloadWorkers);
            Qdownload = async.queue(DownloadTask, numDownloadWorkers);
//            console.log("Starting the process queue, workers: " + numProcessWorkers);
//            Qprocess = async.queue(ProcessTask, numProcessWorkers);
            Qapi.push({ kind: "project", index: 0})
            // when all the queues are drained, we can exit
            let canExit = () => {
                if (Qapi.running() == 0 && Qapi.empty() &&
                    Qdownload.running() == 0 && Qdownload.empty() 
                    // && Qprocess.running() == 0 && Qprocess.empty()
                    ) {
                    console.timeEnd("all");
                    console.log("KTHXBYE");
                    process.exit();
                }
            }

            Qapi.drain = canExit;
            Qdownload.drain = canExit;
            setInterval(() => {
                console.log("Qa: " + Qapi.running() + "/" + Qapi.length() + 
    //                      ", Qp: " + Qprocess.running() + "/" + Qprocess.length() + 
                          ", Qd: " + Qdownload.running() + "/" + Qdownload.length() + 
                           ", T: " + (++stats_time) + 
                           ", R: " + stats_requests + "(" + stats_retries + ")" + 
                           ", P : " + stats_projects + 
                           ", F: " + stats_files + 
                           ", S: " + stats_snapshots);
            }, 1000)
        });
    }
};

let stats_projects = 0;
let stats_files = 0;
let stats_snapshots = 0;
let stats_requests = 0;
let stats_retries = 0;
let stats_time = 0;

let projectOutputDir = null;
let snapshotOutputDir = null;
let projects = [];

let Qapi = null;
/** Queue for downloads */
let Qdownload = null;

/** Queue for spawning processes */
//let Qprocess = null;

/** Trampoline that performs the appropriate task from the main queue.
 */
function ApiTask(task, callback) {
    switch (task.kind) {
        case "project":
            return TaskProject(task, callback);
        case "branch":
            return TaskBranch(task, callback);
        case "commit":
            return TaskCommit(task, callback);
        default:
            console.log("Invalid api task " + task.kind);
            callback();
    }
}

function DownloadTask(task, callback) {
    switch (task.kind) {
        case "snapshot":
            return TaskSnapshot(task, callback);
        default:
            console.log("Invalid download task " + task.kind);
            callback();
    }
}
/*
function ProcessTask(task, callback) {
    switch (task.kind) {
        case "clone":
            return TaskGitClone(task, callback);
        case "branch":
            return TaskGitBranch(task, callback);
        case "commit":
            return TaskGitCommit(task, callback);
        default:
            console.log("Invalid api task " + task.kind);
            callback();
    }
} */

/** Returns true if the given filename should be recorded, false otherwise.
 */
function IsValidFilename(filename) {
    if (filename.includes("node_modules"))
        return null; // denied file
    if (filename.endsWith(".js") || (filename.endsWith(".coffee") || (filename.endsWith(".litcoffee")) || (filename.endsWith(".ts"))))
        return true;
    if (filename === "package.json")
        return true;
    // TODO perhaps add gulpfiles, gruntfiles, travis, etc. ?
    return false;
}

/** Converts the repository full name (repo owner + repo name) to something that can be a path on disk. We keep all numbers and letters as well as a hyphen, everything else is encoded as underscore followed by the hex ASCII code of the character. */
function ProjectNameToPath(fullName) {
    let path = "";
    for (let i = 0; i < fullName.length; ++i) {
        let x = fullName[i];
        if (
            (x >= '0' && x < '9') ||
            (x >= 'a' && x < 'z') ||
            (x >= 'A' && x < 'Z') ||
            (x == '-')
        ) {
            path += x;
        } else {
            path = path + '_';
            x = x.charCodeAt(0);
            let xx = Math.floor(x / 16);
            path += xx.toString(16);
            xx = x % 16;
            path += xx.toString(16);
        }
    }
    return path;
}

/** Initializes the path where to store project information. */
function InitializeProjectPath(project, callback) {
    // if the project path exists, which means if the project has been read from disk then we don't need to do anything
    if (project.id) {
        callback(null);
    } else {
        mkdir(projectOutputDir, project.pathPrefix, (err) => {
            if (err) {
                ProjectFatalError(callback, project, err, " Unable to create the project folder");
                return;
            }
            // then followed by the actual project directory
            mkdir(projectOutputDir + "/" + project.pathPrefix, project.fullNamePath, (err) => {
                if (err) {
                    ProjectFatalError(callback, project, err, " Unable to create the project folder");
                    return;
                }
                callback();
            });
        });
    }
}

/** Saves the project information. This is the last thing we do for a project so that we can easily distinguish a project that has already been analyzed from a project that was stopped in the middle of the analysis and therefore must be restarted. */
function SaveProjectInfo(project, callback) {
    let saveInfo = () => {
        let commits = []
        for (let hash in project.commits)
            commits.push(hash);
        fs.writeFile(project.path + "/project.json", JSON.stringify({ info: project.info, branches : project.branches, commits : commits }), (err) => {
            if (err) {
                ProjectFatalError(callback, project, err, "Unable to save project.json");
            } else {
                ++stats_projects;
                //callbgit(github.com:reactorlabs/js-health.gitack();
            }
        });
    };
    // first see if there were any errors during downloading the project and if so, store them first
    if (project.errors.length > 0) {
        fs.writeFile(project.path + "/errors.json", JSON.stringify(project.errors), (err) => {
            if (err)
                ProjectFatalError(callback, project, err, "Unable to save errors.json");
            else
                // then finally save the project info itself as a last step in downloading the project
                saveInfo();
        })
    } else {
        // otherwise unlink the errors file
        fs.unlink(project.patg + "/errors.json", (err) => {
            // TODO what to do if we have error
            if (err && err.code !== "ENOENT")
                ProjectFatalError(callback, project, err, "Unable to delete the errors.json file");
            else
                saveInfo();
        }); 
    }
}


/** Saves the commit information. The commit information can be saved as soon as all its snapshots and parent commits are scheduled. This is safe because if the downloader is stopped while still processing the snapshots of the commit, the whole project was not finished and therefore will be restarted anyways. */
function SaveCommit(project, commit, callback) {
    // first make sure the path for the commit exists
    let subdir = commit.hash.substr(0, 2);
    mkdir(project.path, subdir, (err) => {
        if (err) {
            AddProjectError(callback, project, "commit", commit.hash, "", "Unable to create commit folder");
        } else { 
            fs.writeFile(project.path + "/" + subdir + "/" + commit.hash + ".json", JSON.stringify(commit), (err) => {
                if (err) 
                    AddProjectError(callback, project, "commit", commit.hash, "", "Unable to create commit json file");
                else
                    EndProjectTask(project, callback);
            });
        }
    });
}

/** Whenever a new task that belongs to a project is spawned, the project must be made aware of it so that we can determine when all project tasks have finished and the project can therefore be closed. */
function AddProjectTask(queue, project, task) {
    project.tasks++;
    queue.unshift(task);
}


/** When a task that belongs to certain project is finished, we decrement the number of active tasks for that project. When this number gets to zero, we know we have analyzed the project completely and therefore can store the project information.
 */
function EndProjectTask(project, callback) {
    if (--project.tasks == 0) {
        if (project.errors.length > 0)
            console.log("Closing project " + project.info.fullName + ", errors: " + project.errors.length);
        else
            console.log("Closing project " + project.info.fullName);
        // delete the temp folder of the project, if any
        if (project.tempCleanup)
            project.tempCleanup();
        // save project info and close the project
        if (project.ok) 
            return SaveProjectInfo(project, callback);
    } 
    callback();
}

/** When a fatal error in the project occurs, there is no need to do any further processing of the project so  */
function ProjectFatalError(callback, project, err, reason) {
    // mark the project as broken
    project.ok = false;
    // let the user know
    console.log("Fatal error for project " + project.info.fullName + ":");
    console.log("  ERR: " + err);
    console.log("  Reason: " + reason);
    // delete the temp folder of the project, if any
    if (project.tempCleanup)
        project.tempCleanup();
    // call the callback so that the workers can continue
    callback();
}

/** Appends the given error to the list of errors within the project. All errors are saved at the end when all project tasks have finished.
 */
function AddProjectError(callback, project, kind, hash, url, reason) {
    project.errors.push({
        kind: kind,
        hash: hash,
        url: url, 
        reason : reason
    })
    EndProjectTask(project, callback);
}


/** Initializes the project information. */
function InitializeProject(id, callback) {
    // create the project
    let project = {
        ok : true, // if the project is not ok, there is no point in executing more of its tasks... 
        info : {
            fullName : projects[id]
        },
        branches : {},
        commits : {},
        // number of active tasks for the project, when drops to 0, we know the project has been processed successfully
        tasks : 1,
        // errors that happened during processing of the project
        errors : []
    };
    // now get the metadata for the project 
    project.url = "http://api.github.com/repos/" + project.info.fullName;
    project.fullNamePath = ProjectNameToPath(project.info.fullName);
    project.pathPrefix = project.fullNamePath.substr(0,2);
    project.path = projectOutputDir + "/" + project.pathPrefix + "/" + project.fullNamePath;
    // load the project from disk, if we have it
    fs.readFile(project.path + "/project.json", (err, data) => {
        if (err === null) {
            let x = JSON.parse(data);
            project.info = x.info;
            project.branches = x.branches;
            for (let hash of x.commits)
                project.commits[hash] = true; // just so that it is not undefined
            console.log("project " + project.info.fullName + " already found on disk...");
            // technically we can call callback & return here
        }
        console.log("opening project " + project.info.fullName);
        APIRequest(project.url,
            (error, response, result) => {
                // This is ok, just means that the project was not found, i.e. has already been deleted, or made private
                if (response.statusCode == 404) {
                    // TODO if we have already seen the project, we might want to do something with it
                    console.log(" project " + project.info.fullName + " no longer available")
                    callback(project, false);
                    return;
                }
                let i = project.info
                // fill in the task project
                i.id = result.id;
                i.name = result.name
                i.fullName = result.full_name;
                //i.fullName = result.fullName;
                i.description = result.description;
                i.ownerId = result.owner.id;
                i.fork = result.fork;
                i.size = result.size;
                i.forks_count = result.forks_count;
                i.stargazers_count = result.stargazers_count;
                i.watchers_count = result.watchers_count;
                i.language = result.language;
                i.has_issues = result.has_issues;
                i.open_issues_count = result.open_issues_count;
                i.default_branch = result.default_branch;
                // if the project is fork and we have parent, store its id
                if (result.parent !== undefined)
                    i.parent = {
                        id : result.parent.id,
                        fullName : result.parent.full_name
                    };
                i.created_at = result.created_at;
                if (i.updated_at === result.updated_at && i.pushed_at === result.pushed_at) {
                    console.log("project " + project.info.fullName + " did not change, skipping...");
                    callback(project, false);
                } else { 
                    i.updated_at = result.updated_at;
                    i.pushed_at = result.pushed_at;
                    // now we must make sure that the project path exists before we can start processing the branches
                    InitializeProjectPath(project, () => {
                        callback(project, true);
                    });
                }
            }
        );
    });
}

/**  */
function TaskProject(task, callback) {
    InitializeProject(task.index, (project, analyze) => {
        if (analyze) {
            // mark the default branch for analysis
            AddProjectTask(Qapi, project, {
                kind : "branch",
                branch : project.info.default_branch,
                project : project
            });
        }
        EndProjectTask(project, callback);
    });
    // add next project to the queue
    if (task.index < projects.length - 1)
        Qapi.push({ kind: "project", index : task.index + 1});
}

/** When checking a branch, we always perform the check to see if the commit has changed.
 */
function TaskBranch(task, callback) {
    let project = task.project
    // if the project is not ok, ignore the task
    if (! project.ok) {
        callback();
        return;
    }
    let url = project.url + "/branches/" + task.branch
    APIRequest(url,
        (error, response, result) => {
            if (error) 
                return AddProjectError(callback, project, "branch", task.branch, url, "Unable to obtain information for branch " + task.branch);
            // enqueue the latest commit of the branch
            AnalyzeBranch(Qapi, project, task.branch, result.commit.sha);
            // we are done with the branch, close the task
            EndProjectTask(project, callback);
        }
    );
}


/** Clones the project into a temp folder.
 */
/*
function TaskGitClone(task, callback) {
    InitializeProject(task.index, (project, analyze) => {
        if (analyze) {
            // first create the temp directory in which we will clone the file
            tmp.dir({
                unsafeCleanup : true
            }, (err, path, cleanupCallback) => {
                if (err)
                    return ProjectFatalError(callback, project, err, "Unable to create temporary directory to clone the repository into");
                // update the project object with the data and the callback
                project.localDir = path;
                project.tempCleanup = cleanupCallback;
                project.cloneUrl = "https://github.com/" + project.info.fullName;
                // now we need to clone the project into the given path
                console.log("cloning project " + project.info.fullName + " into " + project.localDir);
                child_process.exec("GIT_TERMINAL_PROMPT=0 git clone " + project.cloneUrl + " " + project.localDir, (error, cout, cerr) => {
                    if (error) 
                        return ProjectFatalError(callback, project, error, "Unable to clone the project");
                    // when the project has been cloned, 
                    console.log("project " + project.info.fullName + " successfully cloned into " + project.localDir);
                    AddProjectTask(Qprocess, project, {
                        kind : "branch",
                        project : project, 
                        branch : project.info.default_branch
                    })
                    EndProjectTask(project, callback);
                });
            });
        }
    });
    // add next project to the queue
    if (task.index < projects.length - 1)
        Qprocess.push({ kind: "clone", index : task.index + 1});
} */

/*

function TaskGitBranch(task, callback) {
    let project = task.project;
    let branch = task.branch;
    child_process.exec("git checkout " + project.info.default_branch, { cwd: project.localDir }, (error, cout, cerr) => {
        if (error)
            return ProjectFatalError(callback, project, error, "Unable to checkout main branch " + project.info.default_branch);
        // now that we have the branch, get its commit
        child_process.exec("git rev-parse HEAD", { cwd: project.localDir }, (error, cout, cerr) => {
            if (error)
                return ProjectFatalError(callback, project, error, "Cannot determine HEAD");
            // enqueue the latest commit of the branch
            AnalyzeBranch(Qprocess, project, branch, cout);
            // we are done with the branch, close the task
            EndProjectTask(project, callback);
        });
    });
} */

function AnalyzeBranch(queue, project, branchName,  commitHash) {
    let branch = {
        name : branchName,
        commit : commitHash
    }
    if (project.branches[branch.name] !== undefined && project.branches[branch.name].commit === branch.commit) {
        console.log("project " + project.info.fullName + " branch " + branch.name + " not changed, skipping...");
    } else {
        project.branches[branch.name] = branch;
        AddProjectTask(queue, project, {
            kind : "commit",
            hash : branch.commit,
            project : project
        })
    }
}


function TaskCommit(task, callback) {
    let project = task.project;
    // if the project is not ok, ignore the task
    if (! project.ok) 
        return callback();
    // no need to revisit the commit if we have already scanned it, or we are scanning it right now
    if (project.commits[task.hash] !== undefined) 
        return EndProjectTask(project, callback);
    // otherwise add the commit
    let commit = {
        hash : task.hash
    };
    project.commits[commit.hash] = commit;
    // get information about the commit

    let url = project.url + "/commits/" + commit.hash
    APIRequest(url, 
        (error, response, result) => {
            if (error) 
                return AddProjectError(callback, project, "commit", commit.hash, url, "Unable to obtain information for commit " + commit.hash);
            commit.date = result.commit.author.date;
            commit.message = result.commit.message;
            commit.author = {
                name : result.commit.author.name,
                email : result.commit.author.email,
            };
            // if the author is a github user, add the id
            if (result.author)
                commit.author.id = result.author.id;
            // Enqueue all parent commits
            commit.parents = [];
            for (parent of result.parents) {
                AddProjectTask(Qapi, project, {
                    kind : "commit",
                    hash : parent.sha,
                    project : project
                });
                commit.parents.push(parent.sha);
            }
            // enqueue files changed by the commit if they are the ones we are interested in
            commit.files = [];
            for (f of result.files) {
                // only deal with files we are interested in
                if (! IsValidFilename(f.filename))
                    continue;
                // change in file permissions, not interested for us
                if (f.sha === "0000000000000000000000000000000000000000")
                    continue;
                // create the fileinfo for the commit
                let fileInfo = {
                    filename : f.filename,
                    status : f.status
                };
                // if the file is renamed, keep the previous filename as well
                if (f.status === "renamed") 
                    fileInfo.previous_filename = f.previous_filename;
                // add the hash of the file and schedule the snapshot if the file is not deleted or renamed
                if (f.status !== "removed" && f.status !== "renamed") {
                    // if no hash for the file snapshot, we are not interested
                    // TODO what does not this mean? 
                    if (!f.sha)
                        continue;
                    fileInfo.hash = f.sha
                    // enque the task to download the file 
                    AddProjectTask(Qdownload, project, {
                        kind : "snapshot",
                        project : project,
                        hash : f.sha,
                        url : f.raw_url,
                        commit : commit

                    });
                }
                // add the fileinfo to the commit files
                commit.files.push(fileInfo);
            }
            // store the commit information
            SaveCommit(project, commit, callback);
        }
    );
}

/*
function TaskGitCommit(task, callback) {
    let project = task.project
    // no need to revisit the commit if we have already scanned it, or we are scanning it right now
    if (project.commits[task.hash] !== undefined) 
        return EndProjectTask(project, callback);
    // otherwise add the commit
    let commit = {
        hash : task.hash,
        files : [],
        parents : []

    };
    // get parents for the commit
    child_process.exec("git rev-list --parents -n 1 " + commit.hash, { cwd: project.localDir, maxBuffer: 1024 * 1024 * 20 }, 
        (error, cout, cerr) => {
            if (error) 
                return AddProjectError(callback, project, "commit", commit.hash,"", "Unable to get parents for commit");
            // add the parents
            parents = cout.trim().split(" ");
            for (let i = 1; i < parents.length; ++i) {
                AddProjectTask(Qprocess, project, {
                    kind : "commit",
                    hash: parents[i],
                    project : project
                });
                commit.parents.push(parents[i]);
            }
            // now that the parents were added, get files and add the file changes as well
            child_process.exec("git diff-tree --no-commit-id -r " + commit.hash, { cwd: project.localDir, maxBuffer: 1024 * 1024 * 20 },
            (error, cout, cerr) => {
                if (error)
                    return AddProjectError(callback, project, "commit", commit.hash, "", "Unable to perform git diff-tree");
                // otherwise we must parse the output according to git-diff rules (see https://git-scm.com/docs/git-diff-tree)
                let files = cout.split("\n");
                for (let line of files) {
                    if (line == "")
                        continue;
                    // get rid of the leading colon and split into columns
                    line = line.substr(1).split(" ");
                    let srcMode = line[0];
                    let dstMode = line[1];
                    let srcHash = line[2];
                    let dstHash = line[3];
                    let status = line[4].split("\t");
                    let srcPath = status[1];
                    let filename = srcPath;
                    status = status[0];
                    let dstPath = "";
                    if (line.length == 6) {
                        dstPath = line[5];
                        filename = dstPath;
                    }
                    // ignore files we do not care about
                    if (! IsValidFilename(filename))
                        continue;
                    // ignore file permissions change
                    if (srcHash == dstHash && (srcPath == dstPath || dstPath == ""))
                        continue;
                    let fileInfo = {
                        filename : filename,
                        hash : dstHash
                    }
                    if (status == "M") {
                        fileInfo.status = "modified"
                    } else if (status == "A") {
                        fileInfo.status = "created";
                    } else if (status == "D") {
                        fileInfo.status = "removed";
                    } else if (status == "U") {
                        fileInfo.status = "unmerged";
                    } else if (status[0] == "C") {
                        fileInfo.status = "copy-edit";
                        fileInfo.previous_filename = srcPath;
                    } else if (status[0] == "R") {
                        fileInfo.status = "rename-edit";
                        fileInfo.previous_filename = srcPath;
                    }
                    if (fileInfo.status !== "removed" && fileInfo.status !== "renamed") {
                        AddProjectTask(Qdownload, project, {
                            kind : "snapshot",
                            project : project, 
                            hash : fileInfo.hash,
                            url : "https://raw.githubusercontent.com/" + project.info.fullName + "/" + commit.hash + "/" + fileInfo.filename,
                            commit : commit,
                            line : line
                        });
                    }
                    commit.files.push(fileInfo);
                }
                SaveCommit(project, commit, callback);
            });
        }
    );

} */

/** Obtain the snapshot of the file. */
function TaskSnapshot(task, callback) {
    let project = task.project
    // if the project is not ok, ignore the task
    if (! task.project.ok) {
        callback();
        return;
    }
    // first see if we already have the snapshot
    let subdir1 = task.hash.substr(0, 2);
    let subdir2 = task.hash.substr(2, 2);
    let snapshotPath = snapshotOutputDir + "/" + subdir1 + "/" + subdir2 + "/" + task.hash;
    fs.access(snapshotPath, fs.constants.R_OK, (err) => {
        if (err) {
            // if the snapshot does not exist, make first sure that the path exists
            mkdir(snapshotOutputDir, subdir1, (err) => {
                if (err) 
                    return AddProjectError(callback, task.project, "snapshot", task.hash, task.url, "Unable to create folder for snapshot " + task.hash);
                mkdir(snapshotOutputDir + "/" + subdir1, subdir2, (err) => {
                    if (err) 
                        return AddProjectError(callback, task.project, "snapshot", task.hash, task.url, "Unable to create folder for snapshot " + task.hash);
                    APIRequest(
                        task.url, 
                        (error, response, result) => {
                            if (error) 
                                return AddProjectError(callback, project, "snapshot", task.hash, task.url, "Unable to get snapshot " + task.hash + " from github");
                            fs.writeFile(snapshotPath, result, (err) => {
                                if (err) 
                                    return AddProjectError(callback, project, "snapshot", task.hash, task.url, "Unable to store snapshot " + task.hash);
                                ++stats_files;
                                ++stats_snapshots;
                                EndProjectTask(project, callback);
                            });
                        },
                        false // no JSON
                    );
                });
            });
        } else {
            // there was no error, the snapshot already exists, no need to download it
            ++ stats_files;
            EndProjectTask(task.project, callback);
        }
    });
}




let apiTokens_ = null;
let apiTokenIndex_ = 0;

function APIRequest(url, onDone, json = true, retries = 10) {
    // rotate the api tokens to circumvent the 5000 requests per hour github limit
    let token = apiTokens[apiTokenIndex_++];
    if (apiTokenIndex_ == apiTokens.length)
        apiTokenIndex_ = 0;
    // create the request
    let options = {
        url : url,
        json : json,
        headers : {
            "Authorization" : "token " + token,
            "User-Agent" : "js-health"
        } 
    };
    // call request, async
    request(options, (error, response, body) => {
        // only count the JSON requests because the raw requests do not count towards the github API limits 
        if (json)
            ++stats_requests;
        // first see if we should retry the request  && error.code == "ETIMEDOUT"
        if (error) {
            if (retries > 0) {
                console.log(url + " -- retry " + retries);
                ++stats_retries;
                APIRequest(url, onDone, json, retries - 1);
                return;
            } 
        }
        // if not proceed as normally
        if (error || response.statusCode != 200) {
            console.log(url + " -- error");
            if (error === null)
                error = response.statusCode;
            onDone(error, response, body);
        } else {
            //console.log(url + " -- ok");
            onDone(null, response, body);
        }
    });
}




