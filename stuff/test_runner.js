const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require('readline');
const async = require("async");
const utils = require("./utils.js");

module.exports = {
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
    
    runTests: function() {
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
            if (doRunTests(p))
                ++success;
            ++i;
            console.log(">>> Analyzed " + i + " projects, successful tests " + success);
        }
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
    p.npm = utils.isFile(p.path + "/package.json");
    p.bower = utils.isFile(p.path + "/bower.json");
    p.grunt = utils.isFile(p.path + "/Gruntfile.js");
    p.gulp = utils.isFile(p.path + "/gulpfile.js"); 
    p.appveyor = utils.isFile(p.path + "/appveyor.yml");
    p.travis = utils.isFile(p.path + "/.travis.yml");
    p.karma = utils.isFile(p.path + "/karma.conf.js");
    p.karma = p.usesKarma || utils.isFile(p.path + "/.config/karma.conf.js");
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

function doRunTests(p) {
    if (p.npmTest || p.gulpTest || p.gruntTest) {
        console.log("Running tests for project " + p.path);
        if (!p.npm) {
            console.log("  !!! not a NPM project")
        } else {
            console.log("  running npm install...")
            child_process.execSync("npm install", { cwd : p.path, timeout: 600000});
        }
        if (p.npmTest) {
            console.log("  npm test")
            try {
                child_process.execSync("npm test", { cwd: p.path, timeout: 600000 });
                return true;
            } catch (e) {
                console.log("    error running the tests, or non-zero exit");
            }
        }
        if (p.gulpTest) {
            console.log("  gulp test");
            try {
                child_process.execSync("gulp test", { cwd: p.path, timeout: 600000 });
                return true;
            } catch (e) {
                console.log("    error running the tests, or non-zero exit");
            }
        }
        if (p.gruntTest) {
            console.log("  grunt test");
            try {
                child_process.execSync("grunt test", { cwd: p.path, timeout: 600000 });
                return true;
            } catch (e) {
                console.log("    error running the tests, or non-zero exit");
            }
        }
    }
    return false;
}
