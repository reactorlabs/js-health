const fs = require("fs");
const async = require("async");
const mkdirp = require("mkdirp")
const tmp = require("tmp");
const child_process = require("child_process");
const LineByLineReader = require("line-by-line");

const git = require("./git.js");
const github = require("./github.js");
const data = require("./data.js");

let apiTokens = ""; // file where the github api tokens for downloading metadata can be located
let inputFile = ""; // input file with lists of projects to download & analyze
let skipExisting = false; // if true, projects already downloaded properly will be skipped
let stride = 1; // stride of analyzed projects for easy distribution and parallelism
let first = 0; // first project to analyze
let PQ_MAX = 100; // max number of preloaded project names
let W_MAX = 1; // max projects that can wait for analysis simultaneously (or be downloaded at the same time)
let numWorkers = 1; // number of workers
let langspec = null; // language specific settings

let verbose = false;

let blacklistedProjects = {}; // list of blacklisted projects that should not be analyzed or downloaded

let PQ = []; // project names queued for download
let PI = null; // input file with projects to analyze 
let Q = null; // worker queue for projects that are downloaded

// stats

let D = new Set(); // currently downloaded
let W = new Set(); // waiting to be analyzed
let A = new Set(); // currently analyzed 

let P = 0; // all projects;
let Pe = 0; // failed projects;
let C = 0; // all commits
let Cu = 0; // unique commits
let S = 0; // all snapshots
let St = 0; // tracked snapshots 
let Su = 0; // unique snapshots;

let projectIndex_ = 0; // index of currently read project from the input file

module.exports = {

    /** Full fledged   */
    Download : () => {
        ProcessCommandLine();
        DoDownload();
    },

    /** Runner is like the downloader, but executes the downloader script repeatedly until it is done and automatically blacklists failing projects.
     */
    Runner : () => {
	
    }
}


function ProcessCommandLine() {
    let args = process.argv.slice(3);
    data.ParseArguments(args);
    github.ParseArguments(args);

    if (args.length < 2) {
        console.log("Invalid number of arguments");
        console.log("see README.md");
        process.exit(-1);
    }
    inputFile = args[0];
    for (let i = 1; i < args.length; ++i) {
        let arg = args[i];
        if (arg == "--skip-existing") {
            skipExisting = true;
    	} else if (arg === "--verbose") {
            verbose = true;
        } else if (arg.startsWith("--first=")) {
            first = parseInt(arg.substr(8));
        } else if (arg.startsWith("--stride=")) {
            stride = parseInt(arg.substr(9));
        } else if (arg.startsWith("--max-pq=")) {
            PQ_MAX = parseInt(arg.substr(9));
        } else if (arg.startsWith("--max-w=")) {
            W_MAX = parseInt(arg.substr(8));
        } else if (arg.startsWith("--max-workers=")) {
            numWorkers = parseInt(arg.substr(14));
        } else if (arg.startsWith("--language=")) {
            let lang = arg.substr(11);
            if (langspec !== null) {
                console.log("Language can be specified only once");
                console.log("read README.md");
                process.exit(-1);
            }
            langspec = require("../languages/" + lang + ".js");
        } else if (arg.startsWith("--blacklist=")) {
	    let filename = arg.substr(12);
	    if (fs.existsSync(filename))
  	        blacklistedProjects = JSON.parse(fs.readFileSync(filename));
        } else {
            console.log("unknown argument: " + arg);
            console.log("see README.md");
            process.exit(-1);
        }
    }
    console.log("downloader.langspec = " + langspec.Name());
    console.log("downloader.inputFile = " + inputFile);
    console.log("downloader.skipExisting = " + skipExisting);
    console.log("downloader.verbose = " + verbose);
    console.log("downloader.first = " + first);
    console.log("downloader.stride = " + stride);
    console.log("downloader.maxPq = " + PQ_MAX);
    console.log("downloader.maxW = " + W_MAX);
    console.log("downloader.maxWorkers = " + numWorkers);
    console.log("downloader.blacklistedProjects = " + Object.keys(blacklistedProjects).length);
}

function DoDownload()  {
    data.ClearTmpDirSync();
    github.LoadTokensSync();
    // determines that all project have been a
    let allRead= false;
    // initialize and read command line arguments
    let t = new Date().getTime() / 1000;
    // create the reporter function
    let report = () => {
        console.log("---- " + DHMS(t));
        console.log(
            " PQ: " + PQ.length + 
            " D: " + D.size +
            " W: " + W.size +
            " A: " + A.size +
            " P: " + P + 
            " Pe " + Percentage(Pe, P) +
            " C: " + C + 
            " Cu: " + Percentage(Cu, C) +
            " S: " + S + 
            " St: " + Percentage(St, S) +
            " Su: " + Percentage(Su, St) 
        );
        console.log("D: " + GetSetItems(D, "fetchStart"));
        console.log("W: " + GetSetItems(W, "waitStart"));
        console.log("A: " + GetSetItems(A, "analysisStart"));
    }
    // create the analysis queue
    Q = new async.queue(AnalyzeProject, numWorkers);
    Q.drain = () => {
        // if all projects were read and none are waiting for analysis or being cloned, we can exit 
        if (allRead && W.size === 0 && D.size == 0) {
            report();
            console.log("KTHXBYE!");
            process.exit();
        }
    }
    // create the line by line reader for the input file (this may be very large so we are using line by line reader)
    PI = new LineByLineReader(inputFile);
    PI.on("end", () => {
        allRead = true;
    })
    // when a line is read, downloads the project. Pauses the reader if too many projects are being downloaded. Skips projects according to the first & string arguments
    PI.on("line", (line) => {
        ++projectIndex_;
        // if the project is smaller than first project we should look at, ignore it
        if (projectIndex_ < first)
            return;
        // also ignore projects of different strides  
        if ((projectIndex_ - first) % stride !== 0)
            return;
    	// get the project name and see if the project is blacklisted
	    let pname = line.split(",")[0];
	    if (blacklistedProjects[pname])
	        return;
        // add the project to queue of projects to be fetched, pauses reading if too many projects are downloaded
        PQ.push(pname);
        if (PQ.length >= PQ_MAX)
            PI.pause();
        // attempts to download the project immediately (pending free download slots)
        DownloadProject();
    });
    // if verbose, displays summary information 
    if (verbose) 
        setInterval(report, 10000);
}

function Percentage(value, max) {
    return value + " (" + Math.trunc(value/ max * 10000) / 100 + "%)"
}

function HMS(start) {
    let d = new Date().getTime() / 1000 - start;
    let s = d % 60;
    d = (d - s) / 60;
    let m = d % 60;
    d = (d - m) / 60;
    let h = (d % 24);
    s = Math.trunc(s);
    return h + ":" + m + ":" + s;
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

function GetSetItems(set, start) {
    let result = "";
    set.forEach((item) => { result += " " + item.fullName + "(" + HMS(item.extras.time[start]) + ")"});
    return result.substr(1);
}

function Error(project, err, callback) {
    ++Pe;
    project.error(err, callback);
}

function DownloadProject() {
    if (W.size < W_MAX && D.size < W_MAX && PQ.length > 0) {
        let project = new data.Project(PQ.shift());
        project.extras.time.fetchStart = new Date().getTime() / 1000,
        D.add(project);
        if (PQ.length < PQ_MAX)
            PI.resume();
        project.exists((does) => {
            if (does && skipExisting) {
                D.delete(project);
                //project.log("skipped");
                return DownloadProject();
            }
            //project.log("fetching...");
            project.getMetadata((err) => {
                if (err) {
                    D.delete(project);
                    ++P;
                    return Error(project, err, DownloadProject);
                }
                project.clone((err) => {
                    if (err) {
                        D.delete(project);
                        ++P; 
                        return Error(project, err, DownloadProject);
                    }
                    project.extras.time.fetch = new Date().getTime() / 1000 - project.extras.time.fetchStart;  
                    //project.log("scheduling...")
                    project.extras.time.waitStart = new Date().getTime() / 1000;
                    D.delete(project);
                    W.add(project);
                    Q.push(project);
                })
            });
        });
    }
}

function AnalyzeProject(project, callback) {
    W.delete(project);
    // since we have removed the project from waiting queue, see if there is some more projects to download
    DownloadProject();
    project.extras.time.analysisStart = new Date().getTime() / 1000;
    // this is here if we ever want to download more branches
    A.add(project);
    let callback2 = (err) => {
        ++P;
        A.delete(project);
        callback(err);
    }
    // log that we have started analyzing the project
    console.log("+" + project.fullName);
    AnalyzeBranch(project, project.metadata.default_branch, (err) => {
        if (err)
            return project.error(err, callback2);
        project.extras.time.analysis = new Date().getTime() / 1000 - project.extras.time.analysisStart;
        project.save((err) => {
            if (err)
                return Error(project, err, callback2);
            project.cleanup();
	    // log that we have closed analysis of the project successfully
	    console.log("-" + project.fullName);
            //project.log("done - fetch: " + project.extras.time.fetch + ", analysis: " + project.extras.time.analysis + ", commits: " + project.extras.commits + ", snapshots: " + project.extras.snapshots);
            callback2(null);
        })
    });

}

function AnalyzeBranch(project, branchName, callback) {
    //project.log("analyzing branch " + branchName)
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
                if (i < 0)
                    return callback(null);
                let c = new data.Commit(commits[i--]);
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
                ++S;
                ++project.extras.snapshots;
                commit.files.push(ch);
                if (langspec.TrackFile(project, ch.path)) {
                    ++St;
                    ++project.extras.trackedSnapshots;
                    if (ch.hash !== "0000000000000000000000000000000000000000") {
                        return data.Snapshot.Exists(ch.hash, (does) => {
                            if (does)
                                return f(null);
                            data.Snapshot.SaveAs(project, ch.hash, (err) => {
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



