

module.exports = {
    help : function() {
    },

    download : function() {
        let numWorkers = 1;
        outputDir = "/home/peta/jsdownload"

        // make sure we have the folders we need
        mkdirp.sync(outputDir);
        mkdirp.sync(outputDir + "/projects");
        mkdirp.sync(outputDir + "/snapshots");
        mkdirp.sync(outputDir + "/commits");

        // load the github ai tokens
        Github.LoadTokens("/home/peta/githubtokens.json");

        projects = [
            "Offsite/TaskCodes",
            "adammark/Markup.js",
            "pockethub/PocketHub",
            "angular/angular.js",
            "powmedia/buildify",
            "6a68/browserid",
            "fredwu/jquery-endless-scroll",
            "yui/yui3",
        ]


        console.log("  loaded " + projects.length + " projects");
        console.log("Starting the main queue, workers: " + numWorkers);
        Q = async.queue(Task, numWorkers);
        Q.drain = CanExit;
        Q.push({ kind : "project", index : 0});
    }
}



function CanExit() {
    console.log("done");
    process.exit();
}


function Task(task, callback) {
    switch (task.kind) {
        case "project":
            let name = projects[task.index++];
            if (task.index < projects.length) 
                Q.push({ kind: "project", index: task.index});
            Project.Start(name, callback);
            break;
        case "branch":
            task.project.analyzeBranch(task.name, callback);
            break;
        case "commit":
            task.project.analyzeCommit(task.hash, callback);
            break;

        default:
            console.error("[ERROR] Invalid task " + task.kind);
            callback();
    }
}


/** Wrapper around calls to Github. Manages github api tokens and provides api and normal HTTP get wrapper methods with retries and basic error checking. */
class Github {

    /** Executes given API requests with at most given number of retries. 
     */
    static APIRequest(url, callback, retries = 10) {
        // if we have no more retries, return error
        if (retries < 0) 
            return callback("RETRY_FAIL", null, null);
        // get next token and initiate the request
        let token = Github.GetToken_();
        let options = {
            url : url,
            json : true,
            headers : {
                "Authorization" : "token " + token,
                "User-Agent" : "js-health"
            }
        };
        request(options, (error, response, body) => {
            ++Github.RequestsCount;
            if (error) 
                return Github.Retry_(() => { Github.APIRequest(url, callback, retries - 1); });
            if (response.statusCode === 404)
                return callback(404, response, body);
            if (response.statusCode !== 200) 
                return Github.Retry_(() => { Github.APIRequest(url, callback, retries - 1); });
            callback(error, response, body);
        });
    }

    /** Returns the given github URL that does not require the GitHub API authentication.
     */
    static Get(url, callback, retries = 10) {
        // if we have no more retries, return error
        if (retries < 0) 
        return callback("RETRY_FAIL", null, null);
        let options = {
            url : url,
            headers : {
                "User-Agent" : "js-health"
            } 
        };
        request(options, (error, response, body) => {
            ++Github.GetsCount;
            if (error) 
                return Github.Retry_(() => { Github.Get(url, callback, retries - 1); });
            if (response.statusCode === 404)
                return callback(404, response, body);
            if (response.statusCode !== 200) 
                return Github.Retry_(() => { Github.Get(url, callback, retries - 1); });
            callback(error, response, body);
        });
    }

    /** Loads the api tokens from given file.
     */
    static LoadTokens(filename) {
        console.log("Loading Github API Tokens from " + filename)
        Github.tokens_ = JSON.parse(fs.readFileSync(filename));
        console.log("    " + Github.tokens_.length + " tokens found...");
    }

    /** Returns next available token for the request. */
    static GetToken_() {
        let token = Github.tokens_[Github.currentToken_++];
        if (Github.currentToken_ == Github.tokens_.length)
            Github.currentToken_ = 0;
        return token;
    }

    /** Incremnents the retries counter and then executes the what argument, which should perform the retry itself. */
    static Retry_(what) {
        ++Github.RetryCount;
        what();
    }

}

Github.RequestsCount = 0;
Github.GetsCount = 0;
Github.RetryCount = 0;

Github.tokens_ = [];
Github.currentToken_ = 0;

/** Wrapper around calls to git.
 */
class Git {

    static Clone(project, callback) {
        child_process.exec("GIT_TERMINAL_PROMPT=0 git clone " + project.url + " " + project.localDir, callback);
    } 

    static Query(project, query, callback) {

    }


}

class Project {

    /** Task that starts analysis of a project. When done, calls the given callback. */
    static Start(projectName, callback) {
        let project = new Project(projectName);
        project.loadPreviousResults((error) => {
            // error should always be null
            project.getMetadata((error, analyze) => {
                if (error)
                    return project.fatalError(error, callback, "Cannot obtain project metadata from github");
                if (analyze) {
                    project.clone((error) => {
                        if (error)
                            return project.fatalError(error, callback, "Unable to clone project");
                        project.switchTask({ kind : "branch", name : project.info.default_branch }, callback);
                    });
                } else {
                    project.endTask(callback);
                }
            });
        });
    }

    /** Task that starts analyzing given branch in the specified project. */
    analyzeBranch(name, callback) {
        let project = this; 
        // get the latest commit of the branch
        project.getLatestBranchCommit(name, (error, hash) => {
            if (error)
                return project.fatalError(error, callback, "Unable to obtain latest commit for branch " + name);
            // if the branch has already been analyzed at this commit, no need to reanalyze
            if (project.branches[name] == hash) 
                return project.endTask(callback);
            // othwreise note that the commit is analyzed and switch task
            project.branches[name] = hash;
            project.switchTask({ kind : "commit", hash : hash});
        });
    }

    /** Analyzes the given commit. */
    analyzeCommit(hash, callback) {
        let project = this;
        let commit = new Commit(hash);


    }

    constructor(name) {
        this.url = "https://github.com/" + name;
        this.path = Project.GetPath_(name);
        this.info = {
            full_name : name
        };
        this.errors = [];
        this.branches = {};
        this.tasks = 1;
        this.time = {
            created : new Date().getTime() / 1000
        }
        // list of commits 
        this.commits = {}
        // increase the number of opened projects
        ++Project.Opened; 
    }


    addTask(q, task) {
        ++this.tasks;
        task.project = this;
        q.unshift(task);
    }

    switchTask(task, callback) {
        task.project = this;
        Task(task, callback);
    }

    /** Decreases the number of tasks associated with the project and if this number drops to zero, i.e. if there are no pending tasks for the project, performs the project cleanup and saves the project results.
     */
    endTask(callback) {
        let project = this;
        if (--this.tasks == 0) {
            this.log("Closing");
            // first delete the temporary directory
            this.cleanup_();
            if (this.incremental) {
                return project.save_(callback);
            } else {
                mkdirp(project.path, (err, made) => {
                    if (err)
                        return project.fatalError(err, callback, "Unable to create project folder " + project.path);
                    project.save_(callback);
                });
            }
        }
    }

    /** Raises a fatal error, which stops the entire project from being processed further.
     */
    fatalError(error, callback, reason) {
        ++Project.Errors;
        this.tasks = -1;
        this.cleanup_();
        // TODO log the error
        console.error("[FATAL] Project: " + this.info.full_name + ": " + reason);
        callback();
    }

    log(what) {
        console.log("[INFO] Project: " + this.info.full_name + ": " + what);
    }

    /** If the project has already been analyzed, fetches the project metadata from disk which together with the new fetch of the metadata quickly determines if the project needs to be reanalyzed again. */
    loadPreviousResults(callback) {
        let project = this;
        fs.readFile(project.path +"/project.json", (err, data) => {
            if (! err) {
                let x = JSON.parse(data);
                project.info = x.info;
                project.branches = x.branches;
                project.errors = x.errors;
                project.times
                // mark the project as incremental analysis because we already have previous results
                project.incremental = true;
            }
            // not being able to load previous results is not an error in itself
            callback(null);
        });
    }

    /** Reads the project metadata from github. The callback is given true if the project should be analyzed, or false, if there is no need to re-analyze the project. 
     */
    getMetadata(callback) {
        let project = this;
        Github.APIRequest("http://api.github.com/repos/" + project.info.full_name, (error, response, result) => {
            if (error)
                return callback(error, false);
            let i = project.info;
            // fill in the task project
            i.id = result.id;
            i.name = result.name
            i.full_name = result.full_name;
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
            // check if the project has changed since last time we have seen it, and if so, 
            if (i.updated_at === result.updated_at && i.pushed_at === result.pushed_at) {
                console.log("project " + project.info.fullName + " did not change, skipping...");
                callback(null, false);
            } else { 
                i.updated_at = result.updated_at;
                i.pushed_at = result.pushed_at;
                callback(null, true);
            }
        });
    }

    /** Clones the given project from github into a temporary directory and when done, calls the callback.
     */
    clone(callback) {
        let project = this;
        tmp.dir({ unsafeCleanup: true }, (err, path, cleanupCallback) => {
            if (err) 
                return callback("Unable to create temporary directory to clone the project");
            project.localDir = path;
            project.localDirCleanup = cleanupCallback;
            project.log("Cloning into " + project.localDir);
            // do the git clone
            Git.Clone(project, (error, cout, cerr) => {
                if (error)
                    return callback("unable to clone project");
                // record the time at which the project was cloned
                project.time.cloned = new Date().getTime() / 1000;
                project.log("Cloned");
                // call the callback
                callback(null);
            })
        });
    }

    getLatestBranchCommit(branchName, callback) {
        let project = this;
        Git.Query(project, "git checkout " + branchName, (error, cout, cerr) => {
            if (error)
                return callback("Unable to checkout branch " + branchName, null);
            Git.Query(project, "git rev-parse HEAD", (error, cout, cerr) => {
                if (error)
                    return callback("Unable to parse latest branch commit");
                callback(null, cout.trim());
            });
        });
    } 

    /** If the project was cloned, deletes the temporary folder. */
    cleanup_() {
        if (this.localDirCleanup) {
            this.log("Cleaning tmp dir " + this.localDir);
            this.localDirCleanup();
            this.localDirCleanup = null;
        }
        ++Project.Closed;
    }

    /** Saves the project information to the project.json file when the project has finished. */
    save_(callback) {
        let project = this;
        project.time.done = new Date().getTime() / 1000;
        // then save the project info
        fs.writeFile(project.path + "/project.json", JSON.stringify({
            info : project.info, 
            branches : project.branches,
            errors : project.errors,
            time : project.time
        }), (err) => {
            if (err)
                return project.fatalError(error, callback, "Unable to save project information when closing the project");
            callback();
        });
        
    }

    /** Encodes given name as project path, i.e. replaces special characters with _ followed by the ASCII hex code and takes first two letters as a subfolder to make sure that we do not end up with too many projects in same folder. 
     */
    static GetPath_(name) {
        let path = "";
        for (let i = 0; i < name.length; ++i) {
            let x = name[i];
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
        return outputDir + "/projects/" + path.substr(0, 2) + "/" + path;
    }
}

Project.Opened = 0;
Project.Closed = 0;
Project.Errors = 0;

class Commit {

    /** Task that analyzes the provided commit for given project.
     */
    static Analyze(project, commitHash, callback) {
        let commit = new Commit(commitHash);
        commit.loadPreviousResults((error) => {
            // if the commit is loaded, we are done with it and do not even need to recurse into its parents
            if (commit.loaded)
                return callback();
            // otherwise we fill in the commits 
        })

    }


    constructor(hash) {
        this.path = outputDir + "/commits/" + hash.substr(0, 3) + "/" + hash.substr(3, 3) + "/" + hash;
        this.files = []
        this.parents = []
        this.info = {
            hash : hash
        }
        // number of tasks depending on the commit 
        this.tasks = 1;
    }

    loadPreviousResults() {
        let commit = this;
        fs.readFile(commit.path, (err, data) => {
            if (! err) {
                let x = JSON.parse(data);
                commit.files = x.files;
                commit.parents = x.parents;
                commit.info = x.info;
                commit.loaded = true;
            }
            // not being able to load commit does not mean 
            callback(null);
        })
    }

}



let Q = null;

let projects = [];
let outputDir = null;


