const { lstatSync, readdirSync } = require('fs');
const { join } = require('path');
const fs = require('fs');
const isDirectory = source => lstatSync(source).isDirectory();
const utils = require("./utils.js");

module.exports = {
	help: function() {},
	siftProjects: function() {
		let path = process.argv[3];
		let num = Number.parseInt(process.argv[4]);
		let projects = utils.listProjects(path, num);
		for (let p of projects) {
			utils.analyzeProjectTools(p);
			utils.analyzeProjectDependencies(p);
			utils.addMetaData(p);
			labelProject(p);
		};
		getResults(projects);
		var package_stats = get_stats(path);
		console.log(package_stats);
	}
}

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

function getResults(ps) {

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
			console.log(p.url);
			console.log("  DOM deps: ".concat(dom_score));
			console.log("  LIB deps: ".concat(lib_score));
			console.log("  NJS deps: ".concat(njs_score));
			console.log("  CLI deps: ".concat(cli_score));
			console.log("  CLS deps: ".concat(cls_score));
		}
	}
	
	console.log("\n");
	console.log("Total projects: ".concat(ps.length));
	console.log("Uncategorized projects (no labeled dependencies): ".concat(uncategorized.length));
	console.log("\n\n");
};


function get_stats(path) {
	var js_files = get_js_files(path); 
	var require_stats = tally_require_stmts(js_files);
	return require_stats;
}

function tally_require_stmts(js_files) {
	var pkgs = {};
	for (let f of js_files) {
		var file_text = fs.readFileSync(f, "utf8");
		var patt = /^require\(['"]([\w-]+)['"]\)/gm;
		var path;
		while ((path = patt.exec(file_text)) !== null) {
			if (pkgs[path[1]] !== undefined) {
				pkgs[path[1]] = pkgs[path[1]] + 1;
			}
			else {
				pkgs[path[1]] = 1;
			}
		}
	}

	return pkgs;
};

function get_js_files(dir) {
	var lastchar = dir.substring(dir.length - 1, dir.length);
	if (lastchar === "/") {
		dir = dir.substring(0, dir.length - 1);
	}
	var files_in_path = fs.readdirSync(dir);
	var js_files = [];
	for (let f of files_in_path) {
		var _f = dir.concat("/").concat(f);
		if (fs.lstatSync(_f).isDirectory()) {
			js_files.push.apply(js_files, get_js_files(_f));
		}
		else if (fs.lstatSync(_f).isFile()) {
			var ext = _f.substring(_f.length - 3, _f.length);
			if (ext === ".js") {
				js_files.push(_f);
			}
		}
		else {
			// pass
		}
	}
	return js_files;
}

