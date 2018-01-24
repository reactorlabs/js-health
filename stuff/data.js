const fs = require("fs");
const mkdirp = require("mkdirp")
const tmp = require("tmp");
const child_process = require("child_process");

const git = require("./git.js");
const github = require("./github.js");

let outputDir = "output"; // output directory where the stored data reside
let tmpDir = "tmp"; // temprary directory where the projects can be downloaded
let clearTmpDir = false; // clear the temp directory contents before starting
let keepClones = false; // should the cloned projects be kept, or deleted when the analysis finishes?

class Project {
    constructor (fullName) {
        this.fullName = fullName;
        this.branches = {};
        this.extras = {
            time : {

            },
            commits : 0,
            snapshots: 0,
            trackedSnapshots: 0,
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


    load(callback) {
	let p = this;
	let path = Project.GetPath_(this.fullName);
	fs.readFile(path.dir + path.filename, (err, data) => {
	    if (err)
		return callback(err);
	    try {
	        data = JSON.parse(data);
	    } catch (e) {
		return callback(e);
	    }
	    this.branches = data.branches;
	    this.extras = data.extras;
	    this.metadata = data.metadata;
	    callback(null);
	})
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
	if (!keepClones && this.localDirCleanup)
            this.localDirCleanup();
    }

    error(err, callback) {
        //console.log("! " + this.fullName + ": " + err);
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

    static Demangle(name) {
	let result = "";
	for (let i = 0; i < name.length; ++i) {
	    let x = name[i];
	    if (x === '_') {
		let hi = name.charCodeAt(i + 1);
		let lo = name.charCodeAt(i + 2);
		hi = (hi >= 97) ? hi - 87 : hi - 48;
		lo = (lo >= 97) ? lo - 87 : lo - 48;
		i += 2;
		x = String.fromCharCode(hi * 16 + lo);
	    }
	    result += x;
	}
	return result;
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
	if (typeof c === "string") {
	    this.hash = c;
	    this.parents = [];
	    this.info = {};
	} else {
            this.hash = c.hash;
            this.parents = c.parents;
            this.info = {
                date : c.date,
                author : c.author,
                authorEmail : c.authorEmail,
                message : c.message,
            }
	}
	this.files = [];
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

    load(callback) {
	let p = Commit.GetPath_(this.hash);
	fs.readFile(p.dir + p.filename, (err, data) => {
	    if (err)
		return callback(err);
	    try {
	        data = JSON.parse(data);
	    } catch (e) {
		return callback(e);
	    }
	    this.parents = data.parents;
	    this.files = data.files;
	    this.info = data.info;
	    this.extras = data.extras;
	    callback(null);
	})
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
        fs.access(path.dir + path.filename, (err) => {
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

module.exports = {

    Project : Project,
    
    Commit : Commit,

    Snapshot : Snapshot,

    OutputDir : () => {
        return outputDir;
    },

    TmpDir : () => {
        return tmpDir;
    },

    ClearTmpDirSync : (force = false) => {
        if (force || clearTmpDir) {
            console.log("clearing temporary directory..." + tmpDir);
            child_process.execSync("rm -rf " + tmpDir + "/*");
        }
    },

    ParseArguments : (args) => {
        for (let i = 0; i < args.length;) {
            if (args[i].startsWith("--out-dir=")) {
                outputDir = args[i].substr(10);
                if (!outputDir.endsWith("/"))
                    outputDir += "/";
            } else if (args[i].startsWith("--tmp-dir=")) {
                tmpDir = args[i].substr(10);
                if (!tmpDir.endsWith("/"))
                    tmpDir += "/";
            } else if (args[i] === "--clear-tmp-dir") {
                clearTmpDir = true;
		
            } else if (args[i] === "--keep-clones") {
		keepClones = true;
	    } else {
		++i;
                continue;
            }
            args.splice(i, 1);
        }
        console.log("data.OutputDir = " + outputDir);
        console.log("data.tmpDir = " + tmpDir);
        console.log("data.clearTmpDir = " + clearTmpDir);
    },

}


