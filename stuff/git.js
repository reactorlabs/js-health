const fs = require("fs");
const child_process = require("child_process");
const mkdirp = require("mkdirp");

module.exports = {
    Clone : (project, callback, retries = 10) => {
        child_process.exec("GIT_TERMINAL_PROMPT=0 git clone http://github.com/" + project.fullName + " " + project.localDir, {
            timeout: retries >= 5 ? 5 * 60000 : 60 * 60000, // 5 minutes or 1 hour 
        }, (err, cout, cerr) => {
            if (err) {
                if (retries === 0)
                    return callback(err);
                // otherwise try to retry the computation
                child_process.exec("rm -rf " + project.localDir, (err, cout, cerr) => {
                    if (err)
                        return callback(err);
                    mkdirp(project.localDir, (err) => {
                        if (err)
                            return callback(err);
                        console.log("retry...");
                        module.exports.Clone(project, callback, retries - 1);
                    });
                });
            } else {
                callback(null);
            }
        });
    },

    GetLatestCommit : (project, branchName, callback) => {
        child_process.exec('git log -n 1 --pretty=format:"%H" ' + branchName, {
            cwd : project.localDir,
        }, (err, cout, cerr) => {
            if (err)
                return callback(err);
            callback(err, cout.trim());
        });
    },

    GetCommits : (project, commitHash, callback) => {
        child_process.exec('git rev-list --pretty=format:"%P%n%at%n%an%n%ae%n%B%x03" ' + commitHash, {
            cwd : project.localDir,
            maxBuffer : 40 * 1024 * 1024,
        }, (err, cout, cerr) => {
            if (err)
                return callback(err);
            let commits = [];
            cout = cout.trim().split("\n");
            let i = 0;
            while (i < cout.length) {
                let c = {
                    hash : cout[i++].substr(7), // commit HASH
                    parents : cout[i++].split(" "), 
                    date : parseInt(cout[i++]),
                    author : cout[i++],
                    authorEmail : cout[i++],
                    message : "",
                }
		// initial commits have no parents, which the split reports as empty string in an array
		if (c.parents[0] === "" && c.parents.length == 1)
		    c.parents = [];
                // message is variable length, terminated with ASCII(3)
                while (cout[i].charCodeAt(0) !== 3) {
                    if (cout[i].charCodeAt(cout[i].length - 1) === 3) {
                        c.message += cout[i].substr(0,cout[i].length - 1);
                        break;
                    } else {
                        c.message += cout[i++] + "\n";
                    }
                }
                ++i;
                commits.push(c);
            }
            callback(null, commits);
        });
    },

    GetCommitChanges : (project, commit, callback) => {
        child_process.exec("git diff-tree --no-commit-id -r --root -m " + commit.hash, {
            cwd : project.localDir,
            maxBuffer : 40 * 1024 * 1024,
        }, (err, cout, cerr) => {
            if (err)
                return callback(err);
            let changes = [];
            for (let l of cout.trim().split("\n")) {
                if (l === "") // skip empty lines
                    continue;
                l = l.split("\t");
                l[0] = l[0].substr(1).split(" ");
                changes.push({
                    path : l[1],
                    mode : l[0][1],
                    hash : l[0][3],
                    status: l[0][4],
                });
            }
            callback(null, changes);
        });
    },

    SaveSnapshot : (project, hash, into, callback) => {
        child_process.exec("git cat-file -p " + hash + " > " + into, {
            cwd : project.localDir,
        }, (err, cout, cerr) => {
            callback(err);
        })
    },

    HashObject : (filename, callback) => {
	child_process.exec("git hash-object " + filename, (err, cout, cerr) => {
	    if (err)
		return callback(err);
	    return callback(null, cout.trim());
	} )
    }
}
