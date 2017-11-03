const async = require("async");
const request = require("request")

module.exports = {

    help : function() {

    },

    download : function(apiTokens) {
        console.time("all");
        apiTokens_ = apiTokens;
        console.log("Initialized with " + apiTokens_.length + " Github API tokens...");
        Q = async.queue(Task, 50);
        // add the task of loading a project
        Q.push({ kind : "project", url : "nborracha/titanium_mobile" });


        // when the queue is done, exit
        Q.drain = () => {
            console.timeEnd("all");
            console.log("KTHXBYE");
            process.exit();
        }
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

let Q = null; 

var nextProjectId_ = 0;


/** Trampoline that performs the appropriate task from the main queue.
 */
function Task(task, callback) {
    console.log("Executing task " + task.kind);
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

/**  */
function TaskProject(task, callback) {
    // create the project
    let project = {
        info : {},
        branches : {},
        commits : {}
    };
    if (task.id !== undefined) {
        // TODO load the project information from disk and specify task's URL 
    }
    // now get the metadata for the project 
    project.url = "http://api.github.com/repos/" + task.url
    APIRequest(project.url,
        (response, result) => {
            let i = project.info
            // fill in the task project
            i.id = result.id;
            i.fullName = result.fullName;
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
            // now search the branch
            Q.unshift({
                kind : "branch",
                branch : i.default_branch,
                project : project
            })
            // TODO save the project info here
            callback();
        },
        Error(callback)
    );
}

function TaskBranch(task, callback) {
    let project = task.project
    APIRequest(project.url + "/branches/" + task.branch,
        (response, result) => {
            // TODO what if the branch already exists?? 
            let branch = {
                name : result.name,
                commit : result.commit.sha
            }
            project.branches[branch.name] = branch;
            Q.unshift({
                kind : "commit",
                hash : branch.commit,
                project : project
            })
            // output the branch info
            callback();
        },
        Error(callback)
    );
}

function TaskCommit(task, callback) {
    let project = task.project;
    // no need to revisit the commit if we have already scanned it, or we are scanning it right now
    if (project.commits[task.hash] !== undefined) {
        callback()
        return;
    }
    // otherwise add the commit
    let commit = {
        hash : task.hash
    };
    project.commits[commit.hash] = commit;
    // get information about the commit

    APIRequest(project.url + "/commits/" + commit.hash, 
        (response, result) => {
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
                Q.unshift({
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
                // create the fileinfo for the commit
                let fileInfo = {
                    filename : f.filename,
                    status : f.status
                };
                // add the hash of the file and schedule the snapshot if the file is not deleted
                if (f.status !== "deleted") {
                    fileInfo.hash = f.sha
                    Q.unshift({
                        kind : "snapshot",
                        hash : f.sha,
                        url : f.raw_url 
                    });
                }
                // add the fileinfo to the commit files
                commit.files.push(fileInfo);
            }
            // TODO store the commit information
            callback();
        },
        Error(callback)
    );
}


let snapshotIdx_ = 0;

/** Obtain the snapshot of the file. */
function TaskSnapshot(task, callback) {
    // do every 10th file only, which should be what we endup with
    if (snapshotIdx_++ != 10) {
        callback();
        return;
    }
    snapshotIdx_ = 0;
    // TODO this needs to be much more clever
    APIRequest(task.url, 
        (response, result) => {
            callback();
        },
        Error(callback),
        false // no JSON
    );
}








// when asking for commits I can do since to only get those I am interested in



var apiTokens_ = null;
var apiTokenIndex_ = 0;

/** Since the github  */
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

    //response.headers["link"]





}

function APIRequest(url, onDone, onError, json = true) {
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
        if (error || response.statusCode != 200) {
            console.log(url + " -- error");
            onError(error, response, body);
        } else {
            console.log(url + " -- ok");
            onDone(response, body);
        }
    });
}




