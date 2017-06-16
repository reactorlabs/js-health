const d = require("./downloader/downloader.js");


function createRandomSHA() {
    let hash = "";
    let ascii = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( let i=0; i < 40; ++i )
        hash += ascii.charAt(Math.floor(Math.random() * ascii.length));
    return hash;
}

function speedtest(count) {
    let map = {}
    let index = 0;
    console.time("fill");
    while (index < count) {
        hash = createRandomSHA();
        if (map[hash] !== undefined)
            continue
        map[hash] = index++;
    }
    console.timeEnd("fill");



    console.log('Press any key to exit');

    process.stdin.resume();
    process.stdin.on('data', process.exit.bind(process, 0));
}









/** Main stuff */

console.log("OH HAI! IZ I SICK?")

d.tmpDir = "/data/downloader"
d.outDir = "/data/outdir"

d.downloadProjects("/data/test_hdd/input_no_forks.csv")

//speedtest(10000000);


console.log("KTHXBYE")
/**





//import {readFileSync} from "fs";

const acorn = require("acorn")
const acorn_loose = require("acorn/dist/acorn_loose")
const fs = require("fs");
const tmp = require('tmp');
const child_process = require("child_process");
const path = require("path");

/* Takes the archive, which should contain compressed raw snapshots of javascript files and parses them using the acorn JS parser. Replaces the archive with an archive containing raw files, parsed ASTs in EStree format and the comments found in the files.

If there are errors, stores them too.  
 * /
function parseArchive(name) {
    let tmpDir = tmp.dirSync({ unsafeCleanup: true });
    console.log("decompressing archive " + name)
    child_process.execSync("tar xf " + name + " -C " + tmpDir.name);
    console.log("reading directory...")
    let files = fs.readdirSync(tmpDir.name);
    console.log("parsing " + files.length + " files...");
    let passCount = 0;
    let failCount = 0;
    for (let file of files) 
        if (path.extname(file) === ".raw")
            if (parseFile(file, tmpDir.name))
                passCount += 1;
            else
                failCount += 1;
        else
            console.error("Invalid file detected: " + file + " in archive " + name);
    console.log("    passed: " + passCount);
    console.log("    failed: " + failCount);
    console.log("archiving...");
    child_process.execSync("tar cfJ " + name + " *.*", {
        cwd : tmpDir.name,
    })
    console.log("cleanup...")
    child_process.execSync("rm -rf " + tmpDir.name);
    console.log("done.");
}

/* Parses given file. 

 Tries the acorn parser first, and if it fails, records the error and attempts the recovering parse_dammit routine so that we have at least some stuff in there. 
 * /
function parseFile(filename, dir) {
    // let's not bother with encoding
    let src = fs.readFileSync(path.join(dir, filename))
    // let's try proper parsing first
    try {
        let tokens = []
        let comments = []
        let ast = acorn.parse(src, {
            onToken: tokens,
            onComment: comments,
            allowHashBang: true,
        })
        saveResults(filename, dir, tokens, comments, ast, null);
        return true;
    } catch (e) {
        let tokens = []
        let comments = []
        let ast = acorn.parse_dammit(src, {
            onToken: tokens,
            onComment: comments,
            allowHashBang: true,
        })
        saveResults(filename, dir, tokens, comments, ast, e);
        return false;
    }
}

/* Stores the parsed ast, commentsa nd possibly the error in separate files. 
 * /
function saveResults(filename, dir, tokens, comments, ast, error) {
    let basename = filename.substr(0, filename.length - 4); // exclude.raw
    // we are not storing tokens because they are *huge*
    //nfs.writeFileSync(path.join(dir, basename + ".tokens"), JSON.stringify(tokens));
    fs.writeFileSync(path.join(dir, basename + ".comments"), JSON.stringify(comments));
    fs.writeFileSync(path.join(dir, basename + ".ast"), JSON.stringify(ast));
    if (error !== null) 
        fs.writeFileSync(path.join(dir, basename + ".error"), error);
}



parseArchive("/data/github_js_main/files.tar.xz");


console.log("KTHXBYE");

process.exit();


*/