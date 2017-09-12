const { lstatSync, readdirSync } = require('fs');
const { join } = require('path');
const fs = require('fs');
const isDirectory = source => lstatSync(source).isDirectory();
const utils = require("./utils.js");

module.exports = {
	help: function() {},
	siftProjects: function() {
		/**
		 * [project-url, [js-files]]
		 */
		var all_stats = [];
		var categorized;
		var scored_stats;

		let path = process.argv[3];
		let num = Number.parseInt(process.argv[4]);
		let projects = utils.listProjects(path, num);
		
		for (let p of projects) {
			utils.analyzeProjectTools(p);
			utils.analyzeProjectDependencies(p);
			utils.addMetaData(p);
			labelProject(p);
			all_stats.push([p.url, projStats(p), p.path]);
		};
		
		categorized = getResults(projects);
		scored_stats = getNJSScores(all_stats, categorized);
		scored_stats = sortTally(scored_stats);
		printResults(scored_stats);
		//console.log(scored_stats);
		}
};

const labels = {
	CLI : ["babel-core",
		"browserify",
		"coffee-script",
		"inquirer",
		"js-yaml",
		"update-notifier"],
	CLS : ["angular",
		"backbone",
		"body-parser",
		"connect",
		"express",
		"handlebars",
		"jade",
		"superagent"],
	DOM : ["angular",
		"bootstrap",
		"d3",
		"ejs",
		"express",
		"font-awesome",
		"jquery",
		"less",
		"method-override",
		"postcss",
		"react",
		"react-dom",
		"react-router",
		"url-loader"],
	LIB : ["async",
		"babel-core",
		"babel-loader",
		"babel-polyfill",
		"babel-preset-es2015",
		"babel-preset-react",
		"babel-runtime",
		"bluebird",
		"body-parser",
		"chalk",
		"classnames",
		"commander",
		"d3",
		"debug",
		"es6-promise",
		"express",
		"file-loader",
		"fs-extra",
		"gulp-util",
		"history",
		"immutable",
		"inherits",
		"invariant",
		"isomorphic-fetch",
		"js-yaml",
		"lodash",
		"marked",
		"mime",
		"minimatch",
		"mkdirp",
		"moment",
		"node-uuid",
		"prop-types",
		"q",
		"qs",
		"react",
		"react-redux",
		"redux",
		"request",
		"source-map",
		"underscore",
		"underscore.string",
		"uuid",
		"validator",
		"winston",
		"xtend"],
	NJS : ["chalk",
		"cheerio",
		"chokidar",
		"colors",
		"connect",
		"cookie-parser",
		"commander",
		"inquirer",
		"express",
		"express-session",
		"file-loader",
		"formidable",
		"fs-extra",
		"glob",
		"grunt",
		"gulp",
		"gulp-util",
		"method-override",
		"minimatch",
		"minimist",
		"mkdirp",
		"mongodb",
		"mongoose",
		"morgan",
		"nodemailer",
		"passport-local",
		"compression",
		"object-assign",
		"optimist",
		"passport",
		"redis",
		"redux-thunk",
		"request",
		"resolve",
		"rimraf",
		"semver",
		"serve-favicon",
		"socket.io",
		"socket.io-client",
		"source-map-support",
		"through2",
		"uglify-js",
		"webpack",
		"winston",
		"ws",
		"yargs",
		"yeoman-generator"]		
};

/** 		
 * all-stats: [project-url, [js-files]]
 *
 * categorized: [[ project-url, CLI, CLS, DOM, LIB, NJS ... ] ... ]
 *
 * return: [[project-url, NJS_score], {js-files}]
 */
function getNJSScores(all_stats, categorized) {
	for (var p = 0; p < all_stats.length; p++) {
		var found = false;
		for (let c of categorized) {
			if (all_stats[p][0] === c[0]) {
				all_stats[p][0] = [all_stats[p][0], c[5]];
				found = true;
			}
		}
		if (found === false) {
			all_stats[p][0] = [ all_stats[p][0], 0];
		}
	}
	return all_stats;
};

/**
 * stats:  [[project-url, NJS_score], [js-files]]
 */
function printResults(stats) {
	for (let proj of stats) {
		console.log("Project:  ".concat(proj[0][0]));
		console.log("Path:     ".concat(proj[2]));
		console.log("    NJS:  ".concat(proj[0][1]));
		console.log("    require-stmts:  ".concat(Object.keys(proj[1]).length));
		for (let req of Object.keys(proj[1])) {
			console.log("        ".concat(req));
		}
	}
};


/**
 * Returns:
 *
 * [[filename, project-directory]
 *  ... ]
 */
function getJSFiles(dir, proj) {
	var lastchar = dir.substring(dir.length - 1, dir.length);
	if (lastchar === "/") {
		dir = dir.substring(0, dir.length - 1);
	}
	var files_in_path = fs.readdirSync(dir);
	var js_files = [];
	for (let f of files_in_path) {
		var _f = dir.concat("/").concat(f);
		if (fs.lstatSync(_f).isDirectory()) {
			js_files.push.apply(js_files, getJSFiles(_f, proj));
		}
		else if (fs.lstatSync(_f).isFile()) {
			var ext = _f.substring(_f.length - 3, _f.length);
			if (ext === ".js") {
				js_files.push([_f, proj]);
			}
		}
		else {
			// pass
		}
	}
	return js_files;
};

function getResults(ps) {

	var categorized = [];
	var uncategorized = [];
	
	for (let p of ps) {
		var dom_score = p.labels.DOM;
		var lib_score = p.labels.LIB;
		var njs_score = p.labels.NJS;
		var cli_score = p.labels.CLI;
		var cls_score = p.labels.CLS;

		if (dom_score === 0 && njs_score === 0 && cli_score === 0 && cls_score === 0 && lib_score === 0) {
			uncategorized.push(p);
		}
		else {
			categorized.push([p.url, cli_score, cls_score, dom_score, lib_score, njs_score]);
		}
	}
	
	printLabels(ps.length, uncategorized.length);

	return categorized;
};

function labelProject(p) {
	p.labels = {};

	for (let l in labels) {
		p.labels[l] = 0;
		for (let dep of labels[l]) {
			if (p.dependencies[dep]) {
				p.labels[l] = p.labels[l] + 1;
			}
			else if (p.devDependencies !== undefined){
				if (p.devDependencies[dep]) {
					p.labels[l] = p.labels[l] + 1;
				}
				// do nothing	
			}
		}

	}
};

function  printLabels(total_num, unlabeled_num) {
	console.log("\n");
	console.log("Total projects: ".concat(total_num));
	console.log("Uncategorized projects (no labeled dependencies): ".concat(unlabeled_num));
	console.log("\n\n");
};

function projStats(proj) {
	var js_files = getJSFiles(proj.path, proj.path);
	var require_stats = tallyRequireStmts(js_files);
	return require_stats;
};

/**
 * return:  [[project-url, NJS_score], {js-files}]
 */
function sortTally(projects) {
	return projects.sort(function(a, b) {return b[0][1] - a[0][1]})	
};

function tallyRequireStmts(js_files) {
	var pkgs = {};
	for (let tup of js_files) {
		var f = tup[0];
		var pkg = tup[1];
		var file_text = fs.readFileSync(f, "utf8");
		var patt = /^require\(['"]([\w-]+)['"]\)/gm;
		var path;
		while ((path = patt.exec(file_text)) !== null) {
			var pname = path[1];
			if (pkgs[pname] !== undefined) {
				pkgs[pname][0] = pkgs[pname][0] + 1;
				pkgs[pname][1].push(pkg);
			}
			else {
				pkgs[pname] = [1, [pkg]];			
			}
		}
	}

	return pkgs;
};
