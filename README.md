> TODO stuff here

# Building

Simply run `npm install` in the repository root to install all dependencies. 

# Getting the Repositories

Currently, we use [ghtorrent](http://http://ghtorrent.org/) as the source of projects to download. 

> There is a plan to remove even this step and download projects directly from github, which we can do using the [`/repositories`](https://developer.github.com/v3/repos/#list-all-public-repositories) API path. However, the annoying thing is that the results of this search do not give us the language of the project and therefore we would essentially have to do a request per project to get only projects of certain languages, which is a lot of API hours. 

Once you have the database dump, extract its `projects.csv` file and call the filtering stage, which filters only the projects which are in the specified language:

    node --max-old-space-size=8192 index.js filter INPUT OUTPUT LANG1 LANG2 LANGN [--noforks]

where `INPUT` is absolute path to the `projects.csv` extracted from ghtorreent, `OUTPUT` is absolute path to a file that would contain only the filtered projects, `LANG1`...`LANGN` are languages to be filteres and the optional `--noforks` argument filters out any forked projects if used. 

Make sure to increase the heap size for the process using `--max-old-space-size` option with size in megabytes (8GB works just fine, but less should also be acceptable). 

# Downloading the repositories and their snapshots





