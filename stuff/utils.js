const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require('readline');
const async = require("async");


module.exports = {

    help: function() {
        console.log("");
        console.log("dev-freqs OUTPUT NUM MAXRESULTS");
        console.log("    Looks for up to NUM projects in the OUTPUT directory, loads their");
        console.log("    dependencies and sorts them by frequency. Prints the MAXRESULTS");
        console.log("    most frequently used ones.");
    },

    devFreqs: function() {
        if (process.argv.length !== 6) {
            module.exports.help();
            console.log("Invalid number of arguments for dev-freqs action");
            process.exit(-1);
        }
        let output = process.argv[3];
        let num = Number.parseInt(process.argv[4]);
        let maxResults = Number.parseInt(process.argv[5]);
        let projects = module.exports.listProjects(output, num);
        for (p of projects) {
            module.exports.analyzeProjectTools(p);
            module.exports.analyzeProjectDependencies(p);
        }
        let freqMap = {}
        for (let p of projects) {
            for (let d in p.dependencies) {
                if (freqMap[d] === undefined)
                    freqMap[d] = 1;
                else
                    ++freqMap[d]
            }
        }
        let freqs = new Array();
        for (let d in freqMap)
            freqs.push({ name: d, freq: freqMap[d] })
        freqs.sort((x, y) => y.freq - x.freq);

        for (let i = 0; i < Math.min(freqs.length, maxResults); ++i)
            console.log(freqs[i].name + ": " + freqs[i].freq);

        console.log("TOTAL UNIQUE DEPENDENCIES: " + freqs.length);
    },


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
        p.npm = module.exports.isFile(p.path + "/package.json");
        p.bower =  module.exports.isFile(p.path + "/bower.json");
        p.grunt =  module.exports.isFile(p.path + "/Gruntfile.js");
        p.gulp =  module.exports.isFile(p.path + "/gulpfile.js"); 
        p.appveyor =  module.exports.isFile(p.path + "/appveyor.yml");
        p.travis =  module.exports.isFile(p.path + "/.travis.yml");
        p.karma =  module.exports.isFile(p.path + "/karma.conf.js");
        p.karma = p.usesKarma ||  module.exports.isFile(p.path + "/.config/karma.conf.js");
    },

    /** Given a project with tools it uses, analyzes the dependencies of the project. Dependencies are in the form of depName: versionString, version string may be null if version cannot be determined */
    analyzeProjectDependencies: function(p) {
	p.dependencies = {};
	p.devDependencies = {};
	p.engines = {};
        if (p.npm) {
            try {
                let pjson = JSON.parse(fs.readFileSync(p.path + "/package.json", {encoding: "utf8"}));
                if (pjson.dependencies !== undefined) {
                	p.dependencies = pjson.dependencies;
                }
		if (pjson.devDependencies !== undefined) {
			p.devDependencies = pjson.devDependencies;
		}
		if (pjson.engines != undefined) {
			p.engines = pjson.engines;
		}
            } catch (e) {
                // pass
            }
        } 
    },

    addMetaData : function(project) {
	try {
    		let pjson = JSON.parse(fs.readFileSync(project.path + ".json", {encoding: "utf8"}));
		if (pjson.url !== undefined) {
			project.url = pjson.url;
		}
	} catch (e) {
		throw "Cannot parse project JSON";
	}
    },
}
