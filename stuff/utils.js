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
    }, 

    /** Given a project with `path` property, determines which tools the project uses. */
    analyzeProjectTools : function(p) {
        p.npm = utils.isFile(p.path + "/package.json");
        p.bower = utils.isFile(p.path + "/bower.json");
        p.grunt = utils.isFile(p.path + "/Gruntfile.js");
        p.gulp = utils.isFile(p.path + "/gulpfile.js"); 
        p.appveyor = utils.isFile(p.path + "/appveyor.yml");
        p.travis = utils.isFile(p.path + "/.travis.yml");
        p.karma = utils.isFile(p.path + "/karma.conf.js");
        p.karma = p.usesKarma || utils.isFile(p.path + "/.config/karma.conf.js");
    },

    /** Given a project with tools it uses, analyzes the dependencies of the project. Dependencies are in the form of depName: versionString, version string may be null if version cannot be determined */
    analyzeProjectDependencies: function(p) {
        if (p.npm) {
            let pjson = JSON.parse(p.path + "/package.json");
            if (pjson.dependencies === undefined) 
                p.dependencies = {}
            else
                p.dependencies = pjson.dependencies
        } else {
            p.dependencies = {}
        }
    },

}