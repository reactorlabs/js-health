const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require('readline');
const async = require("async");
const utils = require("./utils.js");

var self = module.exports = {
    help: function() {
        console.log("");
        console.log("testable OUTPUT NUM");
        console.log("    Looks for up to NUM projects in the OUTPUT directory and tries to");
        console.log("    determine if the projects' tests can be easily executed using npm,");
        console.log("    gulp, or grunt.");
        console.log("");
        console.log("runTests OUTPUT NUM");
        console.log("    Looks for up to NUM projects in the OUTPUT directory and tries to");
        console.log("    run their tests (in the same way as testable does). Package tests");
        console.log("    are considered ok if the test command exits normally, i.e. we do");
        console.log("    distinguish between failimng a test and failing to run any tests");
        console.log("    at all.");
    },

    analyzeProjects: function() {
        if (process.argv.length !== 5) {
            module.exports.help();
            console.log("Invalid number of arguments for topStars action");
            process.exit(-1);
        }
        let output = process.argv[3];
        let num = Number.parseInt(process.argv[4]);
        // get all projects we have
        let projects = utils.listProjects(output, num);
        for (let p of projects)
            analyzeProject(p);
        // some printing
        console.log("Total projects        " + sumProjects(projects));
        console.log("NPM                   " + sumProjects(projects, (p) => p.npm === true ));
        console.log("Grunt                 " + sumProjects(projects, (p) => p.grunt === true ));
        console.log("Gulp                  " + sumProjects(projects, (p) => p.gulp=== true ));
        console.log("bower                 " + sumProjects(projects, (p) => p.bower=== true ));
        console.log("karma                 " + sumProjects(projects, (p) => p.karma=== true ));
        console.log("NPM test              " + sumProjects(projects, (p) => p.npmTest=== true ));
        console.log("Grunt test            " + sumProjects(projects, (p) => p.gruntTest=== true ));
        console.log("Gulp test             " + sumProjects(projects, (p) => p.gulpTest=== true ));
        console.log("bad package.json      " + sumProjects(projects, (p) => p.badPackageJson=== true ));
        console.log("TOTAL TESTABLE        " + sumProjects(projects, (p) => p.npmTest || p.gulpTest || p.gruntTest ));
    },
   
    downloadTestProjects(apiTokens) {
	if (process.argv.length != 5) {
		console.log("Usage: node index.js downloadTestProjects <file> <outDir>");
		process.exit(-1);
	}
	console.log("Downloading test projects...");
	let max = apiTokens.length;
	let tidx = Math.floor(Math.random() * (max - 0) + 0); // Randomize api token to start
	let idx = 0;
    	let outpath = process.argv[4];
	let filename = process.argv[3];
	let projects = fs.readFileSync(filename, "utf8").split("\n");
	// curl the projects and just print them out
	for (let p of projects) {
		console.log(p);
		let cmd = "curl -s -H \"Authorization token " + apiTokens[tidx] + "\" \"" + p + "\"";
		let response = child_process.execSync(cmd);
		let json = JSON.parse(response);
		if (json.message === "Moved Permanently") {
			redirect = json.url;
			cmd = "curl -s -H \"Authorization token " + apiTokens[tidx] + "\" \"" + redirect + "\"";
			response = child_process.execSync(cmd);
			json = JSON.parse(response);
		}
		let clone_path = outpath + "/" + idx;
		let clone_cmd = "git clone " + json.clone_url + " " + clone_path;
		utils.mkdir(clone_path, "-p");		
		child_process.execSync(clone_cmd);
		fs.writeFileSync(outpath + "/" + idx + ".json", JSON.stringify(json));
		tidx = tidx + 1;
		idx = idx + 1;
		if (tidx > max) {
			tidx = 0;
		}
	}
    },

    runTests: function(d) {
        var testfile = "/testlengths.csv";
        var currentdir = process.cwd() + testfile;

	if (utils.isFile(currentdir)) {
	    fs.unlinkSync(currentdir);
    	} 

	let entries = [];
        if (process.argv.length !== 5) {
            module.exports.help();
            console.log("Invalid number of arguments for topStars action");
            process.exit(-1);
        }
        let output = process.argv[3];
        let num = Number.parseInt(process.argv[4]);
        // get all projects we have
        let projects = utils.listProjects(output, num);
        let success = 0;
        let i = 0;
        for (let p of projects) {
            analyzeProject(p);
	    var testresult = doRunTests(p, d);
	    if (testresult[1]) {
	        entries.push([p.path, testresult[1]]);
	    }
            if (testresult[0])
                ++success;
            ++i;
            console.log(">>> Analyzed " + i + " projects, successful tests " + success);
        }

	if (d) {
	    entries.sort(function(a, b) { return a[1] > b[1] ? 1 : -1; });
	//	console.log(entries);
	//	console.log(currentdir);
	    for (let e of entries) {
		    console.log(e);
	        fs.appendFileSync(currentdir, e.toString() + "\n");
	    }
	}
    },

    timeTests: function() {
	console.log("Timing project tests...");
    	self.runTests(true); 
    }
}

function sumProjects(projects, lambda = undefined) {
    let result = 0;
    for (p of projects)
        if (lambda === undefined || lambda(p))
            ++result;
    return result;
}

/** Once the projects are downloaded, analyze if & how their code can be executed. */
function analyzeProject(p) {
    utils.analyzeProjectTools(p);
    if (p.npm) {
        try {
            let x = fs.readFileSync(p.path + "/package.json", {encoding : "utf8"})
            let pjson = JSON.parse(x);
            // see if the package specifies a way to run tests
            if (pjson.scripts !== undefined) {
                if (pjson.scripts.test !== undefined)
                    p.npmTest = true;
//                else if (pjson.scripts.tests !== undefined)
//                    p.npmTest = true;
            }
        } catch (e) {
            p.badPackageJson = true;    
        }
    }
    // try analyzing the gruntfile
    if (p.grunt) {
        let x = fs.readFileSync(p.path + "/Gruntfile.js", {encoding : "utf8"})
        if (x.indexOf("grunt.registerTask('test'") !== -1)
            p.gruntTest = true;
        else if (x.indexOf("grunt.registerTask(\"test\"") !== -1)
            p.gruntTest = true;
    }
    // try analyzing the gulpfile
    if (p.gulp) {
        let x = fs.readFileSync(p.path + "/gulpfile.js", {encoding : "utf8"})
        if (x.indexOf("gulp.task('test'") !== -1)
            p.gulpTest = true;
        else if (x.indexOf("gulp.task(\"test\"") !== -1)
            p.gulpTest = true;
    }
    // store the updated project JSON
    //fs.writeFileSync(output + "/" + pid + ".json", JSON.stringify(project));
}

function doRunTests(p, d) {
    var start;
    var end;

    if (p.npmTest || p.gulpTest || p.gruntTest) {
        console.log("Running tests for project " + p.path);
        if (!p.npm) {
            console.log("  !!! not an NPM project");
        } else {
            console.log("  running npm install...");
	    try {
            	child_process.execSync("npm install", { cwd : p.path, timeout: 600000});
	    }
	    catch (e) {
		console.log("  Error on NPM install for " + p.path);
		console.log("  Resuming tests...");
		return [false, false];
	    }
        }
        if (p.npmTest) {
            console.log("  npm test")
            try {
	        start = new Date();
                child_process.execSync("npm test", { cwd: p.path, timeout: 600000 });
		end = new Date();
                return [true, end - start];
            } catch (e) {
                console.log("    error running the tests, or non-zero exit");
            }
        }
        if (p.gulpTest) {
            console.log("  gulp test");
            try {
		start = new Date();
                child_process.execSync("gulp test", { cwd: p.path, timeout: 600000 });
                end = new Date();
		return [true, end - start];
            } catch (e) {
                console.log("    error running the tests, or non-zero exit");
            }
        }
        if (p.gruntTest) {
            console.log("  grunt test");
            try {
		start = new Date();
                child_process.execSync("grunt test", { cwd: p.path, timeout: 600000 });
                end = new Date();
		return [true, end - start];
            } catch (e) {
                console.log("    error running the tests, or non-zero exit");
            }
        }
    }

    return [false, false];
}
