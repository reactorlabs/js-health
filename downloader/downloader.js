const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require('readline');
const async = require("async");


let contentHashes = {}
let contentHashId = 1



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
    if (module.exports.maxFiles === 0)
        return "";
    let result = "";
    let min = 1;
    let max = module.exports.maxFiles;
    let dirId = Math.floor(id / module.exports.maxFiles);
    while (dirId !== 0) {
        result = result + "/" + prefix + "-" + (dirId % module.exports.maxFiles);
        dirId = Math.floor(dirId / module.exports.maxFiles);
    } 
    return result;
}


module.exports = {

    /** Temprary directory where projects are to be downloaded */
    tmpDir: "",
    /** Output directory where the outputs of the downloader will be stored */
    outDir: "",
    /** Maximum number of files per folder. If 0, unlimited files can be stored in a folder. */
    maxFiles: 10,

    apiTokens: [
        "36df491663476ff4a13d53188253d43b5ef6d3c9",
        "38b337acfbf2bf1b3f463b3740043af40cccc203",
        "c74552cfd1b19711c1c055f90a4e08f86235e3d0",
        "ee746f6db8dbf93fbff7fafe271a31655be3e16f",
        "cb8b7cbf29474d699df19a00336b6c59e0f612f7",
        "92095b8c476f2a60094f0bde0796ff87a031a33d",
        "458d90ed712be7f75460ff25b4857a0f227a0490",
        "d3732a58fc25b6f28be2b8972f804bfeb228aa4d",
        "9c4c7852e18fd733a8cbe72dcd57e7eaa74eadf2",
        "5b3eecad3542f79f60a8d07d5b223b2ee5cfca69",
        "a7b6f8d11d54c790c1760b1a218c245b2695478f",
        "b0a73acba4b7c13709e34e48f9447139c8b5430f",
        "db30ea5d5d1f2faee9d1a83cc5a18869def7b533",
        "ed7b4743c569889f03aedaaa261b2c45cdaf3fa3",
        "0ef61a78d30a53117ae4216576cb7c232b0a7e9f",
        "bed58f3e8b3fbd28656be1d80569d9d36cd139d6",
        "6d1ae7b41590af63465c5ee35cc3b3e4b5ffb4bc",
        "cfb81b5dd3ea04fc7d05aa59b7b83639835e8f05",
        "308a5b847b2d451ce44af6d1ab06ea89d64cd94f",
        "60ae2dbdfcd0023ce41d67ef0a49805aae3c80b2",
        "a0a5e516fb26bbe639dd6674972741c2b2243a8c",
        "81589da5c47794358a3b0e07307f90a420595629",
        "87e726374c61e399466dacf2d462c5f96205d0e5",
        "c44c3241c7ccb284a3d9661d65e8ceecffab4e5b",
        "a05a3989285f7c6fc463c77c35a86c6095e72945",
        "e0fb6a7a249566d695f3cc9ab7c148864497775d",
        "8a6eceeb42faeb861a451df1e01b031b4e5a593a"
    ],
    


    /** Downloads the github projects from the
      */
    downloadProjects: function(filename) {
        child_process.execSync("mkdir -p " + module.exports.outDir + "/files");
        console.log("Getting all projects to load...")
        let projects = fs.readFileSync(filename, "utf8").split("\n");
        console.log("loaded " + projects.length + " projects");
        console.time("all");
        let index = 0
        let queue = async.queue(processProject, 1);
        queue.drain = () => {
            console.timeEnd("all");
            console.log("ALL DONE");
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
    }
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
    project.projectDir = module.exports.outDir + "/projects" + getSubdirForId(project.index, "projects");
    async.waterfall([
        (callback) => { callback(null, project) },
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
    project.path = module.exports.tmpDir + "/" + project.index;
    LOG(project, "downloading into " + project.path + "...");
    callback(null, project);
/*
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
    */
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
        this.remaining = module.exports.maxFiles;
        this.pending = 0;
        this.path = module.exports.tmpDir+"/bank-" + this.index;
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
        let dest = module.exports.outDir + "/files/" + this.archiveName;
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

 Snapshots are not trivial to obtrain due to the async nature of the program. When  
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
    LOG(project, snapshots.length + " files to snapshot...");
    // get a bank we store the files into
    let bank = Bank.GetAvailable();
    LOG(project, "writing into bank " + bank.index);
    // create a queue that would process the file snapshots into the current bank
    let queue = async.queue((file, callback) => {
        if (!bank.ready) {
            child_process.exec("mkdir -p " + bank.path, (error, cout, cerr) => {
                if (error) {
                    ERROR(project, "Unable to create bank folder " + bank.path);
                    callback();
                }
                bank.ready = true;
                bank = storeSnapshot(bank, file, project, callback);
            })
        } else {
            bank = storeSnapshot(bank, file, project, callback);
        }
    }, 1);
    queue.drain = () => {
        // release the bank so that others can use it
        LOG(project, "releasing bank " + bank.index + ", remaining: " + bank.remaining);
        bank.release();
        LOG(project, "snapshots created");
        callback(null, project);
    }
    // schedule all the snapshots we have to be processed
    queue.push(snapshots);
}

let apiTokenIndex_ = 0;


function loadMetadata(project, callback) {
    if (module.exports.apiTokens.length == 0) {
        callback(null, project);
    } else {
        let token = module.exports.apiTokens[apiTokenIndex_++];
        if (apiTokenIndex_ == module.exports.apiTokens.length)
            apiTokenIndex_ = 0;
        child_process.exec("curl -D metadata.headers -s " << project.apiUrl << "-H \"Authorization: token " + token + "\" -o metadata.json", {
            cwd: proj
        }
        )



    }
//     std::string req = STR("curl -D metadata.headers -s " << apiUrl() << " -H \"Authorization: token " << token << "\" -o metadata.json");


    callback(null, project);

}

function storeProjectInfo(project, callback) {
    LOG(project, "Storing projct information");
    let projectFile = module.exports.outDir + "/projects" + getSubdirForId(project.index, "projects") + "/" + project.index;
    child_process.exec("mkdir -p " + projectFile, (error, cout, cerr) => {
        if (error) {
            ERROR(project, "Unable to create project dir " + projectFile);
            callback(error, project);
        } else {
            fs.writeFile(projectFile + "/project.json", JSON.stringify(project), (error) => {
                if (error) {
                    ERROR(project, "Unable to store project.json, error:" + error);
                    callback(error, project);
                } else {
                    callback(null, project);
                }
            })
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
    if (project.index < 10)
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







let n = 0









/** Downloads the project from github 
function downloadProject(project, callback) {
    project.url =  "https://github.com/" + project.name;
    project.path = module.exports.tmpDir + "/" + project.index
    child_process.exec("git clone " + project.url + " " + project.path, 
        (error, cout, cerr) => {
            if (error) {
                console.error("Unable to download project " + project.url + ", error: " + error);        
                closeProject(project, callback);
            } else {
                console.log("PROJECT " + project.index + " downloaded");
                analyzeProject(project, callback);
            }
        }
    );
}

function analyzeProject(project, callback) {

}





function analyzeProjectX(project, callback) {
    // get all files available in the repository
    child_process.exec("git ls-tree --full-tree -r HEAD", {
        cwd : project.path,
    }, (error, cout, cerr) => {
        // split line by line
        project.totalFiles = 0
        project.blacklistedFiles = 0;
        project.downloadedFiles = 0;
        let files = []
        for (let line of cout.split("\n")) {
            let filename = line.split("\t")[1];
            if (filename === undefined)
                continue;
            ++project.totalFiles;
            let allow = isValidFilename(filename);
            if (allow === undefined) {
                ++project.blacklistedFiles;
            } else if (allow) {
                ++project.downloadedFiles;
                files.push(filename);
            }
        }
        console.log("PROJECT " + project.index);
        console.log("  Total Files :" + project.totalFiles);
        console.log("  Blacklisted :" + project.blacklistedFiles);
        console.log("  Downloaded  :" + project.downloadedFiles);
        // get list of all commits 





        closeProject(project, callback);
    });
}


/** Analyzes the given commit 
function analyzeCommit(task, callback) {
    // extract project & commit from the task
    project = task.project;
    commit = task.commit;
    child_process.exec("git ls-tree " + commit, {
        cwd: project.path,
    }, (error, cout, cerr) => {
        for (let f of cout.split("\n")) {

        }
    });
}






function closeProject(project, callback) {
    child_process.exec("rm -rf " + project.path, () => {
        if (project.index < 10)
            callback();
    });
}

/*
function upload_file(file, callback) {
    // Do funky stuff with file
    callback();
}

var queue = async.queue(upload_file, 10); // Run ten simultaneous uploads

queue.drain = function() {
    console.log("All files are uploaded");
};

// Queue your files for upload
queue.push(files);

queue.concurrency = 20; // Increase to twenty simultaneous uploads
/**
var lineReader = require('readline').createInterface({
  input: require('fs').createReadStream('file.in')
});

lineReader.on('line', function (line) {
  console.log('Line from file:', line);
});

*/