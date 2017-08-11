const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require('readline');
const async = require("async");


module.exports = {
    isFile: function (path) {
        return fs.existsSync(path) && fs.statSync(path).isFile();
    },

    isDir: function(path) {
        return fs.existsSync(path) && fs.statSync(path).isDirectory();
    },

    mkdir: function(path, extraArgs = "") {
        child_process.execSync("mkdir " + path + " " + extraArgs);
    },

    rm: function(path, extraArgs = "") {
        child_process.execSync("rm " + path + " " + extraArgs);
    },

    listProjects: function(path, num) {
        let result = new Array();
        for (let i = 0; i < num; ++i) {
            if (module.exports.isFile(path + "/" + i + ".json"))
                result.push({ path: path + "/" + i });
        }
        if (result.length !== num)
            console.log("Warning: Only " + result.length + " projects found...");
        return result;
    }

}