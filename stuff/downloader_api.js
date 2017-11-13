const async = require("async");
const request = require("request")
const fs = require("fs");

// helpers which should eventually go to utils

/** Creates a directory asynchronously. 
 */
function mkdir(where, name, callback) {
    fs.mkdir(where + "/" + name, (err) => {
        if (err != "EEXIST")
            callback(err);
        else 
            callback(null);
    });
}



module.exports = {

    help : function() {

    },

    download : function(apiTokens) {
        let numStrides = 100;
        let strideIndex = 0;
        let projectsFile = "/home/peta/JS_files.csv";
        projectOutputDir = "/home/peta/jsdownload/projects";
        snapshotOutputDir = "/home/peta/jsdownload/files";

        console.time("all");
        apiTokens_ = apiTokens;
        console.log("Initialized with " + apiTokens_.length + " Github API tokens...");
        console.log("Loading projects - stride ", strideIndex, "/", numStrides);



        projects = [
            //"nborracha/titanium_mobile",
            "Offsite/TaskCodes",
            "Gozala/addon-sdk",
            "mobify/mobifyjs",
            "substack/node-mkdirp",
            "motiooon/node-mkdirp",
            "hypomodern/jquery-oembed",
            "woodwardjd/jquery-oembed",
            "digitaljhelms/digitaljhelms.github.com",
            "dstamant/wet-boew",
            "chaplinjs/chaplin",
            "charlesmorin/wet-boew",
            "metalmumu/propelorm.github.com",
            "mozilla-b2g/gaia",
            "davidflanagan/gaia",
            "nelstrom/Sencha-Touch-templates-demo",
            "mozilla/butter",
            "secretrobotron/butter",
            "amccloud/backbone-bindings",
            "ulifigueroa/i18n-js",
            "malsup/blockui",
            "EugenDueck/engine.io",
            "baali/thrift_js",
            "qarnac/CyberHawk-Adventure",
            "ducksboard/gridster.js",
            "visionmedia/uikit",
            "douglascrockford/JSON-js",
            "avoidwork/abaaso",
            "ptmahent/JSON-js",
            "jeffreyrack/CyberHawk-Adventure",
            "pandell/JSON-js",
            "hakimel/reveal.js",
            "bittorrenttorque/btapp",
            "CoNarrative/glujs",
            "smithrp/glujs",
            "adobe/brackets",
            "jkk/eidogo",
            "SupportBee/Backbone-Factory",
            "emberjs/data",
            "kbullaughey/data",
            "stevenbenner/jquery-powertip",
            "lukemelia/data",
            "romancortes/montage",
            "huerlisi/data",
            "rgrove/lazyload",
            "josepjaume/emberjs-data",
            "github/hubot",
            "bellycard/hubot",
            "binaryjs/binaryjs",
            "programmist/binaryjs",
            "sjhernes/angular.js",
            "ebbes/system-monitor-applet",
            "wingrunr21/hubot",
            "mercadolibre/mercadolibre.js",
            "TioBorracho/mercadolibre.js",
            "igorkasyanchuk/tv",
            "h5bp/html5please",
            "meteor/meteor",
            "michael/github",
            "emberjs/ember.js",
            "sproutcore/sproutcore",
            "antimatter15/summerTorrent",
            "crdlc/gaia",
            "mjschranz/butter",
            "fullcalendar/fullcalendar",
            "blackberry-community/Community",
            "glebtv/jquery-openxtag"
        ]

        Q = async.queue(Task, 50);
        // add the task of loading a project
        Q.push({ kind : "project", index: 0 });


        // when the queue is done, exit
        Q.drain = () => {
            console.timeEnd("all");
            console.log("KTHXBYE");
            process.exit();
        }

        setInterval(() => {
            console.log("Q: " + Q.running() + "/" + Q.length() + " - T: " + (++stats_time) + ", R: " + stats_requests + "(" + stats_retries + "), P : " + stats_projects +  ", F: " + stats_files + ", S: " + stats_snapshots);
        }, 1000)
/*

        // load the projects now
        APIFullRequest(
            "http://api.github.com/repos/nborracha/titanium_mobile/commits",
            //"http://www.seznam.cz",
            (response, result) => {
                console.log(result.length);
            },
            (error, response, result) => {
                console.log(error);
            }
        ); */
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

let Q = null; 

/** Trampoline that performs the appropriate task from the main queue.
 */
function Task(task, callback) {
    switch (task.kind) {
        case "project":
            return TaskProject(task, callback);
        case "branch":
            return TaskBranch(task, callback);
        case "commit":
            return TaskCommit(task, callback);
        case "snapshot":
            return TaskSnapshot(task, callback);
    }
}

function Error(callback) {
    return (error, response, result) => {
        console.log("API Error");
        callback();
    }
}

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
    // if the project path exists, then we do not need to do anything, call the callback immediately
    if (project.path) {
        callback(null);
    } else {
        project.fullNamePath = ProjectNameToPath(project.info.fullName);
        project.pathPrefix = project.fullNamePath.substr(0,2);
        mkdir(projectOutputDir, project.pathPrefix, (err) => {
            // TODO check error
            // then followed by the actual project directory
            mkdir(projectOutputDir + "/" + project.pathPrefix, project.fullNamePath, (err) => {
                // TODO check error
                // set the project path, and call itself again, this time actually storing the file
                project.path = projectOutputDir + "/" + project.pathPrefix + "/" + project.fullNamePath;
                callback(err);
            });
        });
    }
}

/** Saves the project information. This is the last thing we do for a project so that we can easily distinguish a project that has already been analyzed from a project that was stopped in the middle of the analysis and therefore must be restarted. */
function SaveProjectInfo(project, callback) {
    fs.writeFile(project.path + "/project.json", JSON.stringify(project.info), (err) => {
        // TODO should also store any errors, or delete old errors if any 
        // TODO check error
        ++stats_projects;
        callback();
    });
}

/** Saves the commit information. The commit information can be saved as soon as all its snapshots and parent commits are scheduled. This is safe because if the downloader is stopped while still processing the snapshots of the commit, the whole project was not finished and therefore will be restarted anyways. */
function SaveCommit(project, commit, callback) {
    // first make sure the path for the commit exists
    let subdir = commit.hash.substr(0, 2);
    mkdir(project.path, subdir, (err) => {
        // TODO check error
        fs.writeFile(project.path + "/" + subdir + "/" + commit.hash + ".json", JSON.stringify(commit), (err) => {
            // TODO check error
            EndProjectTask(project, callback);
        });
    });
}

/** Whenever a new task that belongs to a project is spawned, the project must be made aware of it so that we can determine when all project tasks have finished and the project can therefore be closed. */
function AddProjectTask(project, task) {
    project.tasks++;
    Q.unshift(task);
}

/** When a task that belongs to certain project is finished, we decrement the number of active tasks for that project. When this number gets to zero, we know we have analyzed the project completely and therefore can store the project information.
 */
function EndProjectTask(project, callback) {
    if (--project.tasks == 0) {
        console.log("Closing project " + project.info.fullName);
        SaveProjectInfo(project, callback);
    } else {
        callback();
    }
}


/**  */
function TaskProject(task, callback) {
    // create the project
    let project = {
        info : {
            fullName : projects[task.index]
        },
        branches : {},
        commits : {},
        // number of active tasks for the project, when drops to 0, we know the project has been processed successfully
        tasks : 1,
        // errors that happened during processing of the project
        errors : []
    };
    if (task.id !== undefined) {
        // TODO load the project information from disk and specify task's URL 
    } else {
        // make sure that 
    }
    // now get the metadata for the project 
    project.url = "http://api.github.com/repos/" + projects[task.index];
    console.log("opening project " + projects[task.index]);
    APIRequest(project.url,
        (error, response, result) => {
            if (response.statusCode == 404) {
                EndProjectTask(project, callback)
                return;
            }
            let i = project.info
            // fill in the task project
            i.id = result.id;
            i.name = result.name
            //i.fullName = result.fullName;
            i.description = result.description;
            i.ownerId = result.owner.id;
            i.fork = result.fork;
            // TODO determine if the project has changed and do not do the commits in that case
            i.created_at = result.created_at;
            i.updated_at = result.updated_at;
            i.pushed_at = result.pushed_at;
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
                i.parent = result.parent.id;
            // now we must make sure that the project path exists before we can start processing the branches
            InitializeProjectPath(project, (err) => {
                // TODO make sure there is no error
                // mark the default branch for analysis
                AddProjectTask(project, {
                    kind : "branch",
                    branch : i.default_branch,
                    project : project
                });
                // save the project info, which also executes our callback
                EndProjectTask(project, callback);
            });
        }
    );
    if (task.index < projects.length - 1)
        Q.push({ kind: "project", index : task.index + 1});
}

function TaskBranch(task, callback) {
    let project = task.project
    APIRequest(project.url + "/branches/" + task.branch,
        (error, response, result) => {
            // TODO what if the branch already exists?? 
            let branch = {
                name : result.name,
                commit : result.commit.sha
            }
            project.branches[branch.name] = branch;
            AddProjectTask(project, {
                kind : "commit",
                hash : branch.commit,
                project : project
            })
            // output the branch info
            EndProjectTask(project, callback);
        }
    );
}

function TaskCommit(task, callback) {
    let project = task.project;
    // no need to revisit the commit if we have already scanned it, or we are scanning it right now
    if (project.commits[task.hash] !== undefined) {
        EndProjectTask(project, callback);
        return;
    }
    // otherwise add the commit
    let commit = {
        hash : task.hash
    };
    project.commits[commit.hash] = commit;
    // get information about the commit

    APIRequest(project.url + "/commits/" + commit.hash, 
        (error, response, result) => {
            commit.date = result.commit.author.date;
            commit.message = result.commit.message;
            commit.comment_count = result.commit.comment_count;
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
                AddProjectTask(project, {
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
                    if (f.raw_url === "https://github.com/nborracha/titanium_mobile/raw/9eeefe61b96c9dbff911fff2a0e6d88e4e9b104a/mobileweb/cli/commands/_run.js")
                        console.log("here");
                    // if no hash for the file snapshot, we are not interested
                    if (!f.sha)
                        continue;
                    fileInfo.hash = f.sha
                    AddProjectTask(project, {
                        kind : "snapshot",
                        project : project,
                        hash : f.sha,
                        url : f.raw_url 
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


/** Obtain the snapshot of the file. */
function TaskSnapshot(task, callback) {
    // first see if we already have the snapshot
    let subdir1 = task.hash.substr(0, 2);
    let subdir2 = task.hash.substr(2, 2);
    let snapshotPath = snapshotOutputDir + "/" + subdir1 + "/" + subdir2 + "/" + task.hash;
    fs.access(snapshotPath, fs.constants.R_OK, (err) => {
        if (err) {
            // if the snapshot does not exist, make first sure that the path exists
            mkdir(snapshotOutputDir, subdir1, (err) => {
                // TODO handle error
                mkdir(snapshotOutputDir + "/" + subdir1, subdir2, (err) => {
                    // TODO handle error
                    APIRequest(
                        task.url, 
                        (error, response, result) => {
                            // TODO handle error
                            fs.writeFile(snapshotPath, result, (err) => {
                                // TODO handle error
                                ++stats_files;
                                ++stats_snapshots;
                                EndProjectTask(task.project, callback);
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


/*
function APIFullRequest(url, onDone, onError, per_page = 100) {
    var result = [];
    let cont = (response, body) => {
        // append the results to the result, in place
        Array.prototype.push.apply(result, body);
        // determine if there is more to call
        let link = response.headers.link;
        if (link !== undefined) {
            // we are only interested in the first link
            link = link.split(", ")[0].split("; ");
            if (link[1] === "rel=\"next\"") {
                newUrl = link[0].substr(1).split(">")[0];
                APIRequest(newUrl, cont, onError);
                return;
            }
        }
        onDone(response, result);
    };
    // set the per-page limit
    url = url + "?per_page=" + per_page;
    APIRequest(
        url,
        cont,
        onError
    );
} */

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
            onDone(error, response, body);
        } else {
            //console.log(url + " -- ok");
            onDone(null, response, body);
        }
    });
}




