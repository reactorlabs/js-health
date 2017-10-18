const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require('readline');
const async = require("async");
const utils = require("./utils.js");
const record_name = "record.json";
const time = 1000; // 10 seconds

var git_js_bool = false;

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
        queue.drain = () => {
            console.timeEnd("all");
            console.log("KTHXBYE");
            process.exit();
        }
        queue.push({ name : projects[0], index : 0} );
/*        const rl = readline.createInterface({
            input: fs.createReadStream(filename),
            console: false,
        });
        rl.on("line", (line) => {
            if (index < 10)
                queue.push({ 
                    name: line, 
                    index: index++
                });
            if (index == 10)
                rl.close()
        }) 
        rl.on("close", () => {
        }) */
    },

    git_js: function(api_tokens) {
	git_js_bool = true;
	if (process.argv.length != 6) {
		console.log("Usage: node index.js git_js <file> <step> <index>");
		process.exit(-1);
	}
	apiTokens = api_tokens;

	var filename = process.argv[3];
	var step = parseInt(process.argv[4]); 	
	var index = parseInt(process.argv[5]);
	var stream;

	downloadAtIndex(index, filename, step);
    }
}

function downloadAtIndex(i, csvfilename, step) {
	outDir = i;
	tmpDir = outDir + "/tmp";
	let projects = fs.readFileSync(csvfilename, "utf8").split("\n");
	let batch = [];

	for (var n = i; n < projects.length; n = n + step) {
		let p = projects[n].split(",");
		batch.push({ name : p[0], lang : p[1], fork : p[2], index: n, folder: i });
	}

	let queue = async.queue(processProject, 1); // I know this is terrible
	queue.drain = () => {
		console.log("Job's done!");
		process.exit();
	}
	//console.log(batch.length);
	//console.log(batch);
	queue.push(batch);
}

/** We need to distinguish between */
function historyHashToId(hash) {
    let result = contentHashes[hash];
    if (result === undefined) {
        contentHashes[hash] = -contentHashId;
        return contentHashId++;
    } else if (result < 0) {
        return -result;
    } else {
        return result;
    }
}

/** ??? */
function snapshotHashToId(hash) {
    let result = contentHashes[hash];
    if (result < 0)
        contentHashes[hash] = -result;
    return result;
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

function LOG(project, message) {
    console.log(project.index + ": " + message);
}

function ERROR(project, error) {
    project.error = error
    console.log(project.index+" ERROR: " + error);
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
        snapshotCurrentFiles,
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
    project.path = tmpDir + "/" + project.index; // TODO CH screwed this up.
    //project.path = outDir + "/" + project.index;
    
	LOG(project, "downloading into " + project.path + "...");
//    callback(null, project);
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
    if (filename.endsWith(".js"))
        return true;
    if (filename === "package.json")
        return true;
    return false;
}


/** Analyzes the commits one by one */
function analyzeCommits(project, commits, callback) {
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
                        currentFiles[filename] = line[2];
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
                        x.push({ hash: historyHashToId(currentFiles[filename]), time: commit.time });
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
        callback(null, project, latestFiles);
    }
}




    /** Takes given id and produces a path from it that would make sure the MaxFilesPerDirectory limit is not broken assuming full utilization of the ids.
    *
    static std::string IdToPath(long id, std::string const & prefix = "") {
        // when files per folder is disabled
        if (FilesPerFolder == 0)
            return "";
        std::string result = "";
        // get the directory id first, which chops the ids into chunks of MaxEntriesPerDirectorySize
        long dirId = id / FilesPerFolder;
        // construct the path while dirId != 0
        while (dirId != 0) {
            result = STR("/" << prefix << std::to_string(dirId % FilesPerFolder) << result);
            dirId = dirId / FilesPerFolder;
        }
        return result;
    } */




/* Copying and compressing the file snapshots is not a trivial task in the async process  */




let snapshotChunk = 0;
let snapshotIndex = 0;


let bankIndex_ = 0;
let freeBanks_ = [];



class Bank {

    static GetAvailable() {
        if (freeBanks_.length === 0) {
            return new Bank();
        } else {
            let result = freeBanks_[0];
            freeBanks_.splice(0, 1);
            return result;
        }
    }

    constructor() {
        this.index = bankIndex_++;
        this.ready = false;
        this.remaining = maxFiles;
        this.pending = 0;
        this.path = tmpDir+"/bank-" + this.index;
        this.archivename = this.index + " tar.xz";
    }

    release() {
        if (this.remaining > 0)
            freeBanks_.push(this);
    }

    compress(callback) {
        child_process.exec("tar cfJ " + this.archiveName + " *", {
                cwd: this.path, 
                maxBuffer: 1024 * 1024 * 20, // 20mb should be enough
        }, 
        (error, cout, cerr) => {
            callback(error);
        });
    }

    copyResults(callback) {
        let dest = outDir + "/files/" + this.archiveName;
        child_process.exec("cp " + this.archiveName + " " + dest, {
            cwd: this.path,
        }, (error, cout, cerr) => {
            callback(error);
        })
    }

    erase(callback) {
        child_process.exec("rm -rf " + this.path, (error, cout, cerr) => {
            callback(error);
        });
    }

}

function storeSnapshot(bank, file, project, callback) {
	rt
    let src = project.path + "/" + file.filename;
    let dest = bank.path + "/" + file.id;
    --bank.remaining;
    ++bank.pending;
    // copy the file to the bank's folder
    child_process.exec("cp \"" + src + "\" "+ dest, (error, cout, cerr) => {
        if (error)
            ERROR(project, "Unable to store snapshot " + desc, " error: " + error);
        --bank.pending;
        // if the bank has been filled and we are last 
        if (bank.pending === 0 && bank.remaining === 0) {
            // compress, copy, delete
            async.waterfall([
                (cb) => { 
                    LOG(project, " compressing full bank " + bank.index);
                    bank.compress(cb);
                },
                (cb) => { 
                    LOG(project, "copying compressed bank " + bank.archiveName);
                    bank.copyResults(cb); 
                },
                (cb) => { 
                    LOG(project, "erasing bank " + bank.index);
                    bank.erase(callback);
                 }
            ], (error) => {
                if (error)
                    ERROR(project, "An error occured when compressing & storing bank " + bank.index);
                // we are done with the compression
                callback();
            });
        } else {
            callback();
        }
    });
    // if we have used up the bank, return the next available, or new bank to the snapshot downloader
    if (bank.remaining === 0) {
        let newBank = Bank.GetAvailable();
        LOG(project, "Changing to bank " + newBank.index);
        return newBank;
    } else {
        return bank;
    }
}


/** Creates a snapshot of the current files as described in the latestFiles map. 

 Snapshots are not trivial to obtain due to the async nature of the program. When  
 TODO add compression & stuff
 */
function snapshotCurrentFiles(project, latestFiles, callback) {
    LOG(project, "creating snapshots of unique current project files " + Object.keys(latestFiles).length)
    // first get list of snapshots we want to store
    let snapshots = []
    for (let filename in latestFiles) {
        let hash = snapshotHashToId(latestFiles[filename]);
        if (hash < 0)
            snapshots.push({ filename: filename, id: -hash });
    }

    //if (git_js_bool == true) {
    //	snapshotWithoutBank(project, latestFiles, callback, snapshots);
    //}

    	LOG(project, snapshots.length + " files to snapshot...");
    // get a bank we store the files into
    //let bank = Bank.GetAvailable();
    //LOG(project, "writing into bank " + bank.index);
    // create a queue that would process the file snapshots into the current bank
    	var snapshot_dir = project.folder + "/snapshots";
    	child_process.exec("mkdir -p " + snapshot_dir, (error, cout, cerr) => {
    		if (error) {
			ERROR(project, "Unable to create snapshot path " + project.name);
			callback();
		}
    		let queue = async.queue((file, callback) => {
			let src = project.path + "/" + file.filename;
			let dest = snapshot_dir + "/" + file.id;
			console.log("SRC: " + src);
			console.log("DEST: " + dest);
			child_process.exec("cp \"" + src + "\" " + dest, (error, cout, cerr) => {
				if (error)
					ERROR(project, "Unable to store snapshot " + cerr, " error: " + error);
				callback(null, project);
				// write archivename to file
				// 
			} );
	
    		}, 1);
    		queue.drain = () => {
        		callback(null, project);
    		}
		queue.push(snapshots);
    	});

	
        //
	//  if (!bank.ready) {
        //    child_process.exec("mkdir -p " + bank.path, (error, cout, cerr) => {
        //        if (error) {
        //            ERROR(project, "Unable to create bank folder " + bank.path);
        //            callback();
        //        }
        //        bank.ready = true;
        //        bank = storeSnapshot(bank, file, project, callback);
        //    })
        //} else {
        //    bank = storeSnapshot(bank, file, project, callback);
        //}
	
        // release the bank so that others can use it
        //LOG(project, "releasing bank " + bank.index + ", remaining: " + bank.remaining);
        //bank.release();
        //LOG(project, "snapshots created");
    // schedule all the snapshots we have to be processed
}

/** Creates a snapshot of the current files as described in the latestFiles map. 

 Snapshots are not trivial to obtain due to the async nature of the program. When  
 TODO add compression & stuff
 */

/**
function snapshotWithoutBank(project, latestFiles, callback, snapshots) {

    let queue = async.queue((file, callback) => {
	   
	var snapshot_dir = project.folder + "/snapshots";
	child_process.exec("mkdir -p " + snapshot_dir, (error, cout, cerr) => {
		if (error) {
			ERROR(project, "Unable to create snapshot path " + project.name);
			callback();
		}
		child_process.exec("cp \"" + project.path + "/" + file.filename + "\" " + snapshot_dir, (error, cout, cerr) => {
			if (error) { ERROR(project, "Unable to store snapshot " + error, " error: " + error); }
			callback(null, project);
		});
		
	});
    }, 1);
    queue.drain = () => {
    	callback(null, project);
    }
    queue.push(snapshots);
	// TODO here
}
*/

let apiTokenIndex_ = 0;


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





