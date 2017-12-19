const fs = require("fs");
const async = require("async");
const mkdirp = require("mkdirp")
const tmp = require("tmp");
const child_process = require("child_process");
const LineByLineReader = require("line-by-line");

const git = require("./git.js");
const github = require("./github.js");

let apiTokens = "";
let inputFile = "";
let outputDir = ""; // output directory
let tmpDir = "/tmp"; // location of the temporary directory, a ramdisk is suggested
let skipExisting = false; // if true, projects already downloaded properly will be skipped
let stride = 1; // stride of analyzed projects for easy distribution and parallelism
let first = 0; // first project to analyze
let PQ_MAX = 100; // max number of preloaded project names
let W_MAX = 0; // max projects that can wait for analysis simultaneously (or be downloaded at the same time)
let numWorkers = 1; // number of workers



let PQ = []; // project names queued for download
let PI = null; // input file with projects to analyze 
let Q = null; // worker queue for projects that are downloaded


let D = new Set(); // currently downloaded
let W = new Set(); // waiting to be analyzed
let A = new Set(); // currently analyzed 

// stats

let P = 0; // all projects;
let Pe = 0; // failed projects;
let C = 0; // all commits
let Cu = 0; // unique commits
let S = 0; // all snapshots
let Su = 0; // unique snapshots;

let projectIndex_ = 0; // project index, used for strides calculation

module.exports = {

    Help: () => {
        console.log("")
        console.log("download TOKENS INPUT_FILE OUTPUT_DIR [OPTS]");
        console.log("    TOKENS = file where GitHub API tokens are located")
        console.log("    INPUT_FILE = csv file produced byt filter_projects stage with files to analyze");
        console.log("    OUTPUT_DIR = directory where the outputs will be stored (see below)")
        console.log("");
        console.log("Reads all projects in the input file, clones them and analyzes their commits on the main branch,")
        console.log("adding any new snapshots, commits, or projects to the output directory.")
        console.log("");
        console.log("Optional arguments:")
        console.log("")
        console.log("    --skip-existing - skips already downloaded projects")
        console.log("    --verbose - displays extra information every 10 seconds")
        console.log("    --first=N - sets index of the first project to analyze")
        console.log("    --stride=N - sets stride value for distributed analysis")
        console.log("    --max-pq=N - sets number of filenames to preload");
        console.log("    --max-w=N - sets number of prefetched projects");
        console.log("    --tmp-dir=PATH - sets the location of temporary directory")
        console.log("    --max-workers=N - sets the number of simultaneously analyzed projects")
    },

    Download : () => {
        let t = new Date().getTime() / 1000;
        apiTokens = process.argv[3];
        console.log("- github api tokens: " + apiTokens + " (" + github.LoadTokensSync(apiTokens) + ")");
        inputFile = process.argv[4];
        console.log("- input file : " + inputFile);
        outputDir = process.argv[5];
        if (! outputDir.endsWith("/"))
            outputDir += "/";
        console.log("- output dir: " + outputDir);
        for (let i = 6; i < process.argv.length; ++i) {
            let arg = process.argv[i];
            if (arg == "--skip-existing") {
                skipExisting = true;
                console.log("- skiping existing projects");
            } else if (arg === "--verbose") {
                verbose = true;
                console.log("- verbose mode enabled");
            } else if (arg.startsWith("--first=")) {
                first = parseInt(arg.substr(8));
                console.log("- first project id: " + first);
            } else if (arg.startsWith("--stride=")) {
                stride = parseInt(arg.substr(9));
                console.log("- stride : " + stride);
            } else if (arg.startsWith("--max-pq=")) {
                PQ_MAX = parseInt(arg.substr(9));
                console.log("- max-pq: " + PQ_MAX);
            } else if (arg.startsWith("--max-w=")) {
                W_MAX = parseInt(arg.substr(8));
                console.log("- max-w: " + W_MAX);
            } else if (arg.startsWith("--tmp-dir=")) {
                tmpDir = arg.substr(10);
                console.log("- temporary directory: " + tmpDir);
            } else if (arg.startsWith("--max-workers=")) {
                numWorkers = parseInt(arg.substr(14));
                console.log("- number of workers: " + numWorkers);
            }
        }

        // create the analysis queue
        Q = new async.queue(AnalyzeProject, numWorkers);
        Q.drain = () => {
            // if all projects were read and none are waiting for analysis or being cloned, we can exit 
            if (canExit && W.size === 0 && D.size == 0) {
                console.log("total time: " + (new Date().getTime() / 1000 - t));
                console.log("KTHXBYE!");
                process.exit();
            }
        }

        let canExit = false;
        PI = new LineByLineReader(inputFile);
        PI.on("end", () => {
            canExit = true;
        })
        PI.on("line", (line) => {
            ++projectIndex_;
            // if the project is smaller than first project we should look at, ignore it
            if (projectIndex_ < first)
                return;
            // also ignore projects of different strides  
            if ((projectIndex_ - first) % stride !== 0)
                return;
            PQ.push(line.split(",")[0]);
            if (PQ.length >= PQ_MAX)
                PI.pause();
            DownloadProject();
        });
        setInterval(() => {
            console.log("---- " + DHMS(t));
            console.log(
                " PQ: " + PQ.length + 
                " W: " + W.size +
                " D: " + D.size +
                " Q: " + Q.length() + 
                " A: " + A.size +
                " P: " + P + 
                " Pe " + Percentage(Pe, P) +
                " C: " + C + 
                " Cu: " + Percentage(Cu, C) +
                " S: " + S + 
                " Su: " + Percentage(Su, S) 
            );
            console.log("D: " + GetSetItems(D));
            console.log("W: " + GetSetItems(W));
            console.log("A: " + GetSetItems(A));
        }, 10000);
    }
}


function Percentage(value, max) {
    return value + " (" + Math.trunc(value/ max * 10000) / 100 + "%)"
}

function DHMS(start) {
    let d = new Date().getTime() / 1000 - start;
    let s = d % 60;
    d = (d - s) / 60;
    let m = d % 60;
    d = (d - m) / 60;
    let h = (d % 24);
    d = (d - h) / 24;
    s = Math.trunc(s);
    return d + ":" + h + ":" + m + ":" + s;

}

function GetSetItems(set) {
    let result = "";
    set.forEach((item) => { result += " " + item});
    return result.substr(1);
}

function TrackFile(project, path) {
    if (path.includes("node_modules")) {
        // TODO mark in the project
        return null; // denied file
    }
    if (path.endsWith(".js") || (path.endsWith(".coffee") || (path.endsWith(".litcoffee")) || (path.endsWith(".ts"))))
        return true;
    if (path === "package.json")
        return true;
    // TODO perhaps add gulpfiles, gruntfiles, travis, etc. ?
    return false;
}

function DownloadProject() {
    if (W.size < W_MAX && D.size < W_MAX && PQ.length > 0) {
        let project = new Project(PQ.shift());
        D.add(project.fullName);
        if (PQ.length < PQ_MAX)
            PI.resume();
        project.exists((does) => {
            if (does && skipExisting) {
                D.delete(project.fullName);
                project.log("skipped");
                return DownloadProject();
            }
            project.log("fetching...");
            project.getMetadata((err) => {
                if (err) {
                    D.delete(project.fullName);
                    ++P; ++Pe;
                    return project.error(err, DownloadProject);
                }
                project.extras.time = {
                    clone : new Date().getTime() / 1000,
                }
                project.clone((err) => {
                    if (err) {
                        D.delete(project.fullName);
                        ++P; ++Pe;
                        return project.error(err, DownloadProject);
                    }
                    project.extras.time.clone = new Date().getTime() / 1000 - project.extras.time.clone;  
                    project.log("scheduling...")
                    D.delete(project.fullName);
                    W.add(project.fullName);
                    Q.push(project);
                })
            });
        });
    }
}

function AnalyzeProject(project, callback) {
    W.delete(project.fullName);
    DownloadProject();
    // this is here if we ever want to download more branches
    A.add(project.fullName);
    let callback2 = (err) => {
        ++P;
        A.delete(project.fullName);
        callback(err);
    }
    project.extras.time.analysis = new Date().getTime() / 1000;
    AnalyzeBranch(project, project.metadata.default_branch, (err) => {
        if (err)
            return project.error(err, callback2);
        project.extras.time.analysis = new Date().getTime() / 1000 - project.extras.time.analysis;
        project.save((err) => {
            if (err)
                return project.error(err, callback2);
            project.cleanup();
            project.log("done - clone: " + project.extras.time.clone + ", analysis: " + project.extras.time.analysis + ", commits: " + project.extras.commits + ", snapshots: " + project.extras.snapshots);
            callback2(null);
        })
    });

}

function AnalyzeBranch(project, branchName, callback) {
    project.log("analyzing branch " + branchName)
    git.GetLatestCommit(project, branchName, (err, commitHash) => {
        if (err)
            return callback(err);
        project.branches[branchName] = commitHash;
        git.GetCommits(project, commitHash, (err, commits) => {
            if (err)
                return callback(err);
            let i = commits.length - 1;
            let f = (err) => {
                if (err)
                    return callback(err);
                if (i < 0) {
                    // TODO save the commit etc etc
                    return callback(null);
                }
                let c = new Commit(commits[i--]);
                AnalyzeCommit(project, c, f);
            }
            f(null);
        })
    });
}

function AnalyzeCommit(project, commit, callback) {
    ++C;
    ++project.extras.commits;
    //project.log("analyzing commit " + commit.hash);
    commit.exists((does) => {
        if (does)
            return callback(null);
        git.GetCommitChanges(project, commit, (err, changes) => {
            if (err)
                return callback(err);
                let i = 0;
            let f = (err) => {
                if (err)
                    return callback(err);
                if (i == changes.length) 
                    return commit.save((err) => {
                        if (err)
                            return callback(err);
                        ++Cu;
                        callback(null);
                    });
                let ch = changes[i++];
                if (TrackFile(project, ch.path)) {
                    commit.files.push(ch);
                    ++project.extras.snapshots;
                    ++S;
                    if (ch.hash !== "0000000000000000000000000000000000000000") {
                        return Snapshot.Exists(ch.hash, (does) => {
                            if (does)
                                return f(null);
                            Snapshot.SaveAs(project, ch.hash, (err) => {
                                if (err)
                                    return callback(err);
                                ++Su;
                                f(null);
                            });
                        });
                    }
                }
                f(null);
            }
            f(null);
        })
    });
}

class Project {
    constructor (fullName) {
        this.fullName = fullName;
        this.branches = {};
        this.extras = {
            commits : 0,
            snapshots: 0,
        };
    }

    exists(callback) {
        let path = Project.GetPath_(this.fullName);
        fs.access(path.dir + path.filename, (err) => {
            if (err)
                callback(false);
            else
                callback(true);
        });
    }

    save(callback) {
        let data = {
            fullName : this.fullName,
            branches : this.branches,
            extras : this.extras,
            metadata : this.metadata,
        }
        let path = Project.GetPath_(this.fullName);
        mkdirp(path.dir, (err) => {
            if (err)
                return callback(err);
            fs.writeFile(path.dir + path.filename, JSON.stringify(data), callback);
        })
    }

    cleanup() {
        if (this.localDirCleanup)
            this.localDirCleanup();
    }

    error(err, callback) {
        ++Pe;
        console.log("! " + this.fullName + ": " + err);
        this.cleanup();
        callback(err);
    }

    log(message) {
        console.log("> " + this.fullName + ": " + message);
    }

    getMetadata(callback) {
        let p = this;
        github.Request("repos/" + this.fullName, (err, data) => {
            if (err)
                return callback(err);
            p.metadata = data;
            callback(null);
        });
    }

    clone(callback) {
        let p = this;
        tmp.tmpName({
            dir : tmpDir,
        }, (err, path) => {
            if (err)
                return callback(err);
            mkdirp(path, (err) => {
                if (err)
                    return callback(err);
                p.localDir = path;
                p.localDirCleanup = () => {
                    child_process.exec("rm -rf " + path, (err, cout, cerr) => {});
                }
                git.Clone(this,callback);
            });
        });
    }

    static GetPath_(fullName) {
        let filename = "";
        for (let i = 0; i < fullName.length; ++i) {
            let x = fullName[i];
            if (
                (x >= '0' && x < '9') ||
                (x >= 'a' && x < 'z') ||
                (x >= 'A' && x < 'Z') ||
                (x == '-')
            ) {
                filename += x;
            } else {
                filename = filename + '_';
                x = x.charCodeAt(0);
                let xx = Math.floor(x / 16);
                filename += xx.toString(16);
                xx = x % 16;
                filename += xx.toString(16);
            }
        }

        return {
            dir : outputDir + "projects/" + filename.substr(0,3) + "/",
            filename: filename,
        };
    }
}

class Commit {
    constructor (c) {
        this.hash = c.hash;
        this.parents = c.parents;
        this.files = [];
        this.info = {
            date : c.date,
            author : c.author,
            authorEmail : c.authorEmail,
            message : c.message,
        }
        this.extras = {};
    }

    exists(callback) {
        let p = Commit.GetPath_(this.hash);
        fs.access(p.dir + p.filename, (err) => {
            if (err)
                callback(false);
            else
                callback(true);
        });
    }

    save(callback) {
        let data = {
            hash : this.hash,
            parents : this.parents,
            files : this.files,
            info : this.info,
            extras : this.extras,
        }
        let path = Commit.GetPath_(this.hash);
        mkdirp(path.dir, (err) => {
            if (err)
                return callback(err);
            fs.writeFile(path.dir + path.filename, JSON.stringify(data), callback);
        });
    }

    static GetPath_(hash) {
        return {
            dir : outputDir + "commits/" + hash.substr(0,2) + "/" + hash.substr(2,2) + "/",
            filename : hash.substr(4),
        };
    }
}

class Snapshot {

    static Exists(hash, callback) {
        let path = Snapshot.GetPath_(hash);
        fs.access(path.dir, (err) => {
            if (err)
                callback(false);
            else
                callback(true);
        })
    }

    static SaveAs(project, hash, callback) {
        let path = Snapshot.GetPath_(hash);
        mkdirp(path.dir, (err) => {
            if (err)
                return callback(err);
            git.SaveSnapshot(project, hash, path.dir + path.filename, callback);
        })
    }

    static GetPath_(hash) {
        return {
            dir : outputDir + "snapshots/" + hash.substr(0, 2) + "/" + hash.substr(2,2) + "/",
            filename : hash.substr(4),
        };
    }


}


