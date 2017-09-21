const { lstatSync, readdirSync, readFileSync, writeFileSync, appendFileSync } = require('fs');
const { join } = require('path');
const isDirectory = source => lstatSync(source).isDirectory();
const utils = require("./utils.js");

var util = require('util');

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
		processResults(scored_stats);
		makeScatterplot(scored_stats);

		//console.log(scored_stats);
		}
};


// var fs = require('fs');

const black = "\x1b[30m";
const red = "\x1b[31m";
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
 * categorized: [[ project-url, CLI, CLS, DOM, LIB, NJS ... ] ... ] // these are only the labeled projects
 *
 * return: [[project-url, NJS_score], {js-files}]
 */
function getNJSScores(all_stats, categorized) {
	for (var p = 0; p < all_stats.length; p++) {
		var found = false;
		// NOTE: Right now all other labels are added together in all_stats[p][0][2]
		for (let c of categorized) {
			if (all_stats[p][0] === c[0]) {
				var other_labels = c[1] + c[2] + c[3] + c[4];
				all_stats[p][0] = [all_stats[p][0], c[5], other_labels];
				found = true;
			}
		}
		// project has no labels
		if (found === false) {
			all_stats[p][0] = [ all_stats[p][0], 0, 0];
		}
	}
	return all_stats;
};

/**
 * [[url, njs], {req: file ...}]
 */
function processResults(stats) {
	var total = 0; // number of requires
	var zero_aberrant = []; // NJS == 0 && number of requires > 0
	var gt_zero_aberrant = []; // NJS > 0 && number of requires == 0
	var no_labels = [];
	for (let proj of stats) {
		var njs = proj[0][1];
		var path = proj[2];
		var proj_url = proj[0][0]; // project url
		req_num = Object.keys(proj[1]).length;

		if ((njs === 0) && (req_num > 0)) {
			if (proj[0][2] > 0) {
				gt_zero_aberrant.push([proj_url, path, njs, proj[1]]);
			}
			else {
				no_labels.push([proj_url, path, njs, proj[1]]);
			}
		}
		if ((njs > 0) && (req_num === 0)) {
			
			zero_aberrant.push([proj_url, path, njs, proj[1]]);
		}
	}
	printResults(zero_aberrant, gt_zero_aberrant, stats.length, no_labels);
};

/**
 * zero_aberrant: [url, path, njs_score, requires]
 * gt_zero_aberrant: "
 * total: int
 */
function printResults(req_zero_aberrant, req_gt_zero_aberrant, total, no_labels) {
	var encoding = "utf-8";
	var ratio = ((req_zero_aberrant.length + req_gt_zero_aberrant.length) / total) * 100;
	var false_pos = (req_gt_zero_aberrant.length / total) * 100;
	var false_neg = (req_zero_aberrant.length / total) * 100;
	var no_label_percent = (no_labels.length / total) * 100;
	var filename = "aberration_report.txt";
	
	// Strings
	var print_ratios = util.format('Percent aberrant projects:  %d\nPercent false positives (NJS > 0 && requires == 0):  %d\nPercent false negatives (NJS == 0 && requires > 0):  %d\n\nPercent unlabeled projects: %d\n\n', ratio, false_neg, false_pos, no_label_percent);

	console.log(print_ratios);
	
	// make file, print ratio
	writeFileSync(filename, print_ratios, encoding);

	// print info for files where njs & reqs have bad values
	appendFileSync(filename, "\n\nFiles where (NJS > 0) && (reqs == 0)\n\n");
	for (let proj of req_zero_aberrant) {
		var line = getline(proj);
		appendFileSync(filename, line);	
	}
	appendFileSync(filename, "\n\n\nFiles where (NJS == 0) && (reqs > 0)\n\n");
	for (let proj of req_gt_zero_aberrant) {
		var line = getline(proj);
		appendFileSync(filename, line);
	}
	
	function getline(p) {
		// url, path, njs
		var keys = Object.keys(p[3]);
		var info = util.format('%s\n    %s\n    NJS: %d     Unique require stmts: %d\n', p[0], p[1], p[2], keys.length);
		var reqs = "";
		for (let r of keys) {
			var reqline = util.format('      %s\n', r);
			reqs = reqs.concat(reqline);
		}
		return info.concat(reqs);
	};
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
	var files_in_path = readdirSync(dir);
	var js_files = [];
	for (let f of files_in_path) {
		var _f = dir.concat("/").concat(f);
		if (lstatSync(_f).isDirectory()) {
			js_files.push.apply(js_files, getJSFiles(_f, proj));
		}
		else if (lstatSync(_f).isFile()) {
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
	var uncategorized = []; // projects which have no labels
	
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
	for (let e in p.engines) {
		if (e === "node") {
			p.labels["NJS"] = p.labels["NJS"] + 1;
		}
		else {
			// pass
		}
	}
};

function makeScatterplot(stats) {
	var filename = "scatterplot.R";
	var njs_axis = "njs <- c(";
	var req_axis = "req <- c(";
	for (let entry of stats) {
		njs_axis = njs_axis.concat(" ".concat(entry[0][1]).concat(","));
		req_axis = req_axis.concat(" ".concat(Object.keys(entry[1]).length).concat(","));
	}

	// remove last comma
	njs_axis = njs_axis.substring(0, njs_axis.length - 1);
	req_axis = req_axis.substring(0, req_axis.length - 1);

	njs_axis = njs_axis.concat(")\n");
	req_axis = req_axis.concat(")\n");
	df = "df = data.frame(njs, req)\n";
	plot = "with(df, plot(njs, req, xlab='NJS Score', ylab='Number Require Statements'))";

	var out = njs_axis.concat(req_axis).concat(df).concat(plot);

	writeFileSync(filename, out, "utf-8");

};

function  printLabels(total_num, unlabeled_num) {
	console.log("\nTotal projects: ".concat(total_num));
	console.log("Uncategorized projects (no labeled dependencies): ".concat(unlabeled_num));
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
		var file_text = readFileSync(f, "utf8");
		var patt = /require\([\s*'"]([^)]+)[\s*'"]\)/gm;
		var path;
		while ((path = patt.exec(file_text)) !== null) {
			var pname = path[1];
			try {
				if (pkgs[pname] !== undefined) {
					//console.log(pkgs[pname]);
					pkgs[pname][0] = pkgs[pname][0] + 1;
					pkgs[pname][1].push(pkg);
				}
				else {
					pkgs[pname] = [1, [pkg]];			
				}
			}
			catch (err) {
				console.log("Error: ".concat(pkgs.pname).concat(" ").concat(err));
			}
		}
	}

	return pkgs;
};
