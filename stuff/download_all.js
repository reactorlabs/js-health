const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require('readline');
const async = require("async");
const utils = require("./utils.js");

let apiTokenIndex_ = 0;
let contentHashes = {}
let contentHashId = 1

let outDir = null;;
let tmpDir = null;;
let apiTokens = null;
let maxFiles = 0;

module.exports = {

    /** Temprary directory where projects are to be downloaded */
    tmpDir: "",
    /** Output directory where the outputs of the downloader will be stored */
    outDir: "",
    /** Maximum number of files per folder. If 0, unlimited files can be stored in a folder. */
    maxFiles: 10,

    help: function() {
        console.log("");
        console.log("download PROJECTS_FILE OUTPUT [MAX_FILES]")
    },

    /** Loads all project urls from the input file into the queue. 
      */
    download: function(api_tokens) {
        apiTokens = api_tokens;
        if (process.argv.length < 5 || process.argv.length > 6) {
            module.exports.help();
            console.log("Invalid number of arguments for topStars action");
            process.exit(-1);
        }
        let filename = process.argv[3];
        outDir = process.argv[4];
        tmpDir = outDir + "/tmp";
        if (process.argv.length === 6)
            maxFiles = Number.parseInt(process.argv[5]);
        utils.mkdir(outDir, "-p");
        utils.mkdir(tmpDir, "-p");
        console.log("Getting all projects to load...")
        let projects = fs.readFileSync(filename, "utf8").split("\n");
        console.log("loaded " + projects.length + " projects");
        console.time("all");
        let index = 0
        let queue = async.queue(processProject, 1);
        queue.push({ name : projects[0], index : 0} );
        queue.drain = () => {
            console.timeEnd("all");
            console.log("KTHXBYE");
            process.exit();
        }
    },

    /**
     * Download and process every n + i^th project in a CSV file
     */
    git_js: function(api_tokens) {
	if (process.argv.length != 7) {
		console.log("Usage: node index.js git_js <file> <step> <index> <outDir>");
		process.exit(-1);
	}
	apiTokens = api_tokens;

	var filename = process.argv[3];
	var step = parseInt(process.argv[4]); 	
	var index = parseInt(process.argv[5]);
	var outputDir = process.argv[6];
	var stream;

	downloadAtIndex(index, filename, step, outputDir);
    }
}

/**
 * i: index
 * step: every n^th file to copy
 */
function downloadAtIndex(i, csvfilename, step, outputDir) {
	outDir = outputDir + "/" + i;
	tmpDir = outDir + "/tmp"; // temporary folder to download projects
	let projects = fs.readFileSync(csvfilename, "utf8").split("\n");
	let batch = []; // Files to process
	utils.mkdir(outDir + "/snapshots", "-p");

	// turn every n + i^th project into an object and store it
	for (var n = i; n < projects.length; n = n + step) {
		let p = projects[n].split(",");
		batch.push({ name : p[0], lang : p[1], fork : p[2], index: n, folder: i });
	}

	let threads = 1;
	let queue = async.queue(processProject, threads);
	queue.drain = () => {
		console.log("Job's done!");
		process.exit();
	}
	queue.push(batch);
}

/** Processes the given project.
 */
function processProject(project, callback) {
    LOG(project, "started processing project " + project.name);
    project.outDir = outDir + "/projects/" + project.index + getSubdirForId(project.index, "projects");
    async.waterfall([
        (callback) => { 
            child_process.exec("mkdir -p " + project.outDir, (error, cout, cerr) => {
                if (error)
                    callback(error, project);
                else
                    callback(null, project);
            });
        },
        downloadProject,
        getCommits,
        analyzeCommits,
        snapshotFiles,
        loadMetadata,
        storeProjectInfo, 
    ], (error, project) => {
        // if there has been an error, report it
        if (error)
            ERROR(project, error);
        // close the project being processed
        closeProject(project, callback)
    })
}

/** Clones the project
 */
function downloadProject(project, callback) {
    project.url =  "https://github.com/" + project.name;
    project.path = tmpDir + "/" + project.index;
    
    LOG(project, "downloading into " + project.path + "...");
    child_process.exec("git clone " + project.url + " " + project.path,
        (error, cout, cerr) => {
            if (error) {
                callback(error, project);
            } else {
                LOG(project, " downloading done");
                callback(null, project);
            }
        }
    );
}

/** Gets all the commits in the current branch, parses their hash & time into the project object.
 */
function getCommits(project, callback) {
    LOG(project, "getting project commits...");
    child_process.exec("git log --format=\"%at %H\"", { 
            cwd: project.path,
            maxBuffer: 1024 * 1024 * 20, // 20mb should be enough
        }, 
        (error, cout, cerr) => {
            if (error) {
                callback(error, project);
            } else {
                // process the commits
                commits = [];
                for (let line of cout.split("\n")) {
                    line = line.split(" ");
                    if (line.length !== 2)
                        continue;
                    commits.push({ time: Number(line[0]), hash: line[1] });
                } 
                LOG(project, commits.length + " commits found");
                callback(null, project, commits);
            }
        }
    );
}

function isValidFilename(filename) {
    if (filename.includes("node_modules"))
        return null; // denied file
    if (filename.endsWith(".js") || (filename.endsWith(".coffee") || (filename.endsWith(".litcoffee")) || (filename.endsWith(".ts"))))
        return true;
    if (filename === "package.json")
        return true;
    return false;
}

/** Analyzes the commits one by one */
function analyzeCommits(project, commits, callback) {
    let newsnapshots = [];
    LOG(project, "analyzing commits...");
    // files as of the latest commit so that the commit additions & deletions can be reconstructed
    let latestFiles = {}
    // project files, each file is a list of snapshots identified 
    project.files = {}
    let queue = async.queue((commit, callback) => {
        child_process.exec("git ls-tree -r " + commit.hash, {
            cwd: project.path,
            maxBuffer: 1024 * 1024 * 20, // 20mb should be enough
        }, 
        (error, cout, cerr) => {
            if (error) {
                // error stuff
            } else {
                // get list of all files in the current commit 
                let currentFiles = {};
                for (let line of cout.split("\n")) {
                    line = line.split("\t");
                    if (line.length !== 2)
                        continue;
                    let filename = line[1];
                    // only bother with valid filenames
                    if (isValidFilename(filename)) {
                        line = line[0].split(" ");
                        if (line.length !== 3)
                            continue;
			let hash = line[2];
                        currentFiles[filename] = hash;
                    }
                }
                // now compare this to the latest files, first lets detect any deleted files, i.e. files in latest that are not in current
                for (let filename in latestFiles) {
                    if (currentFiles[filename] === undefined) {
                        project.files[filename].push({ hash: 0, time: commit.time });
                    }
                }
                // now check all files in current, if their hash differs from the latest known, add record 
                for (let filename in currentFiles) {
                    let latest = latestFiles[filename];
                    if (latest === undefined || latest.hash !== currentFiles[filename]) {
                        let x = project.files[filename];
                        if (x === undefined) {
                            x = [];
                            project.files[filename] = x;
                        }
			let hash = currentFiles[filename];
			let id = historyHashToId(hash);
			 
			if (id < 0) {
				id = -id;
				newsnapshots.push({id : id, hash : hash});
			}
                        x.push({ hash: id, time: commit.time });
                    }
                }
                // our latest files are now the current files
                latestFiles = currentFiles;
            }
            // move to next commit
            callback();
        })

    }, 1);
    queue.push(commits.reverse());
    queue.drain = () => {
        // we have now checked all histories all files, let's do snapshots of the latest files where we need them
        callback(null, project, newsnapshots);
    }
}

/** Return id if hash found, store id & return -id if hash not found */
function historyHashToId(hash) {
    let result = contentHashes[hash];
    if (result === undefined) {
        contentHashes[hash] = contentHashId;
        return -contentHashId++;
    } else {
        return result;
    }
}

/** Returns a path for the given snapshot id using the hierarchical scheme */
function getSubdirForId(id, prefix) {
    if (maxFiles === 0)
        return "";
    let result = "";
    let min = 1;
    let max = maxFiles;
    let dirId = Math.floor(id / maxFiles);
    while (dirId !== 0) {
        result = result + "/" + prefix + "-" + (dirId % maxFiles);
        dirId = Math.floor(dirId / maxFiles);
    } 
    return result;
}

/** stores snapshots into files 

 Snapshots are not trivial to obtain due to the async nature of the program. When  
 TODO add compression & stuff
 */
function snapshotFiles(project, snapshots, callback) {
    let queue = async.queue((snapshot, callback) => {
    	child_process.exec("git cat-file -p " + snapshot.hash + " > " + outDir + "/snapshots/" + snapshot.id, {
		cwd: project.path,
	}, (error, cout, cerr) => {
			if (error) {
				console.log(error);
				ERROR(snapshot, "Unable to store snapshot " + snapshot.id);
			}
			callback();
		} );
	
    	}, 1);
	queue.push(snapshots);
    	queue.drain = () => {
       		callback(null, project);
	};
}

function loadMetadata(project, callback) {
    if (apiTokens.length == 0) {
        callback(null, project);
    } else {
        let token = apiTokens[apiTokenIndex_++];
        let apiUrl = "https://api.github.com/repos/" + project.name;
        if (apiTokenIndex_ == apiTokens.length)
            apiTokenIndex_ = 0;
        child_process.exec("curl -D metadata.headers -s " + apiUrl + " -H \"Authorization: token " + token + "\" -o metadata.json", {
            cwd: project.outDir
        }, (error, cout, cerr) => {
            if (error)
                ERROR(project, "Unable to download metadata from url " + apiUrl);
            callback(null, project);
        }); 
    }
}

function storeProjectInfo(project, callback) {
    LOG(project, "Storing project information");
    let projectFile = project.outDir + "/project.json";
    fs.writeFile(projectFile, JSON.stringify(project), (error) => {
        if (error) {
            ERROR(project, "Unable to store project.json, error:" + error);
            callback(error, project);
        } else {
            callback(null, project);
        }
    });
}

/** Deletes the project from disk. 
 */
function closeProject(project, callback) {
    LOG(project, "deleting...");

    // we are done with processing the project
    LOG(project, "DONE");
    // TODO change this, but for now only download the first 10 projects
    //if (project.index < 10)
    callback();
    return;
/*
    child_process.exec("rm -rf " + project.path, () => {
        // we are done with processing the project
        LOG(project, "ALL DONE");
        // TODO change this, but for now only download the first 10 projects
        if (project.index < 10)
            callback();
    }); */
}

function LOG(project, message) {
    console.log(project.index + ": " + message);
}

function ERROR(project, error) {
    project.error = error
    console.log(project.index+" ERROR: " + error);
}
