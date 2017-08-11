const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require('readline');
const async = require("async");

apiTokens = [
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
];


/* Downloads top starred projects of given language.
*/
function downloadStars(language, output, numProjects) {
    console.log("Dowbloading top " + numProjects + " projects...");
    console.log("  language:     " + language);
    console.log("  output dir:   " + output);
    let stars = undefined;
    let projects = {};
    let tidx = 0;
    let page = 11
    let url = ""
    let pid = 0;
    while (pid < numProjects) {
        if (page === 11) {
            url = "https://api.github.com/search/repositories?q=language:" + language;
            if (stars !== undefined) 
                url = url + "+stars:<=" + stars;
            url = url + "&sort=stars&order=desc&per_page=100";
            page = 1;
        }
        let cmd = "curl -s -H \"Authorization: token " + apiTokens[tidx] + "\" \"" + url + "&page=" + page + "\"";
        //console.log(cmd);
        let response = child_process.execSync(cmd)
        let json = JSON.parse(response);
        for (let project of json.items) {
            if (projects[project.url] === undefined) {
                projects[project.url] = true;
                stars = project.stargazers_count;
                console.log(project.url);
                child_process.execSync("git clone " + project.clone_url + " " + output + "/" + pid)
                fs.writeFileSync(output + "/" + pid + ".json", JSON.stringify(project));
                ++pid;
            }
        }
        page = page + 1
    }
    console.log("KTHXBYE");
}

let projects = new Array();


function fileExists(path) {
    return fs.existsSync(path) && fs.statSync(path).isFile();
}

/** Once the projects are downloaded, analyze if & how their code can be executed. */
function analyzeProject(output, id) {
    //let project = JSON.parse(fs.readFileSync(output + "/" + id + ".json"))
    //console.log(project.url);
    let path = output + "/" + id + "/";
    // get quick usage statictics 
    let p = {};
    projects.push(p);
    p.usesNPM = fileExists(path + "package.json");
    p.usesBower = fileExists(path + "bower.json");
    p.usesGrunt = fileExists(path + "Gruntfile.js");
    p.usesGulp = fileExists(path + "gulpfile.js"); 
    p.usesAppveyor = fileExists(path + "appveyor.yml");
    p.usesTravis = fileExists(path + ".travis.yml");
    p.usesKarma = fileExists(path + "karma.conf.js");
    p.usesKarma = p.usesKarma || fileExists(path + ".config/karma.conf.js");
    if (p.usesNPM) {
        try {
            let x = fs.readFileSync(path + "package.json", {encoding : "utf8"})
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
    if (p.usesGrunt) {
        let x = fs.readFileSync(path + "Gruntfile.js", {encoding : "utf8"})
        if (x.indexOf("grunt.registerTask('test'") !== -1)
            p.gruntTest = true;
        else if (x.indexOf("grunt.registerTask(\"test\"") !== -1)
            p.gruntTest = true;
    }
    // try analyzing the gulpfile
    if (p.usesGulp) {
        let x = fs.readFileSync(path + "gulpfile.js", {encoding : "utf8"})
        if (x.indexOf("gulp.task('test'") !== -1)
            p.gulpTest = true;
        else if (x.indexOf("gulp.task(\"test\"") !== -1)
            p.gulpTest = true;
    }
    // store the updated project JSON
    //fs.writeFileSync(output + "/" + pid + ".json", JSON.stringify(project));
}



function dncCompare(x, y) {
    if (x === undefined)
        return true;
    return (y !== undefined) && (x === y);
}

// npm, bower, grunt, gulp, appveyor, travis, karma
function sumProjects(options) {
    let result = 0;
    for (p of projects)
        if (dncCompare(options.npm, p.usesNPM) &&
            dncCompare(options.bower, p.usesBower) &&
            dncCompare(options.grunt, p.usesGrunt) &&
            dncCompare(options.gulp, p.usesGulp) &&
            dncCompare(options.appveyor, p.usesAppveyor) &&
            dncCompare(options.travis, p.usesTravis) &&
            dncCompare(options.karma, p.usesKarma) &&
            dncCompare(options.badPackageJson, p.badPackageJson) &&
            dncCompare(options.gruntTest, p.gruntTest) &&
            dncCompare(options.gulpTest, p.gulpTest) &&
            dncCompare(options.npmTest, p.npmTest))
            ++result;
    return result;
}

// npm, bower, grunt, gulp, appveyor, travis, karma
function sumTestable() {
    let result = 0;
    for (p of projects)
        if (p.npmTest || p.gruntTest || p.gulpTest)
            ++result;
    return result;
}

function analyzeNPM(output, id) {
    console.log("  analyzing package.json...")
    let pjson = JSON.parse(fs.readFileSync(output + "/" + id + "/package.json"));
    // see if the package specifies a way to run tests
    if (pjson.scripts.test !== undefined)
        return "npm test";
    if (pjson.scripts.tests !== undefined)
        return "npm tests";
    return undefined;
} 

function runTests(output, id) {
    let p = projects[id];
    if (p.npmTest || p.gulpTest || p.gruntTest) {
        console.log("Running tests for project " + id);
        if (!p.usesNPM) {
            console.log("  !!! not a NPM project")
        } else {
            console.log("  running npm install...")
            child_process.execSync("npm install", { cwd : output + "/" + id, timeout: 600000});
        }
        if (p.npmTest) {
            console.log("  npm test")
            try {
                child_process.execSync("npm test", { cwd: output + "/" + id, timeout: 600000 });
                return true;
            } catch (e) {
                console.log("    error running the tests, or non-zero exit");
            }
        }
        if (p.gulpTest) {
            console.log("  gulp test");
            try {
                child_process.execSync("gulp test", { cwd: output + "/" + id, timeout: 600000 });
                return true;
            } catch (e) {
                console.log("    error running the tests, or non-zero exit");
            }
        }
        if (p.gruntTest) {
            console.log("  grunt test");
            try {
                child_process.execSync("grunt test", { cwd: output + "/" + id, timeout: 600000 });
                return true;
            } catch (e) {
                console.log("    error running the tests, or non-zero exit");
            }
        }
    }
    return false;
}



output = "/data/googlejs/topStars"
for (let i = 0; i < 1000; ++i)
    analyzeProject(output, i);

console.log("Total projects        " + sumProjects({}));
console.log("NPM                   " + sumProjects({ npm: true }));
console.log("Grunt                 " + sumProjects({ grunt: true }));
console.log("Gulp                  " + sumProjects({ gulp: true }));
console.log("bower                 " + sumProjects({ bower: true }));
console.log("karma                 " + sumProjects({ karma: true }));
console.log("NPM test              " + sumProjects({ npmTest: true }));
console.log("Grunt test            " + sumProjects({ gruntTest: true }));
console.log("Gulp test             " + sumProjects({ gulpTest: true }));
console.log("bad package.json      " + sumProjects({ badPackageJson: true }));
console.log("TOTAL TESTABLE        " + sumTestable());

let success = 0;

for (let i = 0; i < 1000; ++i) {
    if (runTests(output, i))
        ++ success;
    console.log("Total: " + i, " success: " + success);

}

console.log("Successfull tests:  " + success);

process.exit();





//downloadStars("JavaScript","/data/googlejs/topStars", 1000);
//analyzeProject("/data/googlejs/topStars", 1)
//console.log(analyzeNPM("/data/googlejs/topStars", 27))

